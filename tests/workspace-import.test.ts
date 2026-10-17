import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../src/lib/access';
import { SyntheticSeedAdapter } from '../src/lib/sources';
import { InMemoryWorkspaceStore, FirestoreWorkspaceStore } from '../src/lib/workspace-store';
import type { Firestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { authorizedWorkspaceSources, cancelWorkspaceImport, clearWorkspaceImports, parseWorkspaceCsv, startWorkspaceImport, stepWorkspaceImport, type WorkspaceImportDeps, type DriveMetadata } from '../src/lib/workspace-import';
const owner = {
    tenantId: 'tenant-a', uid: 'one'
};
async function fixture() {
    const [source] = await new SyntheticSeedAdapter().list(['HBR-DOC-02']);
    let time = 100000;
    let version = '1';
    let text = source.content;
    let calls = 0;
    const store = new InMemoryWorkspaceStore();
    const connection = {
        id: 'connection', generation: 1, subject: 'google-one', expiresAt: 999999, accessToken: 'secret'
    };
    const metadata: DriveMetadata = {
        id: 'file-one', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-10-11T00:00:00Z', version: '1', ownedByMe: true
    };
    const deps: WorkspaceImportDeps = {
        store, registry: [{
                fileId: 'file-one', sourceId: source.id, subject: connection.subject
            }], connection: async () => connection, now: () => time, drive: {
            metadata: async () => ({
                ...metadata, version
            }), export: async () => text
        }, embed: async () => {
            calls++;
            return Array.from({length:768},(_,n)=>n===0?1:0);
        }
    };
    return {
        deps, store, metadata, source, connection, setText: (v: string) => {
            text = v;
        }, tick: () => {
            time += 32000;
        }, setVersion: (v: string) => {
            version = v;
        }, calls: () => calls
    };
}
async function finish(f: Awaited<ReturnType<typeof fixture>>) {
    await startWorkspaceImport(owner, ['file-one'], f.deps);
    for (let n = 0; n < 20; n++) {
        const s = await stepWorkspaceImport(owner, f.deps);
        if (s.job?.status === 'completed')
            return s;
        f.tick();
    }
    throw new Error('Job did not finish.');
}
describe('bounded Workspace import', () => {
    it('does not revoke Google consent or delete existing copies for a Vertex embedding 401', async () => {
        const f = await fixture();
        await finish(f);
        const previous = (await f.store.read(owner)).sources;
        f.setText(f.source.content + '\n');
        f.deps.disconnect = vi.fn();
        f.deps.embed = async () => { throw Object.assign(new Error('Embedding authentication failed.'), { status: 401 }); };
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        await stepWorkspaceImport(owner, f.deps);
        f.tick();
        const result = await stepWorkspaceImport(owner, f.deps);
        expect(result.job?.status).toBe('partially_failed');
        expect(f.deps.disconnect).not.toHaveBeenCalled();
        expect((await f.store.read(owner)).sources).toEqual(previous);
    });
    it('still clears revoked-connection copies if disconnect finalization fails', async () => {
        const f = await fixture();
        await finish(f);
        f.deps.drive!.metadata = async () => { throw Object.assign(new Error('Revoked.'), { status: 401 }); };
        f.deps.disconnect = async () => { throw new Error('Disconnect finalization unavailable.'); };
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toThrow('Disconnect finalization unavailable.');
        expect((await f.store.read(owner)).sources).toEqual([]);
        expect((await f.store.read(owner)).job).toBeUndefined();
    });
    it('preserves a newer connection when an old Drive request returns 401', async () => {
        const f = await fixture();
        await finish(f);
        f.deps.drive!.metadata = async () => {
            await f.store.mutate(owner, s => { s.connectionId = 'replacement'; s.generation = 2; });
            throw Object.assign(new Error('Old credential revoked.'), { status: 401 });
        };
        f.deps.disconnect = vi.fn(async () => ({ revocation: 'unconfirmed' as const, connectionId: f.connection.id }));
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toMatchObject({ status: 401 });
        expect(f.deps.disconnect).toHaveBeenCalledExactlyOnceWith(owner, { id: 'connection', generation: 1 });
        const stored = await f.store.read(owner);
        expect(stored.connectionId).toBe('replacement');
        expect(stored.sources).toHaveLength(1);
    });
    it('keeps access disabled and permits cleanup retry after revoked-copy deletion fails', async () => {
        const f = await fixture();
        await finish(f);
        let disabled = false;
        f.deps.disconnect = async () => { disabled = true; return { revocation: 'unconfirmed' as const, connectionId: f.connection.id }; };
        f.deps.connection = async () => { if (disabled) throw new ApiError(401, 'Reconnect required.'); return f.connection; };
        f.deps.drive!.metadata = async () => { throw Object.assign(new Error('Revoked.'), { status: 401 }); };
        f.deps.store = { read: i => f.store.read(i), reserveEmbedding: (i, now) => f.store.reserveEmbedding(i, now),
            mutate: async () => { throw new Error('Copy cleanup unavailable.'); } };
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toThrow('Copy cleanup unavailable.');
        expect(disabled).toBe(true);
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toMatchObject({ status: 401 });
        expect((await f.store.read(owner)).sources).toHaveLength(1);
        await clearWorkspaceImports(owner, { store: f.store }, f.connection.id);
        expect((await f.store.read(owner)).sources).toEqual([]);
    });
    it.each(['metadata', 'export', 'retrieval'] as const)('disables a revoked connection and deletes its copies on provider 401 during %s', async stage => {
        const f = await fixture();
        if (stage === 'retrieval') await finish(f);
        else await startWorkspaceImport(owner, ['file-one'], f.deps);
        let disabled = false;
        const disconnect = vi.fn(async () => {
            disabled = true;
            return { revocation: 'unconfirmed' as const, connectionId: f.connection.id };
        });
        f.deps.disconnect = disconnect;
        f.deps.connection = async () => {
            if (disabled) throw new ApiError(401, 'Reconnect Workspace before continuing.');
            return f.connection;
        };
        const denied = Object.assign(new Error('Provider rejected credential.'), { status: 401 });
        if (stage === 'export') f.deps.drive!.export = async () => { throw denied; };
        else f.deps.drive!.metadata = async () => { throw denied; };
        const attempts = (await f.store.read(owner)).usage.attempts.length;
        const operation = stage === 'retrieval' ? authorizedWorkspaceSources : stepWorkspaceImport;
        await expect(operation(owner, f.deps)).rejects.toMatchObject({ status: 401 });
        expect(disconnect).toHaveBeenCalledExactlyOnceWith(owner, { id: f.connection.id, generation: f.connection.generation });
        const stored = await f.store.read(owner);
        expect(stored.sources).toEqual([]);
        expect(stored.job).toBeUndefined();
        expect(stored.usage.attempts).toHaveLength(attempts);
        expect(disabled).toBe(true);
    });
    it('does not start an export after cancellation during metadata lookup', async () => {
        const f = await fixture();
        let release!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        let entered!: () => void;
        const metadataStarted = new Promise<void>(resolve => { entered = resolve; });
        let exports = 0;
        f.deps.drive!.metadata = async () => { entered(); await waiting; return f.metadata; };
        f.deps.drive!.export = async () => { exports++; return f.source.content; };
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        const step = stepWorkspaceImport(owner, f.deps);
        await metadataStarted;
        await cancelWorkspaceImport(owner, f.deps);
        release();
        await step;
        expect(exports).toBe(0);
        expect(f.calls()).toBe(0);
        expect((await f.store.read(owner)).job?.status).toBe('cancelled');
        expect((await f.store.read(owner)).sources).toEqual([]);
    });
    it('compares normalized Doc transport but retains literal exported line endings for citations', async () => {
        const f = await fixture();
        const actual = '\uFEFF' + f.source.content.replace(/\n/g, '\r\n');
        f.setText(actual);
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        await stepWorkspaceImport(owner, f.deps);
        const pending = (await f.store.read(owner)).job?.pending;
        expect(pending?.rawExport).toBe(actual);
        expect(pending?.source.content).toBe(actual);
        expect(pending?.source.chunks.every(chunk => actual.includes(chunk.body))).toBe(true);
    });
    it('accepts native Docs blank paragraph serialization and keeps literal text', async () => {
        const f = await fixture();
        const actual = f.source.content.replace(/\n\n/g, '\n\n\n');
        f.setText(actual);
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        await stepWorkspaceImport(owner, f.deps);
        const pending = (await f.store.read(owner)).job?.pending;
        expect(pending?.rawExport).toBe(actual);
        expect(pending?.source.content).toBe(actual);
        expect(pending?.source.chunks.every(chunk => actual.includes(chunk.body))).toBe(true);
    });
    it('accepts a literal first-tab synthetic Sheet and rejects appended other-tab content', async () => {
        const [sheet] = await new SyntheticSeedAdapter().list(['HBR-SHEET-01']);
        const csv = await readFile('seed/generated/sheets/HBR-SHEET-01-milestone-tracker.csv', 'utf8');
        for (const appended of ['', '\nInjected,other,tab']) {
            const f = await fixture();
            f.deps.registry = [{ fileId: 'file-one', sourceId: sheet.id, subject: f.connection.subject }];
            f.metadata.mimeType = 'application/vnd.google-apps.spreadsheet';
            f.setText(csv + appended);
            await startWorkspaceImport(owner, ['file-one'], f.deps);
            const exported = await stepWorkspaceImport(owner, f.deps);
            if (appended) {
                expect(exported.job?.status).toBe('partially_failed');
                expect(f.calls()).toBe(0);
            } else {
                expect(exported.job?.status).toBe('indexing');
                expect((await f.store.read(owner)).job?.pending?.rawExport).toBe(csv);
                expect((await f.store.read(owner)).job?.pending?.source.recordedAt).toBe(sheet.recordedAt);
            }
        }
    });
    it('counts failed attempts and retries at most twice after provider backoff', async () => {
        const f = await fixture();
        f.deps.embed = async () => { throw Object.assign(new Error('Provider quota'), { status:429, retryAfter:50000 }); };
        await startWorkspaceImport(owner,['file-one'],f.deps);
        await stepWorkspaceImport(owner,f.deps);
        let result = await stepWorkspaceImport(owner,f.deps);
        expect(result.job?.retryAt).toBe(150000);
        expect((await f.store.read(owner)).usage.attempts).toHaveLength(1);
        await stepWorkspaceImport(owner,f.deps);
        expect((await f.store.read(owner)).usage.attempts).toHaveLength(1);
        for(let retry=0;retry<2;retry++) { f.tick();f.tick();result=await stepWorkspaceImport(owner,f.deps); }
        expect(result.job?.status).toBe('partially_failed');
        const state=await f.store.read(owner);
        expect(state.usage.attempts).toHaveLength(3);
        expect(state.sources).toHaveLength(0);
    });
    it('does not let old disconnect cleanup erase a new connection', async () => {
        const f = await fixture(); await finish(f);
        await f.store.mutate(owner, s => { s.connectionId = 'new-connection'; });
        expect(await clearWorkspaceImports(owner, f.deps, 'connection')).toEqual({cleared:false, skipped:true});
        expect((await f.store.read(owner)).sources).toHaveLength(1);
    });
    it('invalidates stale evidence only within its connection', async () => {
        const f = await fixture(); await finish(f); f.setVersion('changed');
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toThrow('stale');
        expect((await f.store.read(owner)).sources).toHaveLength(0);
    });
    it('encodes Firestore vectors without nested arrays and restores them', async () => {
        const f = await fixture(); await finish(f);
        const state = await f.store.read(owner);
        const data = new Map<string, unknown>();
        const noNestedArrays = (value: unknown, parentArray = false): void => {
            if (Array.isArray(value)) { if (parentArray) throw new Error('Firestore nested array'); value.forEach(v => noNestedArrays(v, true)); }
            else if (value && typeof value === 'object') Object.values(value).forEach(v => noNestedArrays(v));
        };
        const ref = (key: string) => ({ key, get: async () => ({ exists: data.has(key), data: () => structuredClone(data.get(key)) }) });
        const database = { doc: ref, runTransaction: async (fn: (t: unknown) => unknown) => fn({
            get: async (reference: ReturnType<typeof ref>) => reference.get(),
            set: (reference: ReturnType<typeof ref>, value: unknown) => { noNestedArrays(value); data.set(reference.key, structuredClone(value)); },
        }) } as unknown as Firestore;
        const store = new FirestoreWorkspaceStore(database);
        await store.mutate(owner, s => { Object.assign(s, state); });
        expect(await store.read(owner)).toEqual(state);
    });
    it('rechecks file permission and version before embedding', async () => {
        const f = await fixture();
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        await stepWorkspaceImport(owner, f.deps);
        f.setVersion('changed');
        expect((await stepWorkspaceImport(owner, f.deps)).job?.status).toBe('partially_failed');
        expect(f.calls()).toBe(0);
    });
    it('serializes concurrent starts and quota reservations', async () => {
        const f = await fixture();
        const results = await Promise.allSettled([startWorkspaceImport(owner, ['file-one'], f.deps), startWorkspaceImport(owner, ['file-one'], f.deps)]);
        expect(results.filter(v => v.status === 'fulfilled')).toHaveLength(2);
        expect((await f.store.read(owner)).usage.files).toHaveLength(1);
        const quota = await Promise.all([f.store.reserveEmbedding(owner, 100000), f.store.reserveEmbedding(owner, 100000)]);
        expect(quota.filter(v => v === null)).toHaveLength(1);
        expect((await f.store.read(owner)).usage.attempts).toHaveLength(1);
    });
    it('clear prevents a pending export from resurrecting evidence', async () => {
        const f = await fixture();
        let release!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        let entered!: () => void;
        const exporting = new Promise<void>(resolve => { entered = resolve; });
        f.deps.drive!.export = async () => { entered(); await waiting; return f.source.content; };
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        const step = stepWorkspaceImport(owner, f.deps);
        await exporting;
        await clearWorkspaceImports(owner, f.deps);
        release();
        await step;
        const state = await f.store.read(owner);
        expect(state.sources).toEqual([]);
        expect(state.job).toBeUndefined();
    });
    it('reuses verified unchanged embeddings on repeated import', async () => {
        const f = await fixture();
        await finish(f);
        const count = f.calls();
        await finish(f);
        expect(f.calls()).toBe(count);
    });
    it('refreshes changed Drive metadata without reembedding unchanged content', async () => {
        const f = await fixture();
        await finish(f);
        const count = f.calls();
        f.setVersion('renamed-version');
        await finish(f);
        expect(f.calls()).toBe(count);
        expect((await authorizedWorkspaceSources(owner, f.deps))[0].version).toBe('renamed-version');
    });
    it('imports only deterministic content, isolates owners, and checks current versions', async () => {
        const f = await fixture();
        await finish(f);
        expect((await authorizedWorkspaceSources(owner, f.deps))[0].source.id).toBe('HBR-DOC-02');
        expect(await authorizedWorkspaceSources({
            ...owner, uid: 'two'
        }, f.deps)).toEqual([]);
        f.setVersion('2');
        await expect(authorizedWorkspaceSources(owner, f.deps)).rejects.toThrow('stale');
    });
    it('rejects modified content before embedding', async () => {
        const f = await fixture();
        f.setText(f.source.content + 'Forged approval');
        await startWorkspaceImport(owner, ['file-one'], f.deps);
        expect((await stepWorkspaceImport(owner, f.deps)).job?.status).toBe('partially_failed');
        expect(f.calls()).toBe(0);
        expect(await authorizedWorkspaceSources(owner, f.deps)).toEqual([]);
    });
    it('rejects non-owned metadata and oversized exports before embedding', async () => {
        for (const mode of ['owner', 'size']) {
            const f = await fixture();
            if (mode === 'owner')
                f.metadata.ownedByMe = false;
            else
                f.setText('x'.repeat(65537));
            await startWorkspaceImport(owner, ['file-one'], f.deps);
            expect((await stepWorkspaceImport(owner, f.deps)).job?.status).toBe('partially_failed');
            expect(f.calls()).toBe(0);
        }
    });
    it('clear removes evidence and preserves quota', async () => {
        const f = await fixture();
        await finish(f);
        await clearWorkspaceImports(owner, f.deps);
        expect(await authorizedWorkspaceSources(owner, f.deps)).toEqual([]);
        const state = await f.store.read(owner);
        expect(state.job).toBeUndefined();
        expect(state.usage.files).toHaveLength(1);
        expect(state.usage.attempts.length).toBeGreaterThan(0);
    });
    it('paces global attempts and retains daily failure budgets', async () => {
        const store = new InMemoryWorkspaceStore();
        expect(await store.reserveEmbedding(owner, 100000)).toBeNull();
        expect(await store.reserveEmbedding({
            ...owner, uid: 'two'
        }, 100001)).toBe(131000);
        for (let n = 1; n < 64; n++)
            expect(await store.reserveEmbedding(owner, 100000 + n * 32000)).toBeNull();
        await expect(store.reserveEmbedding(owner, 4000000)).rejects.toThrow('budget');
    });
    it('parses CSV without dropping empty evidence cells or rows', () => {
        expect(parseWorkspaceCsv('a,b\r\n"x,y","z""q"\r\n,\r\n')).toEqual([['a', 'b'], ['x,y', 'z"q'], ['', '']]);
        expect(() => parseWorkspaceCsv('"x"suffix')).toThrow();
    });
});


