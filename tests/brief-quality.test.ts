import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BriefIdentity } from '../src/lib/access';
import { createDecisionBrief, reviewDecisionBrief } from '../src/lib/decision-briefs';
import { InMemoryBriefStore, type StoredBrief } from '../src/lib/brief-store';
import {
  BRIEF_GATE_RULES, RUBRIC_DIMENSIONS, RUBRIC_NOTE,
  evaluateBriefQuality, runBriefGate, scoreEvidenceReadiness,
} from '../src/lib/brief-quality';
import { finalizeDecisionBrief, type DecisionBrief } from '../src/lib/contracts';
import { briefResponse } from '../src/lib/brief-response';
import { selectQuestionSources } from '../src/lib/retrieval';
import {
  DEMO_TENANT_ID, InMemoryIngestionStore, ingestSyntheticSources, loadSyntheticSources,
  type SourceChunk, type SourceRecord,
} from '../src/lib/sources';

const sha256 = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const owner: BriefIdentity = { uid: 'member-1', tenantId: DEMO_TENANT_ID };
const KEY = 'brief-quality-001';
const QUESTION = 'Can we commit to launching Project Harbour on 2026-11-01? Identify conflicting evidence and recommend a next step.';

// Literal excerpts copied from seed/generated/docs, same fixture as decision-briefs.test.ts.
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

const SOURCE_IDS = ['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-05', 'HBR-DOC-06', 'HBR-DOC-09'];
const FULL_SCOPE = new Set(SOURCE_IDS);
let sourceMap: Map<string, SourceRecord>;

function finalizedBrief(overrides: Record<string, unknown> = {}): DecisionBrief {
  return finalizeDecisionBrief(harbourBrief(overrides), sourceMap);
}

beforeEach(async () => {
  const all = await loadSyntheticSources();
  sourceMap = new Map(all.filter(source => SOURCE_IDS.includes(source.id)).map(source => [source.id, source]));
});
afterEach(() => vi.unstubAllEnvs());

