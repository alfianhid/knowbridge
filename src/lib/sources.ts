import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const DEMO_TENANT_ID = 'demo-north-quay';
const DOCUMENT_LIMIT = 24;
const SHEET_LIMIT = 3;
const APPROXIMATE_WORDS_PER_CHUNK = 500;
const SOURCE_ID_PATTERN = /^[A-Z0-9-]+$/;
const SEED_ROOT = path.resolve(process.cwd(), 'seed', 'generated');

const manifestEntrySchema = z.object({
  id: z.string().regex(SOURCE_ID_PATTERN),
  title: z.string().min(1),
  kind: z.enum(['google_doc', 'google_sheet']),
  project: z.string().min(1),
  department: z.string().optional(),
  owner: z.string().min(1),
  modified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  file: z.string().min(1),
  synthetic: z.literal(true),
  visibility: z.literal('internal'),
});

const manifestSchema = z.array(manifestEntrySchema);
type ManifestEntry = z.infer<typeof manifestEntrySchema>;

export interface SourceRecord {
  id: string;
  title: string;
  kind: 'google_doc' | 'google_sheet';
  project: string;
  department?: string;
  owner: string;
  recordedAt: string;
  sourceUrl: string;
  chunkCount: number;
  contentHash: string;
  content: string;
  tenantId: typeof DEMO_TENANT_ID;
  synthetic: true;
}

export type SourceSummary = Pick<
  SourceRecord,
  'id' | 'title' | 'kind' | 'project' | 'recordedAt' | 'sourceUrl' | 'chunkCount'
>;

function resolveManifestPath(relativePath: string): string {
  const resolved = path.resolve(SEED_ROOT, relativePath);
  const relative = path.relative(SEED_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Synthetic source path escapes the seed directory.');
  }
  return resolved;
}

function selectBoundedEntries(entries: ManifestEntry[]): ManifestEntry[] {
  const documents = entries.filter((entry) => entry.kind === 'google_doc').slice(0, DOCUMENT_LIMIT);
  const sheets = entries.filter((entry) => entry.kind === 'google_sheet').slice(0, SHEET_LIMIT);
  return [...documents, ...sheets];
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
  if (field.length > 0 || row.length > 0) rows.push([...row, field]);
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

function contextualizeCsv(csv: string): string {
  const [headers = [], ...rows] = parseCsv(csv);
  return rows
    .map((row, rowIndex) => [
      `Row ${rowIndex + 1}`,
      ...headers.map((header, columnIndex) => `${header}: ${row[columnIndex] ?? ''}`),
    ].join('\n'))
    .join('\n\n');
}

async function readSource(entry: ManifestEntry): Promise<SourceRecord> {
  const rawContent = await readFile(resolveManifestPath(entry.file), 'utf8');
  const content = entry.kind === 'google_sheet' ? contextualizeCsv(rawContent) : rawContent;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    project: entry.project,
    department: entry.department,
    owner: entry.owner,
    recordedAt: entry.modified_at,
    sourceUrl: `/api/sources/${encodeURIComponent(entry.id)}`,
    chunkCount: Math.max(1, Math.ceil(wordCount / APPROXIMATE_WORDS_PER_CHUNK)),
    contentHash: `sha256:${createHash('sha256').update(content).digest('hex')}`,
    content,
    tenantId: DEMO_TENANT_ID,
    synthetic: true,
  };
}

async function readManifest(): Promise<ManifestEntry[]> {
  const manifestText = await readFile(path.join(SEED_ROOT, 'manifest.json'), 'utf8');
  return manifestSchema.parse(JSON.parse(manifestText));
}

export async function loadSyntheticSources(): Promise<SourceRecord[]> {
  const entries = await readManifest();
  return Promise.all(selectBoundedEntries(entries).map(readSource));
}

export async function listSourceSummariesForTenant(tenantId: string): Promise<SourceSummary[]> {
  if (tenantId !== DEMO_TENANT_ID) return [];
  const entries = selectBoundedEntries(await readManifest());
  const sources = await Promise.all(entries.map(readSource));
  return sources.map(toSourceSummary);
}

export async function listSourcesForTenant(tenantId: string): Promise<SourceRecord[]> {
  if (tenantId !== DEMO_TENANT_ID) return [];
  const sources = await loadSyntheticSources();
  return sources.filter((source) => source.tenantId === tenantId);
}

export async function getSourceForTenant(tenantId: string, sourceId: string): Promise<SourceRecord | null> {
  if (tenantId !== DEMO_TENANT_ID || !SOURCE_ID_PATTERN.test(sourceId)) return null;
  const entry = selectBoundedEntries(await readManifest()).find((candidate) => candidate.id === sourceId);
  return entry ? readSource(entry) : null;
}

export function toSourceSummary(source: SourceRecord): SourceSummary {
  const { id, title, kind, project, recordedAt, sourceUrl, chunkCount } = source;
  return { id, title, kind, project, recordedAt, sourceUrl, chunkCount };
}
