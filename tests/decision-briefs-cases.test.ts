import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createDecisionBrief } from '../src/lib/decision-briefs';
import { InMemoryBriefStore } from '../src/lib/brief-store';
import { DecisionBriefInputSchema } from '../src/lib/contracts';
import type { SemanticStatement } from '../src/lib/decision-semantics';
import { retrieveLocal, selectQuestionSources } from '../src/lib/retrieval';
import { DEMO_TENANT_ID, InMemoryIngestionStore, SyntheticSeedAdapter, ingestSyntheticSources, type SourceRecord } from '../src/lib/sources';
import type { BriefIdentity } from '../src/lib/access';

// Tests server gates, not Gemini accuracy or Firestore vector recall: both models and retrieval are doubles.
const FixtureSchema = z.object({
  id: z.string(), question: z.string(), project: z.string().optional(),
  required_source_ids: z.array(z.string()), prohibited_claims: z.array(z.string()),
  expected_unknowns: z.array(z.string()).optional(),
  facts: z.object({ original_target: z.string(), qa_forecast: z.string(), security: z.string(), client_change_approved: z.boolean() }).optional(),
});
const fixtures = z.array(FixtureSchema).parse(JSON.parse(readFileSync(path.resolve(__dirname, '..', 'seed/generated/evaluation.json'), 'utf8')));
type Fixture = z.infer<typeof FixtureSchema>;
type ModelBrief = z.infer<typeof DecisionBriefInputSchema>;
const owner: BriefIdentity = { uid: 'member-1', tenantId: DEMO_TENANT_ID };
let store: InMemoryIngestionStore;
let briefs: InMemoryBriefStore;
let sources: SourceRecord[];
beforeEach(async () => {
  for (const [key, value] of Object.entries({ KNOWBRIDGE_RETRIEVAL: 'vertex', KNOWBRIDGE_STORE: 'firestore', GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'global', GEMINI_MODEL: 'gemini-test-flash', GOOGLE_GENAI_USE_VERTEXAI: 'true', EMBEDDING_MODEL: 'gemini-embedding-001', EMBEDDING_DIMENSIONS: '768' })) vi.stubEnv(key, value);
  store = new InMemoryIngestionStore();
  briefs = new InMemoryBriefStore();
  await ingestSyntheticSources({ store, adapter: new SyntheticSeedAdapter('evaluation') });
  sources = await store.list(DEMO_TENANT_ID);
});
afterEach(() => vi.unstubAllEnvs());
function selectedSources(question: string) {
  return selectQuestionSources(question, sources, { tenantId: owner.tenantId, sourceIds: new Set(sources.map(source => source.id)) });
}
// Extract only operative sentences. Missing source text is a fixture failure, never a fallback quote.
function citation(sourceId: string, pattern: RegExp) {
  const source = sources.find(record => record.id === sourceId);
  const excerpt = source?.content.match(pattern)?.[0];
  if (!source || !excerpt) throw new Error(`Missing fixture sentence in ${sourceId}: ${pattern}`);
  expect(source.chunks.some(chunk => chunk.body.includes(excerpt))).toBe(true);
  return { sourceId, excerpt };
}
function sourceBackedBrief(fixture: Fixture): ModelBrief {
  const brief: ModelBrief = { question: fixture.question, status: 'supported', recommendation: 'Inspect the cited evidence before making a human decision.', supportingClaims: [], conflicts: [], alternatives: [], unknowns: [], suggestedNextStep: 'Ask accountable owners to verify the evidence.' };
  if (fixture.facts || fixture.id === 'CASE-HBR-SPECIFIC') {
    const project = fixture.project ?? 'HBR';
    const target = citation(`${project}-DOC-02`, /The client team continues planning around [^.]+\./);
    const forecast = citation(`${project}-DOC-04`, /The latest forecast for final regression completion is [^.]+\./);
    brief.status = 'at_risk';
    brief.supportingClaims = [target, forecast].map(item => ({ claim: item.excerpt, evidence: [item] }));
    brief.conflicts = [{ type: 'timeline_revision', description: 'The customer target and later QA completion forecast describe different milestones; the forecast does not erase the customer expectation.', left: target, right: forecast }];
    if (fixture.facts) {
      const risk = citation(`${project}-DOC-05`, /Risk R-[A-Z]+-01: [^.]+\./);
      const security = citation(`${project}-DOC-06`, /Production release approval: [^.]+\./);
      const decision = citation(`${project}-DOC-09`, /No decision authorizing a later full-release date exists in this log\./);
      brief.supportingClaims.push(...[risk, security, decision].map(item => ({ claim: item.excerpt, evidence: [item] })));
      brief.recommendation = 'Do not confirm the original full-production date without revised QA, security and customer approval.';
      brief.unknowns = ['Customer approval for a revised date remains unrecorded.', 'Pilot risk acceptance remains unrecorded.'];
    }
  } else if (fixture.id === 'CASE-POLICY-01') {
    const policy = citation('POL-DOC-01-V2', /Production launch requires [^.]+\./);
    const revision = citation('POL-DOC-01-V2', /Rev 2 supersedes revision 1\./);
    brief.supportingClaims = [policy, revision].map(item => ({ claim: item.excerpt, evidence: [item] }));
  } else if (fixture.id === 'CASE-UNKNOWN-02') {
    const customer = citation('HBR-DOC-02', /The client has not yet accepted a new date or a reduced-scope pilot\./);
    const decision = citation('HBR-DOC-09', /No decision authorizing a later full-release date exists in this log\./);
    const change = citation('HBR-DOC-15', /Status: DRAFT \/ NOT APPROVED\./);
    brief.supportingClaims = [customer, decision, change].map(item => ({ claim: item.excerpt, evidence: [item] }));
    brief.supportingClaims.push({ claim: 'No signed revised commitment is evidenced.', evidence: [customer, decision, change] });
    brief.unknowns = ['Written customer authorization for a revised commitment is not recorded.'];
  } else throw new Error(`No source-backed brief defined for ${fixture.id}`);
  return brief;
}
// Positive semantic verdicts test acceptance plumbing, not semantic truth.
async function supportedAssessment(statements: SemanticStatement[]) {
  return { statements: statements.map((_, index) => ({ index, categories: ['unknown'], verdict: 'supported', reason: 'Controlled positive test verdict.' })) };
}
describe.each(fixtures.filter(fixture => fixture.required_source_ids.length))('$id brief fixture', fixture => {
  it('persists owning-record citations and expected facts without blanket phrase filtering', async () => {
    const selected = selectedSources(fixture.question);
    expect(selected.map(source => source.id)).toEqual(expect.arrayContaining(fixture.required_source_ids));
    const generate = vi.fn(async () => sourceBackedBrief(fixture));
    const assess = vi.fn(supportedAssessment);
    const saved = await createDecisionBrief(owner, { question: fixture.question, idempotencyKey: `pass-${fixture.id}` }, { store, briefs, retrieve: async () => selected.flatMap(source => source.chunks), generate, assess });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(assess).toHaveBeenCalledTimes(1);
    expect(saved.brief.status).not.toBe('insufficient_evidence');
    expect(await briefs.get(owner.tenantId, saved.id)).toEqual(saved);
    expect(saved.sourceAttribution.map(item => item.sourceId)).toEqual(expect.arrayContaining(fixture.required_source_ids));
    for (const claim of saved.brief.supportingClaims) for (const evidence of claim.evidence) {
      const source = selected.find(record => record.id === evidence.sourceId)!;
      expect(source.content).toContain(evidence.excerpt);
      expect(evidence).toMatchObject({ sourceTitle: source.title, recordedAt: source.recordedAt, effectiveAt: source.effectiveAt });
    }
    const claims = saved.brief.supportingClaims.map(claim => claim.claim).join(' ');
    if (fixture.facts) {
      expect(claims).toContain(fixture.facts.original_target);
      expect(claims).toContain(fixture.facts.qa_forecast);
      expect(claims).toContain(`Production release approval: ${fixture.facts.security}.`);
      expect(fixture.facts.client_change_approved).toBe(false);
      expect(claims).toContain('No decision authorizing a later full-release date');
      for (const unknown of fixture.expected_unknowns ?? []) expect(saved.brief.unknowns.join(' ').toLowerCase()).toContain(unknown);
    }
    if (fixture.id === 'CASE-HBR-SPECIFIC') {
      expect(claims).toContain('2026-11-01');
      expect(claims).toContain('2026-11-11');
      expect(saved.brief.conflicts[0]).toMatchObject({ type: 'timeline_revision', left: { sourceId: 'HBR-DOC-02' }, right: { sourceId: 'HBR-DOC-04' } });
    }
    if (fixture.id === 'CASE-POLICY-01') {
      expect(selected.map(source => source.id)).not.toContain('POL-DOC-01-V1');
      expect(claims).toContain('documented QA completion, security approval and named on-call owner');
      expect(claims).toContain('Rev 2 supersedes revision 1.');
      expect(saved.brief.supportingClaims[0].evidence[0].effectiveAt).toBe('2026-10-01');
    }
    if (fixture.id === 'CASE-UNKNOWN-02') {
      // Gold words "signed" and "accepted" also occur in valid negative statements.
      expect(claims).toContain('No signed revised commitment is evidenced.');
      expect(claims).toContain('The client has not yet accepted');
      expect(claims).toContain('DRAFT / NOT APPROVED');
    } else {
      const narrative = [claims, saved.brief.recommendation, saved.brief.suggestedNextStep, ...saved.brief.conflicts.map(conflict => conflict.description), ...saved.brief.unknowns].join(' ').toLowerCase();
      for (const phrase of fixture.prohibited_claims) expect(narrative).not.toContain(phrase.toLowerCase());
    }
    expect(saved.reviewedByHuman).toBe(false);
  });
  it('rejects fabricated excerpts after two attempts without saving', async () => {
    const candidate = sourceBackedBrief(fixture);
    candidate.supportingClaims[0].evidence[0].excerpt = 'Fabricated fixture excerpt that is absent from every source.';
    const generate = vi.fn(async () => candidate);
    const assess = vi.fn(supportedAssessment);
    await expect(createDecisionBrief(owner, { question: fixture.question, idempotencyKey: `bad-quote-${fixture.id}` }, { store, briefs, retrieve: async () => selectedSources(fixture.question).flatMap(source => source.chunks), generate, assess })).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(assess).not.toHaveBeenCalled();
    expect(await briefs.listForOwner(owner.tenantId, owner.uid)).toEqual([]);
  });
  it.each(fixture.prohibited_claims)('fails closed on a contradicted semantic verdict for: %s', async phrase => {
    const candidate = sourceBackedBrief(fixture);
    const unsupportedClaim = fixture.id === 'CASE-UNKNOWN-02' ? `The client has ${phrase} the revised commitment.` : phrase;
    candidate.supportingClaims.push({ claim: unsupportedClaim, evidence: [candidate.supportingClaims[0].evidence[0]] });
    // Complete coverage and literal quotes isolate semantic rejection as the failing gate.
    const assess = vi.fn(async (statements: SemanticStatement[]) => ({ statements: statements.map((statement, index) => ({ index, categories: ['approval'], verdict: statement.text === unsupportedClaim ? 'contradicted' : 'supported', reason: 'Controlled semantic verdict for unsupported fixture assertion.' })) }));
    const generate = vi.fn(async () => candidate);
    await expect(createDecisionBrief(owner, { question: fixture.question, idempotencyKey: `bad-claim-${fixture.id}` }, { store, briefs, retrieve: async () => selectedSources(fixture.question).flatMap(source => source.chunks), generate, assess })).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(assess).toHaveBeenCalledTimes(2);
    expect(assess.mock.calls[0][0].some(statement => statement.text === unsupportedClaim)).toBe(true);
    expect(await briefs.listForOwner(owner.tenantId, owner.uid)).toEqual([]);
  });
});
it('CASE-UNKNOWN-01 abstains on actual empty lexical retrieval without invoking either model', async () => {
  const fixture = fixtures.find(item => item.id === 'CASE-UNKNOWN-01')!;
  const chunks = retrieveLocal(fixture.question, sources, { tenantId: owner.tenantId, sourceIds: new Set(sources.map(source => source.id)) });
  expect(chunks).toEqual([]);
  const generate = vi.fn();
  const assess = vi.fn();
  const saved = await createDecisionBrief(owner, { question: fixture.question, idempotencyKey: 'missing-personal-data' }, { store, briefs, retrieve: async () => chunks, generate, assess });
  expect(saved.brief.status).toBe('insufficient_evidence');
  expect(saved.brief.supportingClaims).toEqual([]);
  expect(saved.sourceAttribution).toEqual([]);
  expect(saved.brief.unknowns).not.toEqual([]);
  expect(generate).not.toHaveBeenCalled();
  expect(assess).not.toHaveBeenCalled();
});
it.each(['missing source', 'cross-tenant chunk'])('fails closed before generation for %s', async failure => {
  const fixture = fixtures[0];
  const chunks = selectedSources(fixture.question).flatMap(source => source.chunks);
  const generate = vi.fn();
  if (failure === 'missing source') vi.spyOn(store, 'get').mockResolvedValue(null);
  // Deliberately invalid runtime input bypasses the synthetic-tenant literal type to test authorization.
  else chunks[0] = { ...chunks[0], tenantId: 'unrelated-tenant' } as unknown as typeof chunks[number];
  await expect(createDecisionBrief(owner, { question: fixture.question, idempotencyKey: 'source-boundary' }, { store, briefs, retrieve: async () => chunks, generate })).rejects.toMatchObject({ status: failure === 'missing source' ? 502 : 403 });
  expect(generate).not.toHaveBeenCalled();
  expect(await briefs.listForOwner(owner.tenantId, owner.uid)).toEqual([]);
});


