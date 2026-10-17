import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type BriefIdentity } from '../src/lib/access';
import { createDecisionBrief, reviewDecisionBrief, getDecisionBrief, listDecisionBriefs } from '../src/lib/decision-briefs';
import { InMemoryBriefStore } from '../src/lib/brief-store';
import { DEMO_TENANT_ID, InMemoryIngestionStore, ingestSyntheticSources, type SourceChunk, type SourceRecord } from '../src/lib/sources';
import { selectQuestionSources } from '../src/lib/retrieval';

const sha256 = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const owner: BriefIdentity = { uid: 'member-1', tenantId: DEMO_TENANT_ID };
const other: BriefIdentity = { uid: 'member-2', tenantId: DEMO_TENANT_ID };
const KEY = 'brief-request-001';
const QUESTION = 'Can we commit to launching Project Harbour on 2026-11-01? Identify conflicting evidence and recommend a next step.';

function vertex() {
  vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'vertex');
  vi.stubEnv('KNOWBRIDGE_STORE', 'firestore');
  vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
  vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');
  vi.stubEnv('GEMINI_MODEL', 'gemini-3.8-flash');
  vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'true');
  vi.stubEnv('EMBEDDING_MODEL', 'gemini-embedding-001');
  vi.stubEnv('EMBEDDING_DIMENSIONS', '768');
}

let store: InMemoryIngestionStore;
let briefs: InMemoryBriefStore;
let harbourChunks: SourceChunk[];

// Mirrors authorized retrieval: only chunks from question-selected sources reach the service.
function authorizedChunks(sources: SourceRecord[]): SourceChunk[] {
  const selected = selectQuestionSources(QUESTION, sources, { tenantId: DEMO_TENANT_ID, sourceIds: new Set(sources.map(s => s.id)) });
  return selected.flatMap(source => source.chunks);
}

beforeEach(async () => {
  vertex();
  store = new InMemoryIngestionStore();
  briefs = new InMemoryBriefStore();
  await ingestSyntheticSources({ store });
  harbourChunks = authorizedChunks(await store.list(DEMO_TENANT_ID));
});
afterEach(() => vi.unstubAllEnvs());

// Model output that cites literal Harbour excerpts. Strings below are copied from seed/generated/docs.
const EXCERPTS = {
  'HBR-DOC-02': 'The client team continues planning around 2026-11-01 for delivery of the customer self-service portal.',
  'HBR-DOC-04': 'The latest forecast for final regression completion is 2026-11-11.',
  'HBR-DOC-06': 'Production release approval: PENDING.',
  'HBR-DOC-09': 'No decision authorizing a later full-release date exists in this log.',
};
const RISK_EXCERPT = 'Risk R-HBR-01: QA forecast 2026-11-11 does not support the published customer target 2026-11-01.';
function harbourBrief(overrides: Record<string, unknown> = {}) {
  return {
    question: QUESTION, status: 'at_risk',
    recommendation: 'Seek customer, QA and security evidence before any commitment to 2026-11-01; this is a conditional next step for a human decision-maker.',
    supportingClaims: [
      { claim: 'The client target is 2026-11-01 and the latest QA forecast is 2026-11-11.',
        evidence: [
          { sourceId: 'HBR-DOC-02', excerpt: EXCERPTS['HBR-DOC-02'] },
          { sourceId: 'HBR-DOC-04', excerpt: EXCERPTS['HBR-DOC-04'] },
          { sourceId: 'HBR-DOC-05', excerpt: RISK_EXCERPT },
        ] },
      { claim: 'Production security approval is PENDING, not approved.',
        evidence: [{ sourceId: 'HBR-DOC-06', excerpt: EXCERPTS['HBR-DOC-06'] }] },
      { claim: 'No decision authorizes a later full-release date.',
        evidence: [{ sourceId: 'HBR-DOC-09', excerpt: EXCERPTS['HBR-DOC-09'] }] },
    ],
    conflicts: [],
    alternatives: [{ option: 'Postpone full release', tradeoff: 'Requires customer agreement.' }],
    unknowns: ['Customer approval for a revised date is not recorded.'],
    suggestedNextStep: 'Escalate the schedule conflict to the accountable owners for a human decision.',
    ...overrides,
  };
}
const ASSESS_ALL_SUPPORTED = vi.fn(async (statements: unknown[]) => ({
  statements: (statements as unknown[]).map((_, index) => ({ index, categories: ['forecast'], verdict: 'supported', reason: 'Source-linked.' })),
}));

function deps(overrides: Record<string, unknown> = {}) {
  return {
    store, briefs,
    retrieve: async () => harbourChunks,
    generate: async () => harbourBrief(),
    assess: ASSESS_ALL_SUPPORTED,
    newId: () => '00000000-0000-4000-8000-000000000001',
    ...overrides,
  } as Parameters<typeof createDecisionBrief>[2];
}

