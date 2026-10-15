import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const DEMO_TENANT_ID = 'demo-north-quay';
const HARBOUR_PROJECT_ID = 'HBR';
export const MAX_INGESTION_SOURCES = 64;
export type SyntheticCorpus = 'harbour' | 'evaluation';
const WORDS_PER_CHUNK = 600;
const SOURCE_ID_PATTERN = /^[A-Z0-9-]{1,64}$/;
const SEED_ROOT = path.resolve(process.cwd(), 'seed', 'generated');

const manifestEntrySchema = z.object({
  id: z.string().regex(SOURCE_ID_PATTERN),
  title: z.string().min(1),
  kind: z.enum(['google_doc', 'google_sheet']),
  project: z.string().min(1),
  department: z.string().optional(),
  owner: z.string().min(1),
  modified_at: z.iso.date(),
  file: z.string().min(1),
  synthetic: z.literal(true),
  visibility: z.literal('internal'),
});

const manifestSchema = z.array(manifestEntrySchema);
type ManifestEntry = z.infer<typeof manifestEntrySchema>;

export interface SourceChunk {
  id: string;
  sourceId: string;
  title: string;
  recordedAt: string;
  effectiveAt: string | null;
  projectId: string;
  ordinal: number;
  checksum: string;
  body: string;
  tenantId: typeof DEMO_TENANT_ID;
}

export interface SourceRecord {
  id: string;
  title: string;
  kind: 'google_doc' | 'google_sheet';
  project: string;
  projectId: string;
  department?: string;
  owner: string;
  recordedAt: string;
  effectiveAt: string | null;
  sourceUrl: string;
  chunkCount: number;
  chunks: SourceChunk[];
  contentHash: string;
  content: string;
  tenantId: typeof DEMO_TENANT_ID;
  synthetic: true;
}

export type SourceSummary = Pick<
  SourceRecord,
  'id' | 'title' | 'kind' | 'project' | 'recordedAt' | 'sourceUrl' | 'chunkCount'
>;

export interface SourceAdapter {
  list(sourceIds?: string[]): Promise<SourceRecord[]>;
}

export interface IngestionStore {
  get(tenantId: string, sourceId: string): Promise<SourceRecord | null>;
  list(tenantId: string): Promise<SourceRecord[]>;
  upsert(source: SourceRecord): Promise<'processed' | 'skipped'>;
  consumeIngestionQuota(principal: string, now?: number): Promise<boolean>;
}

export interface IngestionResult {
  jobId: string;
  queued: number;
  processed: number;
  skipped: number;
  failed: number;
}

export class InMemoryIngestionStore implements IngestionStore {
  private readonly sources = new Map<string, SourceRecord>();

  getContentHash(tenantId: string, sourceId: string): string | undefined {
    return this.getSource(tenantId, sourceId)?.contentHash;
  }

  getSource(tenantId: string, sourceId: string): SourceRecord | undefined {
    return this.sources.get(`${tenantId}:${sourceId}`);
  }

  put(source: SourceRecord): void {
    this.sources.set(`${source.tenantId}:${source.id}`, source);
  }
  async get(tenantId: string, sourceId: string): Promise<SourceRecord | null> {
    return this.getSource(tenantId, sourceId) ?? null;
  }
  async list(tenantId: string): Promise<SourceRecord[]> {
    return [...this.sources.values()].filter(source => source.tenantId === tenantId);
  }
  async upsert(source: SourceRecord): Promise<'processed' | 'skipped'> {
    if (JSON.stringify(this.getSource(source.tenantId, source.id)) === JSON.stringify(source)) return 'skipped';
    this.put(source);
    return 'processed';
  }
  async consumeIngestionQuota(): Promise<boolean> { return true; }
}

const dateSchema = z.iso.date();
const chunkSchema = z.object({
  id: z.string(), sourceId: z.string().regex(SOURCE_ID_PATTERN), title: z.string(),
  recordedAt: dateSchema, effectiveAt: dateSchema.nullable(), projectId: z.string(),
  ordinal: z.number().int().nonnegative(), checksum: z.string(), body: z.string().min(1),
  tenantId: z.literal(DEMO_TENANT_ID),
});
export const SourceRecordSchema = z.object({
  id: z.string().regex(SOURCE_ID_PATTERN), title: z.string().min(1),
  kind: z.enum(['google_doc', 'google_sheet']), project: z.string(), projectId: z.string(),
  department: z.string().optional(), owner: z.string(), recordedAt: dateSchema,
  effectiveAt: dateSchema.nullable(), sourceUrl: z.string(), chunkCount: z.number().int().positive(),
  chunks: z.array(chunkSchema).min(1), contentHash: z.string(), content: z.string().min(1),
  tenantId: z.literal(DEMO_TENANT_ID), synthetic: z.literal(true),
}).superRefine((source, context) => {
  if (source.contentHash !== sha256(source.content) || source.sourceUrl !== `/api/sources/${source.id}` || source.chunks.some(chunk =>
    chunk.checksum !== sha256(chunk.body) || !source.content.includes(chunk.body) ||
    chunk.title !== source.title || chunk.recordedAt !== source.recordedAt ||
    chunk.effectiveAt !== source.effectiveAt || chunk.projectId !== source.projectId)) {
    context.addIssue({ code: 'custom', message: 'Invalid stored evidence integrity.' });
  }
  if (source.chunkCount !== source.chunks.length || source.chunks.some((chunk, ordinal) =>
    chunk.sourceId !== source.id || chunk.ordinal !== ordinal || chunk.id !== `${source.id}:${ordinal}`)) {
    context.addIssue({ code: 'custom', message: 'Invalid chunk provenance.' });
  }
});

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function resolveManifestPath(relativePath: string): string {
  const resolved = path.resolve(SEED_ROOT, relativePath);
  const relative = path.relative(SEED_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Synthetic source path escapes the seed directory.');
  }
  return resolved;
}

