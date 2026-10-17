import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decisionFacts } from '../src/lib/decision-semantics';
import { DecisionBriefSchema, finalizeDecisionBrief } from '../src/lib/contracts';
import { DEMO_TENANT_ID, InMemoryIngestionStore, ingestSyntheticSources } from '../src/lib/sources';

// Fixture-backed gates: facts come from seed/generated/evaluation.json, not from prose assumptions.
// Only the Harbour hero case is asserted here; other cases are covered by corpus and semantic gates.
const fixtures: { id: string; question: string; facts?: unknown; required_source_ids?: string[]; prohibited_claims?: string[]; expected_unknowns?: string[] }[] =
  JSON.parse(readFileSync(path.resolve(__dirname, '..', 'seed', 'generated', 'evaluation.json'), 'utf8'));

const harbour = fixtures.find(item => item.id === 'CASE-HBR')!;
const harbourFacts = z.object({ original_target: z.string(), qa_forecast: z.string(), security: z.string(), client_change_approved: z.boolean() })
  .parse(harbour.facts);
const harbourSources = harbour.required_source_ids ?? [];

describe('decision brief evaluation fixtures', () => {
  it('encodes the Harbour hero facts the brief must keep distinct', () => {
    expect(harbourFacts).toEqual({ original_target: '2026-11-01', qa_forecast: '2026-11-11', security: 'PENDING', client_change_approved: false });
    expect(harbourSources).toEqual(expect.arrayContaining(['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-06', 'HBR-DOC-09']));
  });

  it('extracts the same typed facts from the stored Harbour records', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store, sourceIds: harbourSources });
    const sources = (await store.list(DEMO_TENANT_ID)).filter(source => harbourSources.includes(source.id));
    const facts = decisionFacts(sources);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'client_expectation', value: harbourFacts.original_target, sourceId: 'HBR-DOC-02' }),
      expect.objectContaining({ category: 'forecast', value: harbourFacts.qa_forecast, sourceId: 'HBR-DOC-04' }),
      expect.objectContaining({ category: 'approval', value: harbourFacts.security, sourceId: 'HBR-DOC-06' }),
    ]));
  });

  it('rejects a brief that presents pending security as approved', () => {
    const approved = {
      question: harbour.question, status: 'supported', recommendation: 'Proceed with 2026-11-01.',
      supportingClaims: [{ claim: 'Security is approved.', evidence: [] }], conflicts: [], alternatives: [], unknowns: [],
      suggestedNextStep: 'Launch.', reviewedByHuman: true,
    };
    expect(DecisionBriefSchema.safeParse(approved).success).toBe(false);
  });

  it('lists the expected unknowns the brief must surface', () => {
    expect(harbour.expected_unknowns).toEqual(expect.arrayContaining(['customer approval for a revised date']));
    expect(harbour.prohibited_claims).toEqual(expect.arrayContaining(['security approved', 'QA complete']));
  });

  it('finalizes a conditional Harbour brief only with authorized, literal evidence', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store, sourceIds: harbourSources });
    const sources = new Map((await store.list(DEMO_TENANT_ID)).map(source => [source.id, source]));
    const brief = finalizeDecisionBrief({
      question: harbour.question, status: 'at_risk',
      recommendation: 'Seek customer, QA and security evidence before any commitment to 2026-11-01.',
      supportingClaims: [{ claim: 'Security approval is PENDING.', evidence: [{ sourceId: 'HBR-DOC-06', excerpt: 'Production release approval: PENDING.' }] }],
      conflicts: [], alternatives: [], unknowns: harbour.expected_unknowns ?? [], suggestedNextStep: 'Escalate to owners for a human decision.',
    }, sources);
    expect(brief.status).toBe('at_risk');
    expect(brief.reviewedByHuman).toBe(false);
    expect(brief.supportingClaims[0].evidence[0].sourceTitle).toBeTruthy();
  });
});