describe('decision brief service', () => {
  it('creates a verified Harbour brief with server-owned attribution and pending status preserved', async () => {
    const saved = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps());
    expect(saved).toMatchObject({ ownerUid: owner.uid, tenantId: DEMO_TENANT_ID, mode: 'vertex', model: 'gemini-3.8-flash', reviewedByHuman: false });
    expect(saved.brief.status).toBe('at_risk');
    const text = JSON.stringify(saved.brief);
    expect(text).toContain('PENDING');
    expect(text).toContain('2026-11-11');
    expect(text).not.toMatch(/security approved|QA complete|client accepted revised date/i);
    expect(saved.sourceAttribution.map(item => item.sourceId)).toEqual(expect.arrayContaining(['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-06', 'HBR-DOC-09']));
    const expectedTitle = (await store.get(DEMO_TENANT_ID, 'HBR-DOC-02'))!.title;
    expect(saved.brief.supportingClaims[0].evidence[0].sourceTitle).toBe(expectedTitle);
  });

  it('drops a fabricated excerpt, retries once with diagnostics, then fails closed', async () => {
    const fabricated = harbourBrief({ supportingClaims: [{ claim: 'Security is approved.', evidence: [{ sourceId: 'HBR-DOC-06', excerpt: 'Production release approval: APPROVED.' }] }] });
    const generate = vi.fn().mockResolvedValue(fabricated);
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate }))).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });

  it('rejects a real excerpt from a source chunk that was not retrieved', async () => {
    const original = (await store.get(DEMO_TENANT_ID, 'HBR-DOC-04'))!;
    const hiddenText = 'Only the second chunk contains this confidential forecast detail.';
    const hiddenChunk = { ...original.chunks[0], id: `${original.id}:99`, ordinal: 99, body: hiddenText, checksum: sha256(hiddenText) };
    const content = `${original.content}\n${hiddenText}`;
    store.put({ ...original, content, contentHash: sha256(content), chunks: [...original.chunks, hiddenChunk] });
    const output = harbourBrief();
    output.supportingClaims[0].evidence.push({ sourceId: original.id, excerpt: hiddenText });
    const generate = vi.fn(async () => output);
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate })))
      .rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });

  it('does not persist a brief when semantic review rejects it', async () => {
    const assess = vi.fn(async () => ({ statements: [{ index: 0, categories: ['approval'], verdict: 'contradicted', reason: 'Not supported.' }] }));
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ assess }))).rejects.toThrow();
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });

  it('abstains without calling a model when no authorized evidence is retrieved', async () => {
    const generate = vi.fn();
    const saved = await createDecisionBrief(owner, { question: 'What is the personal mobile number of an employee?', idempotencyKey: KEY },
      deps({ generate, retrieve: async () => [] }));
    expect(saved.brief.status).toBe('insufficient_evidence');
    expect(saved.brief.supportingClaims).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects incomplete readiness when retrieval omits an available security record', async () => {
    const output = harbourBrief();
    output.supportingClaims = output.supportingClaims.filter(claim => !claim.evidence.some(item => item.sourceId === 'HBR-DOC-06'));
    const generate = vi.fn(async () => output);
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({
      generate, retrieve: async () => harbourChunks.filter(chunk => chunk.sourceId !== 'HBR-DOC-06'),
    }))).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });

  it('refuses to run outside Vertex mode instead of producing a local brief', async () => {
    vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'local');
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps())).rejects.toMatchObject({ status: 503 });
  });

  it('returns the original brief for an identical retry and rejects a changed payload with 409', async () => {
    const generate = vi.fn(async () => harbourBrief());
    const first = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate, newId: () => '00000000-0000-4000-8000-000000000001' }));
    const retry = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate, newId: () => '00000000-0000-4000-8000-000000000002' }));
    expect(retry.id).toBe(first.id);
    expect(generate).toHaveBeenCalledTimes(1);
    await expect(createDecisionBrief(owner, { question: `${QUESTION} Also check policy.`, idempotencyKey: KEY }, deps()))
      .rejects.toMatchObject({ status: 409 });
  });

  it('isolates brief lists and detail from other members and returns 404 for them', async () => {
    const saved = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps());
    expect(await listDecisionBriefs(other, briefs)).toEqual([]);
    await expect(getDecisionBrief(other, saved.id, briefs)).rejects.toMatchObject({ status: 404 });
    await expect(getDecisionBrief({ uid: owner.uid, tenantId: 'private-tenant' }, saved.id, briefs)).rejects.toMatchObject({ status: 404 });
    await expect(reviewDecisionBrief(other, saved.id, briefs)).rejects.toMatchObject({ status: 404 });
  });

  it('records human review only for the owner and keeps it idempotent', async () => {
    const saved = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps());
    const reviewed = await reviewDecisionBrief(owner, saved.id, briefs);
    expect(reviewed).toMatchObject({ reviewedByHuman: true, reviewerUid: owner.uid });
    expect(reviewed.brief.reviewedByHuman).toBe(true);
    const again = await reviewDecisionBrief(owner, saved.id, briefs);
    expect(again.reviewedAt).toBe(reviewed.reviewedAt);
  });

  it('rejects a source changed after retrieval before the brief is saved', async () => {
    // Model generation runs after retrieval; the forecast is then edited in storage with valid provenance.
    const generate = vi.fn(async () => {
      const original = (await store.get(DEMO_TENANT_ID, 'HBR-DOC-04'))!;
      const edit = (text: string) => text.replace('2026-11-11', '2026-11-20');
      const chunks = original.chunks.map(chunk => ({ ...chunk, body: edit(chunk.body), checksum: sha256(edit(chunk.body)) }));
      const content = edit(original.content);
      store.put({ ...original, content, contentHash: sha256(content), chunks });
      return harbourBrief();
    });
    await expect(createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate }))).rejects.toMatchObject({ status: 502 });
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });
});