describe('R7 deterministic brief gate rules (flag and block only)', () => {
  it('passes the Harbour brief with all five rules satisfied', () => {
    const gate = runBriefGate(finalizedBrief(), sourceMap, FULL_SCOPE);
    expect(gate.passed).toBe(true);
    expect(gate.violations).toEqual([]);
    expect(gate.rules.map(rule => rule.ruleId)).toEqual([...BRIEF_GATE_RULES]);
    expect(gate.rules.every(rule => rule.passed)).toBe(true);
    expect(gate.rules.every(rule => rule.message.length > 0)).toBe(true);
  });

  it('blocks a fabricated source ID that no authorized record backs', () => {
    const brief = finalizedBrief();
    const tampered: DecisionBrief = { ...brief, supportingClaims: [
      { ...brief.supportingClaims[0], evidence: [{ ...brief.supportingClaims[0].evidence[0], sourceId: 'HBR-DOC-99' }] },
      ...brief.supportingClaims.slice(1),
    ] };
    const gate = runBriefGate(tampered, sourceMap, FULL_SCOPE);
    expect(gate.passed).toBe(false);
    expect(gate.violations).toEqual(['fabricated-source', 'cross-tenant-reference']);
    expect(gate.rules.find(rule => rule.ruleId === 'fabricated-source')?.message).toContain('HBR-DOC-99');
  });

  it('blocks an excerpt that does not match the source verbatim', () => {
    const brief = finalizedBrief();
    const tampered: DecisionBrief = { ...brief, supportingClaims: [
      { ...brief.supportingClaims[1], evidence: [{ ...brief.supportingClaims[1].evidence[0], excerpt: 'Production release approval: APPROVED.' }] },
      brief.supportingClaims[0], brief.supportingClaims[2],
    ] };
    const gate = runBriefGate(tampered, sourceMap, FULL_SCOPE);
    expect(gate.passed).toBe(false);
    expect(gate.violations).toEqual(['excerpt-mismatch']);
    expect(gate.rules.find(rule => rule.ruleId === 'excerpt-mismatch')?.message).toContain('HBR-DOC-06');
  });

  it('blocks citations outside the requesting user\'s authorized source scope (cross-tenant isolation)', () => {
    const scopeWithoutDoc09 = new Set(SOURCE_IDS.filter(id => id !== 'HBR-DOC-09'));
    const gate = runBriefGate(finalizedBrief(), sourceMap, scopeWithoutDoc09);
    expect(gate.passed).toBe(false);
    // The source exists and its excerpt is real; it is blocked purely because it is out of scope.
    expect(gate.violations).toEqual(['cross-tenant-reference']);
    expect(gate.rules.find(rule => rule.ruleId === 'fabricated-source')?.passed).toBe(true);
    expect(gate.rules.find(rule => rule.ruleId === 'cross-tenant-reference')?.message).toContain('HBR-DOC-09');
  });

  it('blocks evidence-free verdicts and abstentions that carry claims', () => {
    const brief = finalizedBrief();
    const evidenceFree = { ...brief, status: 'supported', supportingClaims: [], conflicts: [] } as DecisionBrief;
    expect(runBriefGate(evidenceFree, sourceMap, FULL_SCOPE).violations).toEqual(['empty-evidence']);
    const claimCarryingAbstention = { ...brief, status: 'insufficient_evidence', unknowns: ['Missing evidence.'] } as DecisionBrief;
    expect(runBriefGate(claimCarryingAbstention, sourceMap, FULL_SCOPE).violations).toEqual(['empty-evidence']);
  });

  it('blocks unevidenced approval and autonomous decision wording', () => {
    const brief = finalizedBrief({ recommendation: 'The release is approved and QA is complete. We have decided the date.' });
    const gate = runBriefGate(brief, sourceMap, FULL_SCOPE);
    expect(gate.passed).toBe(false);
    expect(gate.violations).toEqual(['autonomous-decision-wording']);
    expect(gate.rules.find(rule => rule.ruleId === 'autonomous-decision-wording')?.message).toContain('approved');
  });

  it('keeps negated and pending wording unblocked', () => {
    const brief = finalizedBrief({ recommendation: 'Production security approval is PENDING, not approved; a human must review before any decision.' });
    expect(runBriefGate(brief, sourceMap, FULL_SCOPE).violations).toEqual([]);
  });
});

describe('R6 Evidence Readiness rubric (quality signal, never approval)', () => {
  it('scores the Harbour brief across six dimensions with specific findings', () => {
    const rubric = scoreEvidenceReadiness(finalizedBrief(), sourceMap);
    expect(rubric.dimensions.map(dimension => dimension.id)).toEqual([...RUBRIC_DIMENSIONS]);
    expect(rubric.overall).toBe(100);
    expect(rubric.note).toBe(RUBRIC_NOTE);
    const conflict = rubric.dimensions.find(dimension => dimension.id === 'conflict-handling')!;
    expect(conflict.score).toBe(100);
    expect(conflict.finding).toContain('2026-11-01');
    expect(conflict.finding).toContain('2026-11-11');
    const reviewer = rubric.dimensions.find(dimension => dimension.id === 'reviewer-testability')!;
    expect(reviewer.score).toBe(100);
    expect(reviewer.finding).toContain('5 of 5');
  });

  it('penalizes date typing when a QA forecast is written as a commitment', () => {
    const rubric = scoreEvidenceReadiness(finalizedBrief({ recommendation: 'We commit to 2026-11-11 as the delivery date.' }), sourceMap);
    const date = rubric.dimensions.find(dimension => dimension.id === 'date-typing')!;
    expect(date.score).toBe(50);
    expect(date.finding).toContain('written as a commitment');
    expect(date.finding).toContain('2026-11-11');
  });

  it('penalizes missing unknowns when a pending approval is cited but not surfaced', () => {
    const rubric = scoreEvidenceReadiness(finalizedBrief({ unknowns: [] }), sourceMap);
    const unknowns = rubric.dimensions.find(dimension => dimension.id === 'unknowns-surfaced')!;
    expect(unknowns.score).toBe(40);
    expect(unknowns.finding).toContain('not listed as an open unknown');
    expect(unknowns.finding).toContain('PENDING');
  });

  it('never mutates the brief and never records approval or review state', () => {
    const brief = finalizedBrief();
    const before = JSON.stringify(brief);
    const gate = evaluateBriefQuality(brief, sourceMap, FULL_SCOPE);
    expect(JSON.stringify(brief)).toBe(before);
    expect(brief.reviewedByHuman).toBe(false);
    expect(gate.passed).toBe(true);
    expect(gate.rubric.note).toBe('Quality signal only. Never approval, production readiness or compliance.');
  });
});

