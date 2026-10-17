import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, type BriefIdentity } from './access';
import { SourceRecordSchema, splitIntoBodies, SyntheticSeedAdapter } from './sources';
import { embed, validateEmbedding } from './gemini';
import { getWorkspaceStore, type WorkspaceStore, type WorkspaceSource, type WorkspaceState } from './workspace-store';
import { disconnectWorkspaceConnection, getWorkspaceConnection } from './workspace-auth';
import { getWorkspaceConfig } from './workspace-config';
export interface DriveMetadata {
    id: string;
    mimeType: string;
    modifiedTime: string;
    version: string;
    ownedByMe: boolean;
    trashed?: boolean;
    driveId?: string;
    shortcutDetails?: unknown;
}
export interface WorkspaceConnection {
    id: string;
    generation: number;
    subject: string;
    expiresAt: number;
    accessToken: string;
}
export interface WorkspaceDrive {
    metadata(fileId: string, token: string): Promise<DriveMetadata>;
    export(fileId: string, mime: string, token: string): Promise<string>;
}
export interface WorkspaceImportDeps {
    store?: WorkspaceStore;
    drive?: WorkspaceDrive;
    connection?: (i: BriefIdentity) => Promise<WorkspaceConnection>;
    disconnect?: typeof disconnectWorkspaceConnection;
    registry?: {
        fileId: string;
        sourceId: string;
        subject: string;
    }[];
    now?: () => number;
    embed?: (text: string) => Promise<number[]>;
}
const DOC = 'application/vnd.google-apps.document', SHEET = 'application/vnd.google-apps.spreadsheet';
async function request(url: string, token: string): Promise<Response> {
    const r = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }, signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) {
        const e = new Error(`Workspace provider request failed (${r.status}).`) as Error & {
            status: number;
            retryAfter: number;
        };
        e.status = r.status;
        const retryHeader = r.headers.get('Retry-After');
        const seconds = Number(retryHeader);
        const retryDelay = retryHeader && !Number.isFinite(seconds) ? Date.parse(retryHeader) - Date.now() : seconds * 1000;
        e.retryAfter = Number.isFinite(retryDelay) ? Math.max(0, retryDelay) : 0;
        throw e;
    }
    return r;
}
export const googleWorkspaceDrive: WorkspaceDrive = {
    async metadata(id, token) {
        return await (await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,mimeType,modifiedTime,version,ownedByMe,trashed,driveId,shortcutDetails`, token)).json() as DriveMetadata;
    },
    async export(id, mime, token) {
        const r = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(mime === DOC ? 'text/plain' : 'text/csv')}`, token);
        const reader = r.body?.getReader();
        if (!reader)
            throw new Error('Empty export.');
        let size = 0;
        const parts: Uint8Array[] = [];
        try {
            for (;;) {
                const v = await reader.read();
                if (v.done)
                    break;
                size += v.value.byteLength;
                if (size > 65536)
                    throw new Error('File exceeds 64 KiB.');
                parts.push(v.value);
            }
        }
        finally {
            await reader.cancel();
        }
        return Buffer.concat(parts).toString('utf8');
    }
};
function deps(d: WorkspaceImportDeps) {
    return {
        store: d.store ?? getWorkspaceStore(), drive: d.drive ?? googleWorkspaceDrive, connection: d.connection ?? getWorkspaceConnection, disconnect: d.disconnect ?? disconnectWorkspaceConnection, registry: d.registry ?? getWorkspaceConfig().registry, now: d.now ?? Date.now, embed: d.embed ?? ((text: string) => embed(text, 'RETRIEVAL_DOCUMENT'))
    };
}
async function rejectRevokedConnection(error: unknown, i: BriefIdentity, c: WorkspaceConnection, d: ReturnType<typeof deps>): Promise<void> {
    if (!(error instanceof Error) || !('status' in error) || error.status !== 401) return;
    // Provider credential loss invalidates this connection, not a later reconnect.
    try { await d.disconnect(i, { id: c.id, generation: c.generation }); }
    finally { await clearWorkspaceImports(i, { store: d.store }, c.id); }
    throw new ApiError(401, 'Workspace authorization expired or revoked. Reconnect before continuing.');
}
async function driveWithRevocation<T>(i: BriefIdentity, c: WorkspaceConnection, d: ReturnType<typeof deps>, operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { await rejectRevokedConnection(error, i, c, d); throw error; }
}
function valid(m: DriveMetadata, id: string) {
    if (m.id !== id || !m.ownedByMe || m.trashed || m.driveId || m.shortcutDetails || ![DOC, SHEET].includes(m.mimeType) || !m.version || !m.modifiedTime)
        throw new ApiError(403, 'Only owned, registered Google Docs and first-tab Sheets are supported.');
}
function same(a: DriveMetadata, b: DriveMetadata) {
    return a.version === b.version && a.modifiedTime === b.modifiedTime && a.mimeType === b.mimeType;
}
// Native Docs text export can add empty paragraph lines. Compare paragraph spacing
// only; imported content/chunks below always retain the literal provider export.
const normalizeDoc = (s: string) => s.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n$/, '').replace(/\n{2,}/g, '\n\n');
export function parseWorkspaceCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], field = '', quoted = false, closed = false;
    for (let n = 0; n < csv.length; n++) {
        const c = csv[n];
        if (quoted) {
            if (c === '"') {
                if (csv[n + 1] === '"') {
                    field += '"';
                    n++;
                }
                else {
                    quoted = false;
                    closed = true;
                }
            }
            else
                field += c;
        }
        else if (c === '"') {
            if (field || closed)
                throw new Error('Invalid CSV quotation.');
            quoted = true;
        }
        else if (c === ',') {
            row.push(field);
            field = '';
            closed = false;
        }
        else if (c === '\r' || c === '\n') {
            if (c === '\r' && csv[n + 1] === '\n')
                n++;
            rows.push([...row, field]);
            row = [];
            field = '';
            closed = false;
        }
        else {
            if (closed)
                throw new Error('Invalid CSV field.');
            field += c;
        }
    }
    if (quoted)
        throw new Error('Invalid CSV quotation.');
    if (field || row.length || closed)
        rows.push([...row, field]);
    return rows;
}
async function loadFile(i: BriefIdentity, id: string, c: WorkspaceConnection, d: ReturnType<typeof deps>, assertActive: () => Promise<void>): Promise<WorkspaceSource> {
    const registration = d.registry.find(r => r.fileId === id && r.subject === c.subject);
    if (!registration)
        throw new Error('File is not registered for this Google account.');
    const [seedSource] = await new SyntheticSeedAdapter('evaluation').list([registration.sourceId]);
    let source = seedSource;
    await assertActive();
    const before = await driveWithRevocation(i, c, d, () => d.drive.metadata(id, c.accessToken));
    valid(before, id);
    if (before.mimeType !== (source.kind === 'google_doc' ? DOC : SHEET))
        throw new Error('Registered file type mismatch.');
    await assertActive();
    const rawExport = await driveWithRevocation(i, c, d, () => d.drive.export(id, before.mimeType, c.accessToken));
    if (Buffer.byteLength(rawExport) > 65536)
        throw new Error('File exceeds 64 KiB.');
    if (source.kind === 'google_doc') {
        if (normalizeDoc(rawExport) !== normalizeDoc(source.content))
            throw new Error('Export does not match registered synthetic source.');
        // Normalize transport differences for comparison only. Quotes and chunks retain the actual export bytes.
        const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
        const chunks = splitIntoBodies(rawExport).map((body, ordinal) => ({ ...source.chunks[0],
            id: `${source.id}:${ordinal}`, ordinal, body, checksum: hash(body) }));
        source = SourceRecordSchema.parse({ ...source, content: rawExport, contentHash: hash(rawExport), chunks, chunkCount: chunks.length });
    }
    else {
        const bundle = JSON.parse(await readFile(path.join(process.cwd(), 'seed/generated/seed_bundle.json'), 'utf8')) as {
            sheets: {
                id: string;
                headers: string[];
                rows: unknown[][];
            }[];
        };
        const sheet = bundle.sheets.find(s => s.id === source.id);
        if (!sheet)
            throw new Error('Unknown synthetic sheet.');
        const csv = [sheet.headers, ...sheet.rows].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
        if (JSON.stringify(parseWorkspaceCsv(rawExport.replace(/^\uFEFF/, ''))) !== JSON.stringify(parseWorkspaceCsv(csv)))
            throw new Error('Export does not match registered synthetic sheet.');
    }
    await assertActive();
    const after = await driveWithRevocation(i, c, d, () => d.drive.metadata(id, c.accessToken));
    valid(after, id);
    if (!same(before, after))
        throw new Error('File changed during import.');
    return {
        source, rawExport, fileId: id, modifiedTime: after.modifiedTime, version: after.version, importedAt: new Date(d.now()).toISOString(), embeddings: []
    };
}
export async function startWorkspaceImport(i: BriefIdentity, fileIds: string[], options: WorkspaceImportDeps = {}) {
    const d = deps(options), c = await d.connection(i), now = d.now();
    if (!fileIds.length || fileIds.length > 3 || new Set(fileIds).size !== fileIds.length || fileIds.some(id => !d.registry.some(r => r.fileId === id && r.subject === c.subject)))
        throw new ApiError(403, 'Select one to three registered synthetic files.');
    await d.store.mutate(i, s => {
        if (s.job && ['running', 'waiting'].includes(s.job.status)) {
            if (s.connectionId === c.id && s.generation === c.generation && JSON.stringify(s.job.fileIds) === JSON.stringify(fileIds)) return;
            throw new ApiError(409, 'An import is already active.');
        }
        const admissions = (s.usage.admissions ?? []).filter(v => v.at > now - 86400000);
        const additions = fileIds.filter(fileId => !admissions.some(v => v.fileId === fileId));
        if (admissions.length + additions.length > 3)
            throw new ApiError(429, 'Daily three-file import budget exhausted.');
        admissions.push(...additions.map(fileId => ({ fileId, at: now })));
        s.usage.admissions = admissions;
        s.usage.files = admissions.map(v => v.at);
        if (s.connectionId !== c.id || s.generation !== c.generation) s.sources = [];
        s.connectionId = c.id;
        s.generation = c.generation;
        s.job = {
            id: randomUUID(), status: 'running', fileIds, index: 0, chunkIndex: 0, completed: 0, failed: 0, retries: 0
        };
    });
    return getWorkspaceStatus(i, options);
}
export async function stepWorkspaceImport(i: BriefIdentity, options: WorkspaceImportDeps = {}) {
    const d = deps(options), c = await d.connection(i), now = d.now(), lease = randomUUID();
    const snapshot = await d.store.mutate(i, s => {
        if (s.connectionId !== c.id || s.generation !== c.generation)
            throw new Error('Connection changed; restart import.');
        const j = s.job;
        if (!j || !['running', 'waiting'].includes(j.status) || (j.retryAt ?? 0) > now || (j.lease?.until ?? 0) > now)
            return null;
        j.lease = {
            id: lease, until: now + 60000
        };
        return structuredClone(s);
    });
    if (!snapshot)
        return getWorkspaceStatus(i, options);
    const j = snapshot.job!;
    try {
        let pending = j.pending;
        if (!pending) {
            pending = await loadFile(i, j.fileIds[j.index], c, d, async () => {
                const current = await d.connection(i);
                const state = await d.store.read(i);
                if (current.id !== c.id || current.generation !== c.generation || state.connectionId !== c.id || state.generation !== c.generation || state.job?.lease?.id !== lease)
                    throw new Error('Import authorization changed.');
            });
            const cached = snapshot.sources.find(v => v.fileId === pending!.fileId && v.source.contentHash === pending!.source.contentHash);
            if (cached) pending.embeddings = cached.embeddings;
            const retained = snapshot.sources.filter(v => v.fileId !== pending!.fileId && v.source.id !== pending!.source.id);
            if (retained.length + 1 > 3 || retained.reduce((n, v) => n + Buffer.byteLength(v.rawExport), Buffer.byteLength(pending.rawExport)) > 192 * 1024 || retained.reduce((n, v) => n + v.source.chunks.length, pending.source.chunks.length) > 32)
                throw new Error('Workspace import limits exceeded.');
        }
        else {
            const currentFile = await driveWithRevocation(i, c, d, () => d.drive.metadata(pending!.fileId, c.accessToken));
            valid(currentFile, pending.fileId);
            if (currentFile.version !== pending.version || currentFile.modifiedTime !== pending.modifiedTime) throw new Error('File changed before embedding.');
            const retry = await d.store.reserveEmbedding(i, now);
            if (retry) {
                await d.store.mutate(i, s => {
                    if (s.job?.lease?.id === lease) {
                        s.job.retryAt = retry;
                        s.job.status = 'waiting';
                        delete s.job.lease;
                    }
                });
                return getWorkspaceStatus(i, options);
            }
            const liveConnection = await d.connection(i);
            const liveState = await d.store.read(i);
            if (liveConnection.id !== c.id || liveConnection.generation !== c.generation || liveState.job?.lease?.id !== lease || liveState.connectionId !== c.id || liveState.generation !== c.generation) throw new Error('Import authorization changed.');
            const vector = validateEmbedding(await d.embed(pending.source.chunks[j.chunkIndex].body));
            pending.embeddings.push(vector);
        }
        const current = await d.connection(i);
        if (current.id !== c.id || current.generation !== c.generation)
            throw new Error('Connection changed.');
        await d.store.mutate(i, s => {
            if (s.job?.lease?.id !== lease || s.connectionId !== c.id || s.generation !== c.generation)
                return;
            const job = s.job;
            delete job.lease;
            delete job.retryAt;
            job.status = 'running';
            job.retries = 0;
            job.pending = pending;
            if (j.pending)
                job.chunkIndex++;
            if (pending.embeddings.length === pending.source.chunks.length) {
                const next = s.sources.filter(v => v.fileId !== pending.fileId && v.source.id !== pending.source.id).concat(pending);
                if (next.length > 3 || next.reduce((n, v) => n + Buffer.byteLength(v.rawExport), 0) > 192 * 1024 || next.reduce((n, v) => n + v.source.chunks.length, 0) > 32)
                    throw new Error('Workspace import limits exceeded.');
                s.sources = next;
                delete job.pending;
                job.chunkIndex = 0;
                job.index++;
                job.completed++;
                if (job.index === job.fileIds.length)
                    job.status = 'complete';
            }
            else if (pending.source.chunks.length > 32)
                throw new Error('Chunk budget exceeded.');
        });
    }
    catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        await d.store.mutate(i, s => {
            if (s.job?.lease?.id !== lease)
                return;
            const job = s.job;
            delete job.lease;
            const e = error as Error & {
                status?: number;
                retryAfter?: number;
            };
            if ((e.status === 429 || [500, 502, 503, 504].includes(e.status ?? 0)) && job.retries < 2) {
                job.retries++;
                job.retryAt = now + Math.max(13000, e.retryAfter ?? 0);
                job.status = 'waiting';
            }
            else {
                job.status = 'failed';
                job.failed = job.fileIds.length - job.completed;
                job.error = 'Import failed. Check file registration, permissions and limits.';
                delete job.pending;
            }
        });
    }
    return getWorkspaceStatus(i, options);
}
export async function authorizedWorkspaceSources(i: BriefIdentity, options: WorkspaceImportDeps = {}): Promise<WorkspaceSource[]> {
    const d = deps(options), c = await d.connection(i), s = await d.store.read(i);
    if (s.connectionId !== c.id || s.generation !== c.generation)
        return [];
    for (const source of s.sources) {
        if (!d.registry.some(r => r.fileId === source.fileId && r.sourceId === source.source.id && r.subject === c.subject))
            throw new Error('Source registration removed.');
        try {
            const m = await driveWithRevocation(i, c, d, () => d.drive.metadata(source.fileId, c.accessToken));
            valid(m, source.fileId);
            if (m.version !== source.version || m.modifiedTime !== source.modifiedTime)
                throw new ApiError(409, 'Imported evidence is stale; reimport the selected file.');
        } catch (error) {
            const status = error instanceof Error && 'status' in error ? error.status : undefined;
            if ([403, 404, 409].includes(Number(status))) {
                await d.store.mutate(i, state => {
                    if (state.connectionId !== c.id || state.generation !== c.generation) return;
                    state.sources = state.sources.filter(v => v.fileId !== source.fileId);
                    if (state.job?.pending?.fileId === source.fileId) {
                        state.job.status = 'failed'; state.job.failed = state.job.fileIds.length - state.job.completed;
                        delete state.job.pending; delete state.job.lease;
                    }
                });
            }
            throw error;
        }
    }
    const after = await d.connection(i), latest = await d.store.read(i);
    if (after.id !== c.id || after.generation !== c.generation || latest.generation !== s.generation || latest.connectionId !== s.connectionId || JSON.stringify(latest.sources) !== JSON.stringify(s.sources))
        throw new Error('Workspace evidence changed.');
    return s.sources;
}
export async function getWorkspaceStatus(i: BriefIdentity, options: WorkspaceImportDeps = {}) {
    const d = { store: options.store ?? getWorkspaceStore(), connection: options.connection ?? getWorkspaceConnection };
    const s = await d.store.read(i);
    let connection: WorkspaceConnection | undefined;
    try {
        connection = await d.connection(i);
    }
    catch (error) {
        if (!(error instanceof ApiError) || ![401, 403, 409, 503].includes(error.status)) throw error;
        return { connected: false, sources: [], cleanup: 'Connection unavailable; imported evidence is hidden.' };
    }
    const visible = s.connectionId === connection.id && s.generation === connection.generation ? s.sources : [];
    const status = s.job?.status === 'complete' ? 'completed' : s.job?.status === 'failed' ? 'partially_failed' : s.job?.status === 'cancelled' ? 'cancelled' : s.job?.pending ? 'indexing' : 'exporting';
    return {
        connected: true, expiresAt: connection.expiresAt, sources: visible.map(v => ({
            id: v.source.id, title: v.source.title, fileId: v.fileId, modifiedTime: v.modifiedTime, importedAt: v.importedAt, recordedAt: v.source.recordedAt, effectiveAt: v.source.effectiveAt, chunkCount: v.source.chunkCount
        })), job: s.job ? {
            status, total: s.job.fileIds.length, completed: s.job.completed, failed: s.job.failed, searchable: visible.length, retryAt: s.job.retryAt, error: s.job.error
        } : undefined
    };
}
export async function cancelWorkspaceImport(i: BriefIdentity, options: WorkspaceImportDeps = {}) {
    const d = { store: options.store ?? getWorkspaceStore() };
    await d.store.mutate(i, s => {
        if (s.job) {
            s.job.status = 'cancelled';
            delete s.job.pending;
            delete s.job.lease;
        }
    });
    return getWorkspaceStatus(i, options);
}
export async function clearWorkspaceImports(i: BriefIdentity, options: WorkspaceImportDeps = {}, expectedConnectionId?: string | null) {
    const d = { store: options.store ?? getWorkspaceStore() };
    const cleared = await d.store.mutate(i, s => {
        if (expectedConnectionId !== undefined && (s.connectionId ?? null) !== expectedConnectionId) return false;
        s.sources = [];
        delete s.job;
        delete s.connectionId;
        s.generation++;
        return true;
    });
    return {
        cleared, skipped: !cleared
    };
}
export { getWorkspaceStore } from './workspace-store';
export type { WorkspaceSource, WorkspaceStore, WorkspaceState } from './workspace-store';