async function selectCorpusEntries(entries: ManifestEntry[], corpus: SyntheticCorpus): Promise<ManifestEntry[]> {
  if (corpus === 'harbour') return entries.filter(entry => entry.project === HARBOUR_PROJECT_ID);
  if (corpus !== 'evaluation') throw new Error('Invalid synthetic corpus.');
  const fixtures = z.array(z.object({ required_source_ids: z.array(z.string().regex(SOURCE_ID_PATTERN)) }))
    .parse(JSON.parse(await readFile(path.join(SEED_ROOT, 'evaluation.json'), 'utf8')));
  const required = new Set([...fixtures.flatMap(item => item.required_source_ids), 'POL-DOC-01-V1']);
  if ([...required].some(id => !entries.some(entry => entry.id === id))) throw new Error('Evaluation source is missing from manifest.');
  const selected = entries.filter(entry => entry.project === HARBOUR_PROJECT_ID || required.has(entry.id));
  if (selected.length > MAX_INGESTION_SOURCES) throw new Error('Evaluation corpus exceeds ingestion bound.');
  return selected.sort((a, b) => a.id.localeCompare(b.id));
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let isQuoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && isQuoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      isQuoted = !isQuoted;
    } else if (character === ',' && !isQuoted) {
      row = [...row, field];
      field = '';
    } else if ((character === '\n' || character === '\r') && !isQuoted) {
      if (character === '\r' && next === '\n') index += 1;
      rows.push([...row, field]);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (isQuoted) throw new Error('Unterminated CSV quotation.');
  if (field.length > 0 || row.length > 0) rows.push([...row, field]);
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

export function contextualizeCsv(csv: string): string {
  const [headers = [], ...rows] = parseCsv(csv);
  if (!headers.length || rows.some(row => row.length !== headers.length)) throw new Error('Invalid CSV columns.');
  return rows.map((row, rowIndex) => [
    `Row ${rowIndex + 1}`,
    ...headers.map((header, columnIndex) => `${header}: ${row[columnIndex] ?? ''}`),
  ].join('\n')).join('\n\n');
}

export function splitIntoBodies(content: string, wordsPerChunk = WORDS_PER_CHUNK): string[] {
  if (!Number.isInteger(wordsPerChunk) || wordsPerChunk < 1) throw new Error('Invalid chunk word budget.');
  const blocks = [...content.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)].flatMap(match => {
    const words = [...match[0].matchAll(/\S+/g)];
    const ranges: { start: number; end: number; words: number }[] = [];
    for (let index = 0; index < words.length; index += wordsPerChunk) {
      const lastIndex = Math.min(index + wordsPerChunk, words.length) - 1;
      ranges.push({ start: match.index! + words[index].index!, end: match.index! + words[lastIndex].index! + words[lastIndex][0].length, words: lastIndex - index + 1 });
    }
    return ranges;
  });
  const chunks: string[] = [];
  let start = -1;
  let end = 0;
  let currentWords = 0;
  for (const block of blocks) {
    if (start >= 0 && currentWords + block.words > wordsPerChunk) {
      chunks.push(content.slice(start, end));
      start = -1;
      currentWords = 0;
    }
    if (start < 0) start = block.start;
    end = block.end;
    currentWords += block.words;
  }
  if (start >= 0) chunks.push(content.slice(start, end));
  if (!chunks.length) throw new Error('Source content is empty.');
  return chunks;
}