// Pipeline integration: gate result is recorded before any human review, and blocked briefs are saved nowhere.
describe('quality gate in the decision brief pipeline', () => {
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

  beforeEach(async () => {
    vertex();
    store = new InMemoryIngestionStore();
    briefs = new InMemoryBriefStore();
    await ingestSyntheticSources({ store });
    const selected = selectQuestionSources(QUESTION, await store.list(DEMO_TENANT_ID),
      { tenantId: DEMO_TENANT_ID, sourceIds: new Set((await store.list(DEMO_TENANT_ID)).map(source => source.id)) });
    harbourChunks = selected.flatMap(source => source.chunks);
  });

  it('attaches a passing quality gate with rubric findings to every saved brief', async () => {
    const saved = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps());
    expect(saved.qualityGate?.passed).toBe(true);
    expect(saved.qualityGate?.rules).toHaveLength(BRIEF_GATE_RULES.length);
    expect(saved.qualityGate?.rules.every(rule => rule.passed)).toBe(true);
    expect(saved.qualityGate?.rubric.dimensions).toHaveLength(RUBRIC_DIMENSIONS.length);
    expect(saved.qualityGate?.rubric.note).toBe(RUBRIC_NOTE);
    expect(briefResponse(saved)).toMatchObject({ qualityGate: saved.qualityGate });
  });

  it('blocks autonomous-decision wording, lists the failing rules, and saves nothing', async () => {
    const generate = vi.fn(async () => harbourBrief({ recommendation: 'The release is approved and QA is complete. We have decided to ship.' }));
    const error = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps({ generate }))
      .then(() => null, (failure: unknown) => failure as Error & { status?: number });
    expect(error).toMatchObject({ status: 502 });
    expect(error?.message).toContain('autonomous-decision-wording');
    expect(error?.message).toContain('No brief was saved');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await briefs.listForOwner(DEMO_TENANT_ID, owner.uid)).toEqual([]);
  });

  it('refuses human acknowledgement while gate rules are failing', async () => {
    const saved = await createDecisionBrief(owner, { question: QUESTION, idempotencyKey: KEY }, deps());
    const failing: StoredBrief = {
      ...saved,
      id: '00000000-0000-4000-8000-000000000009',
      qualityGate: {
        ...saved.qualityGate!,
        passed: false,
        rules: saved.qualityGate!.rules.map(rule => (rule.ruleId === 'excerpt-mismatch'
          ? { ...rule, passed: false, message: 'Quoted excerpt does not appear verbatim in source: HBR-DOC-04.' }
          : rule)),
      },
    };
    await briefs.createOnce(failing, 'idem-blocked-001', createHash('sha256').update('blocked').digest('hex'));
    await expect(reviewDecisionBrief(owner, failing.id, briefs)).rejects.toMatchObject({ status: 409 });
    // The unblocked brief is still acknowledgeable.
    await expect(reviewDecisionBrief(owner, saved.id, briefs)).resolves.toMatchObject({ reviewedByHuman: true });
  });

  it('passes the gate on abstention and records an abstention rubric finding', async () => {
    const generate = vi.fn();
    const saved = await createDecisionBrief(owner, { question: 'What is the personal mobile number of an employee?', idempotencyKey: KEY },
      deps({ generate, retrieve: async () => [] }));
    expect(saved.brief.status).toBe('insufficient_evidence');
    expect(saved.qualityGate?.passed).toBe(true);
    const citation = saved.qualityGate!.rubric.dimensions.find(dimension => dimension.id === 'citation-verification')!;
    expect(citation.finding).toContain('abstention');
    expect(generate).not.toHaveBeenCalled();
  });
});
