import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { DEMO_TENANT_ID, SourceRecordSchema, type SourceRecord, type IngestionStore } from './sources';
import { getDatabase } from './firebase';

const SOURCE_ID = /^[A-Z0-9-]{1,64}$/;
const INGESTIONS_PER_MINUTE = 5;

function isDemoTenant(tenantId: string): boolean { return tenantId === DEMO_TENANT_ID; }

function parseSource(value: unknown): SourceRecord { return SourceRecordSchema.parse(value); }

export class FileSourceStore implements IngestionStore {
  constructor(private readonly directory: string) {}

  private async locked<T>(action: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    const release = await lockfile.lock(this.directory, { retries: { retries: 10, minTimeout: 20 }, stale: 30_000 });
    try { return await action(); } finally { await release(); }
  }

  async get(tenantId: string, sourceId: string): Promise<SourceRecord | null> {
    if (!isDemoTenant(tenantId) || !SOURCE_ID.test(sourceId)) return null;
    try {
      const source = parseSource(JSON.parse(await readFile(path.join(this.directory, `${sourceId}.json`), 'utf8')));
      if (source.tenantId !== tenantId || source.id !== sourceId) throw new Error('Stored source provenance mismatch.');
      return source;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(tenantId: string): Promise<SourceRecord[]> {
    if (!isDemoTenant(tenantId)) return [];
    let files: string[];
    try { files = await readdir(this.directory); } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    const ids = files.filter(file => /^[A-Z0-9-]{1,64}\.json$/.test(file)).map(file => file.slice(0, -5)).sort();
    const sources = await Promise.all(ids.map(id => this.get(tenantId, id)));
    return sources.filter((source): source is SourceRecord => source !== null);
  }

  async upsert(source: SourceRecord): Promise<'processed' | 'skipped'> {
    const validated = parseSource(source);
    return this.locked(async () => {
      if (JSON.stringify(await this.get(validated.tenantId, validated.id)) === JSON.stringify(validated)) return 'skipped';
      const target = path.join(this.directory, `${validated.id}.json`);
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(validated), { mode: 0o600 });
      await rename(temporary, target);
      return 'processed';
    });
  }

  async consumeIngestionQuota(principal: string, now = Date.now()): Promise<boolean> {
    return this.locked(async () => {
      const target = path.join(this.directory, 'quota.json');
      let quota: { window: number; counts: Record<string, number> } = { window: Math.floor(now / 60_000), counts: {} };
      try { quota = z.object({ window: z.number().int(), counts: z.record(z.string(), z.number().int().nonnegative()) }).parse(JSON.parse(await readFile(target, 'utf8'))); } catch (error: unknown) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      const window = Math.floor(now / 60_000);
      if (quota.window !== window) quota = { window, counts: {} };
      const key = createHash('sha256').update(principal).digest('hex');
      if ((quota.counts[key] ?? 0) >= INGESTIONS_PER_MINUTE) return false;
      quota.counts[key] = (quota.counts[key] ?? 0) + 1;
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(quota), { mode: 0o600 });
      await rename(temporary, target);
      return true;
    });
  }
}

export class FirestoreSourceStore implements IngestionStore {
  constructor(private readonly database: Firestore = getDatabase()) {}

  async get(tenantId: string, sourceId: string): Promise<SourceRecord | null> {
    if (!isDemoTenant(tenantId) || !SOURCE_ID.test(sourceId)) return null;
    const snapshot = await this.database.doc(`tenants/${tenantId}/sources/${sourceId}`).get();
    if (!snapshot.exists) return null;
    const source = parseSource(snapshot.data());
    if (source.tenantId !== tenantId || source.id !== sourceId) throw new Error('Stored source provenance mismatch.');
    return source;
  }

  async list(tenantId: string): Promise<SourceRecord[]> {
    if (!isDemoTenant(tenantId)) return [];
    const snapshot = await this.database.collection(`tenants/${tenantId}/sources`).limit(192).get();
    return snapshot.docs.map(doc => {
      const source = parseSource(doc.data());
      if (source.tenantId !== tenantId || source.id !== doc.id) throw new Error('Stored source provenance mismatch.');
      return source;
    }).sort((a, b) => a.id.localeCompare(b.id));
  }

  async upsert(source: SourceRecord): Promise<'processed' | 'skipped'> {
    const validated = parseSource(source);
    // Store the bounded source and its chunks atomically; replacement cannot leave stale chunks.
    const reference = this.database.doc(`tenants/${validated.tenantId}/sources/${validated.id}`);
    return this.database.runTransaction(async transaction => {
      const existing = await transaction.get(reference);
      if (existing.exists && JSON.stringify(parseSource(existing.data())) === JSON.stringify(validated)) return 'skipped';
      transaction.set(reference, JSON.parse(JSON.stringify(validated)));
      return 'processed';
    });
  }

  async consumeIngestionQuota(principal: string, now = Date.now()): Promise<boolean> {
    const key = createHash('sha256').update(principal).digest('hex');
    const reference = this.database.doc(`tenants/${DEMO_TENANT_ID}/ingestionQuotas/${key}`);
    return this.database.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const window = Math.floor(now / 60_000);
      const count = snapshot.data()?.window === window ? Number(snapshot.data()?.count ?? 0) : 0;
      if (count >= INGESTIONS_PER_MINUTE) return false;
      transaction.set(reference, { window, count: count + 1 });
      return true;
    });
  }
}

export function getSourceStore(): IngestionStore {
  const mode = process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file');
  if (mode === 'firestore') return new FirestoreSourceStore();
  if (mode !== 'file' || process.env.K_SERVICE) throw new Error('Cloud Run requires Firestore storage.');
  return new FileSourceStore(path.resolve(process.env.KNOWBRIDGE_DATA_DIR ?? '.data/sources'));
}
