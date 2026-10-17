import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError, type BriefIdentity } from './access';
import { getDatabase } from './firebase';
import { SourceRecordSchema, type SourceRecord } from './sources';
export interface WorkspaceSource {
    source: SourceRecord;
    rawExport: string;
    fileId: string;
    modifiedTime: string;
    version: string;
    importedAt: string;
    embeddings: number[][];
}
export interface WorkspaceJob {
    id: string;
    status: 'running' | 'waiting' | 'complete' | 'failed' | 'cancelled';
    fileIds: string[];
    index: number;
    chunkIndex: number;
    completed: number;
    failed: number;
    retryAt?: number;
    retries: number;
    lease?: {
        id: string;
        until: number;
    };
    pending?: WorkspaceSource;
    error?: string;
}
export interface WorkspaceState {
    connectionId?: string;
    generation: number;
    sources: WorkspaceSource[];
    job?: WorkspaceJob;
    usage: {
        files: number[];
        attempts: number[];
        admissions?: { fileId: string; at: number }[];
    };
}
export interface WorkspaceStore {
    read(identity: BriefIdentity): Promise<WorkspaceState>;
    mutate<T>(identity: BriefIdentity, update: (state: WorkspaceState) => T): Promise<T>;
    reserveEmbedding(identity: BriefIdentity, now: number): Promise<number | null>;
}
export const workspaceOwnerKey = (identity: BriefIdentity) => createHash('sha256').update(JSON.stringify([identity.tenantId, identity.uid])).digest('hex');
const fresh = (): WorkspaceState => ({
    generation: 0, sources: [], usage: {
        files: [], attempts: []
    }
});
const timestamps = z.array(z.number().finite().nonnegative()).max(128);
const sourceSchema = z.object({
    source: SourceRecordSchema, rawExport: z.string().max(65536), fileId: z.string().min(1).max(256),
    modifiedTime: z.string().min(1).max(64), version: z.string().min(1).max(64), importedAt: z.string().min(1).max(64),
    embeddings: z.array(z.array(z.number().finite()).length(768)).max(32),
}).superRefine((value, context) => {
    if (Buffer.byteLength(value.rawExport) > 65536 || value.source.chunks.length > 32 || value.embeddings.length > value.source.chunks.length)
        context.addIssue({ code: 'custom', message: 'Workspace source exceeds limits.' });
});
const stateSchema = z.object({
    connectionId: z.string().max(256).optional(), generation: z.number().int().nonnegative(),
    sources: z.array(sourceSchema).max(3), usage: z.object({ files: timestamps, attempts: timestamps, admissions: z.array(z.object({ fileId: z.string().max(256), at: z.number().finite() })).max(3).optional() }),
    job: z.object({
        id: z.string().max(256), status: z.enum(['running', 'waiting', 'complete', 'failed', 'cancelled']),
        fileIds: z.array(z.string().min(1).max(256)).min(1).max(3), index: z.number().int().min(0).max(3),
        chunkIndex: z.number().int().min(0).max(32), completed: z.number().int().min(0).max(3), failed: z.number().int().min(0).max(3),
        retryAt: z.number().finite().optional(), retries: z.number().int().min(0).max(2),
        lease: z.object({ id: z.string().max(256), until: z.number().finite() }).optional(), pending: sourceSchema.optional(),
        error: z.string().max(256).optional(),
    }).optional(),
});
function parseState(value: unknown): WorkspaceState {
    const state = stateSchema.parse(value);
    if (state.sources.some(v => v.embeddings.length !== v.source.chunks.length)) throw new Error('Incomplete stored workspace evidence.');
    if (state.sources.reduce((n, v) => n + Buffer.byteLength(v.rawExport), 0) > 192 * 1024 || state.sources.reduce((n,v) => n + v.source.chunks.length, 0) > 32) throw new Error('Stored workspace exceeds limits.');
    return state;
}
function bounded(state: WorkspaceState) {
    const clean = parseState(JSON.parse(JSON.stringify(state)));
    if (Buffer.byteLength(JSON.stringify(clean)) > 850 * 1024)
        throw new Error('Workspace storage limit exceeded.');
    return clean;
}
// Firestore forbids arrays nested directly in arrays. Wrap each vector at the persistence boundary.
function encodeState(state: WorkspaceState): Record<string, unknown> {
    const clean = bounded(state);
    const wrap = (v: WorkspaceSource) => ({ ...v, embeddings: v.embeddings.map(values => ({ values })) });
    const encoded = JSON.parse(JSON.stringify({ ...clean, sources: clean.sources.map(wrap), job: clean.job ? { ...clean.job, pending: clean.job.pending ? wrap(clean.job.pending) : undefined } : undefined }));
    if (Buffer.byteLength(JSON.stringify(encoded)) > 850 * 1024) throw new Error('Workspace storage limit exceeded.');
    return encoded;
}
function decodeState(value: unknown): WorkspaceState {
    const data = value as Record<string, unknown>;
    const unwrap = (value: unknown) => {
        const v = value as Record<string, unknown>;
        if (!v || !Array.isArray(v.embeddings)) throw new Error('Invalid persisted vectors.');
        return { ...v, embeddings: v.embeddings.map(e => {
            if (!e || typeof e !== 'object' || !('values' in e)) throw new Error('Invalid persisted vector.');
            return e.values;
        }) };
    };
    const job = data.job as Record<string, unknown> | undefined;
    return parseState({ ...data, sources: Array.isArray(data.sources) ? data.sources.map(unwrap) : data.sources, job: job ? { ...job, pending: job.pending ? unwrap(job.pending) : undefined } : undefined });
}
function reserve(state: WorkspaceState, global: number[], now: number): number | null {
    const day = now - 86400000;
    state.usage.attempts = state.usage.attempts.filter(t => t > day);
    const minute = global.filter(t => t > now - 60000);
    if (state.usage.attempts.length >= 64 || global.length >= 128)
        throw new ApiError(429, 'Daily embedding budget exhausted.');
    // The SDK request has a 30-second deadline. A conservative global reservation avoids overlapping requests.
    const retry = Math.max((global.at(-1) ?? 0) + 31000, minute.length >= 4 ? minute[0] + 60000 : 0);
    if (retry > now)
        return retry;
    state.usage.attempts.push(now);
    global.push(now);
    return null;
}
export class InMemoryWorkspaceStore implements WorkspaceStore {
    private states = new Map<string, WorkspaceState>();
    private global: number[] = [];
    async read(i: BriefIdentity) {
        return structuredClone(this.states.get(workspaceOwnerKey(i)) ?? fresh());
    }
    async mutate<T>(i: BriefIdentity, fn: (s: WorkspaceState) => T) {
        const s = structuredClone(this.states.get(workspaceOwnerKey(i)) ?? fresh());
        const result = fn(s);
        this.states.set(workspaceOwnerKey(i), bounded(s));
        return result;
    }
    async reserveEmbedding(i: BriefIdentity, now: number) {
        this.global = this.global.filter(t => t > now - 86400000);
        return this.mutate(i, s => reserve(s, this.global, now));
    }
}
export class FirestoreWorkspaceStore implements WorkspaceStore {
    constructor(private db: Firestore = getDatabase()) {
    }
    private ref(i: BriefIdentity) {
        return this.db.doc(`workspaceImports/${workspaceOwnerKey(i)}`);
    }
    async read(i: BriefIdentity) {
        const d = await this.ref(i).get();
        return d.exists ? decodeState(d.data()) : fresh();
    }
    async mutate<T>(i: BriefIdentity, fn: (s: WorkspaceState) => T) {
        return this.db.runTransaction(async (t) => {
            const ref = this.ref(i);
            const snap = await t.get(ref);
            const s = snap.exists ? decodeState(snap.data()) : fresh();
            const value = fn(s);
            t.set(ref, encodeState(s));
            return value;
        });
    }
    async reserveEmbedding(i: BriefIdentity, now: number) {
        return this.db.runTransaction(async (t) => {
            const owner = this.ref(i), global = this.db.doc('workspaceQuotas/embeddings');
            const [a, b] = await Promise.all([t.get(owner), t.get(global)]);
            const s = a.exists ? decodeState(a.data()) : fresh();
            const times = timestamps.parse(b.data()?.attempts ?? []).filter(v => v > now - 86400000);
            const retry = reserve(s, times, now);
            t.set(owner, encodeState(s));
            t.set(global, {
                attempts: times
            });
            return retry;
        });
    }
}
export function getWorkspaceStore(): WorkspaceStore {
    return new FirestoreWorkspaceStore();
}
