import { describe, expect, it } from 'vitest';
import { DecisionBriefSchema, finalizeDecisionBrief, verifySourceReferences } from '../src/lib/contracts';
import { loadSyntheticSources } from '../src/lib/sources';

const base = { question: 'Can Harbour launch?', status: 'supported', recommendation: 'Check evidence before committing.',
  supportingClaims: [], conflicts: [], alternatives: [], unknowns: [], suggestedNextStep: 'Ask the accountable owner.' };

describe('evidence integrity gates', () => {
  it.each(['supported', 'at_risk'])('rejects evidence-free %s', status => {
    expect(DecisionBriefSchema.safeParse({ ...base, status }).success).toBe(false);
  });
  it('permits explicit abstention with missing evidence', () => {
    expect(DecisionBriefSchema.safeParse({ ...base, status: 'insufficient_evidence', unknowns: ['No authorized evidence.'] }).success).toBe(true);
  });
  it('reconstructs metadata and review state from authorized sources only', async () => {
    const source = (await loadSyntheticSources()).find(s => s.id === 'HBR-DOC-06')!;
    const brief = { ...base, reviewedByHuman: true, status: 'at_risk', supportingClaims: [{ claim: 'Security approval is pending.', evidence: [{
      sourceId: source.id, excerpt: 'Production release approval: PENDING.', sourceTitle: 'Fabricated title', sourceUrl: 'https://evil.example', modifiedAt: '2020-01-01',
    }] }] };
    const result = finalizeDecisionBrief(brief, new Map([[source.id, source]]));
    expect(result.supportingClaims[0].evidence[0]).toMatchObject({ sourceTitle: source.title, sourceUrl: source.sourceUrl, recordedAt: source.recordedAt });
    expect(result.supportingClaims[0].evidence[0]).not.toHaveProperty('modifiedAt');
    expect(result.reviewedByHuman).toBe(false);
    expect(() => finalizeDecisionBrief(brief, new Map())).toThrow('Unknown or unauthorized');
    const altered = { ...result, supportingClaims: [{ ...result.supportingClaims[0], evidence: [{ ...result.supportingClaims[0].evidence[0], excerpt: 'Production release approval: pending.' }] }] };
    expect(verifySourceReferences(altered, new Map([[source.id, source.content]]))).toHaveLength(1);
  });
});