function createChunks(source: Omit<SourceRecord, 'chunks' | 'chunkCount'>): SourceChunk[] {
  // Contextualized sheet rows contain token-dense dates and numbers; use a smaller word budget.
  return splitIntoBodies(source.content, source.kind === 'google_sheet' ? 300 : WORDS_PER_CHUNK).map((body, index) => ({
    id: `${source.id}:${index}`,
    sourceId: source.id,
    title: source.title,
    recordedAt: source.recordedAt,
    effectiveAt: source.effectiveAt,
    projectId: source.projectId,
    ordinal: index,
    checksum: sha256(body),
    body,
    tenantId: source.tenantId,
  }));
}

export function extractEffectiveDate(content: string): string | null {
  const date = content.match(/^Effective date:\s*(\d{4}-\d{2}-\d{2})\s*$/im)?.[1];
  return date ? dateSchema.parse(date) : null;
}

async function readSource(entry: ManifestEntry): Promise<SourceRecord> {
  const resolved = await realpath(resolveManifestPath(entry.file));
  const relative = path.relative(await realpath(SEED_ROOT), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Source symlink escapes seed directory.');
  const rawContent = await readFile(resolved, 'utf8');
  const content = entry.kind === 'google_sheet' ? contextualizeCsv(rawContent) : rawContent;
  const base = {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    project: entry.project,
    projectId: entry.project,
    department: entry.department,
    owner: entry.owner,
    recordedAt: rawContent.match(/^Recorded date:\s*(\d{4}-\d{2}-\d{2})\s*$/im)?.[1] ?? entry.modified_at,
    effectiveAt: extractEffectiveDate(content),
    sourceUrl: `/api/sources/${encodeURIComponent(entry.id)}`,
    contentHash: sha256(content),
    content,
    tenantId: DEMO_TENANT_ID as typeof DEMO_TENANT_ID,
    synthetic: true as const,
  };
  const chunks = createChunks(base);
  return SourceRecordSchema.parse({ ...base, chunks, chunkCount: chunks.length });
}

async function readManifest(): Promise<ManifestEntry[]> {
  const manifestText = await readFile(path.join(SEED_ROOT, 'manifest.json'), 'utf8');
  return manifestSchema.parse(JSON.parse(manifestText));
}

export class SyntheticSeedAdapter implements SourceAdapter {
  constructor(private readonly corpus: SyntheticCorpus = 'harbour') {}

  async list(sourceIds?: string[]): Promise<SourceRecord[]> {
    const entries = await selectCorpusEntries(await readManifest(), this.corpus);
    const selected = sourceIds ? sourceIds.map(id => {
      const entry = entries.find(entry => entry.id === id);
      if (!entry) throw new Error(`Unknown synthetic source ID: ${id}`);
      return entry;
    }) : entries;
    return Promise.all(selected.map(readSource));
  }
}

const syntheticAdapter = new SyntheticSeedAdapter();

export async function loadSyntheticSources(): Promise<SourceRecord[]> {
  return syntheticAdapter.list();
}

export async function ingestSyntheticSources(options: {
  store?: IngestionStore;
  adapter?: SourceAdapter;
  actor?: string;
  sourceIds?: string[];
} = {}): Promise<IngestionResult> {
  const store = options.store ?? (await import('./source-store')).getSourceStore();
  if (options.sourceIds && (!options.sourceIds.length || options.sourceIds.length > MAX_INGESTION_SOURCES || new Set(options.sourceIds).size !== options.sourceIds.length || options.sourceIds.some(id => !SOURCE_ID_PATTERN.test(id)))) {
    throw new Error('Invalid source IDs.');
  }
  const selected = (await (options.adapter ?? syntheticAdapter).list(options.sourceIds)).sort((a, b) => a.id.localeCompare(b.id));
  const jobId = sha256(JSON.stringify(selected)).slice(7, 23);
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  for (const source of selected) {
    try {
      const result = await store.upsert(source);
      if (result === 'skipped') skipped += 1; else processed += 1;
    } catch { failed += 1; }
  }
  return { jobId, queued: selected.length, processed, skipped, failed };
}

export async function listSourceSummariesForTenant(tenantId: string): Promise<SourceSummary[]> {
  if (tenantId !== DEMO_TENANT_ID) return [];
  return (await listSourcesForTenant(tenantId)).map(toSourceSummary);
}

export async function listSourcesForTenant(tenantId: string): Promise<SourceRecord[]> {
  if (tenantId !== DEMO_TENANT_ID) return [];
  const store = (await import('./source-store')).getSourceStore();
  return store.list(tenantId);
}

export async function getSourceForTenant(tenantId: string, sourceId: string): Promise<SourceRecord | null> {
  if (tenantId !== DEMO_TENANT_ID || !SOURCE_ID_PATTERN.test(sourceId)) return null;
  return (await import('./source-store')).getSourceStore().get(tenantId, sourceId);
}

export function toSourceSummary(source: SourceRecord): SourceSummary {
  const { id, title, kind, project, recordedAt, sourceUrl, chunkCount } = source;
  return { id, title, kind, project, recordedAt, sourceUrl, chunkCount };
}
