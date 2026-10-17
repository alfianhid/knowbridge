import { finalizeDecisionBrief, type DecisionBrief } from './contracts';
import { assessSemantics } from './gemini';
import { requireDecisionCoverage, requireSupportedSemantics, type SemanticStatement } from './decision-semantics';
import type { SourceChunk, SourceRecord } from './sources';

// Phase 3 must use this semantic gate after server authorization, not the citation-only finalizer alone.
export async function finalizeVerifiedDecisionBrief(input: unknown, sources: ReadonlyMap<string, SourceRecord>,
  assess: typeof assessSemantics = assessSemantics, retrievedChunks?: SourceChunk[]): Promise<DecisionBrief> {
  const brief = finalizeDecisionBrief(input, sources);
  const references = [...brief.supportingClaims.flatMap(claim => claim.evidence),
    ...brief.conflicts.flatMap(conflict => [conflict.left, conflict.right])];
  if (retrievedChunks && references.some(reference => !retrievedChunks.some(chunk =>
    chunk.sourceId === reference.sourceId && chunk.body.includes(reference.excerpt)))) {
    throw new Error('Citation is not present in authorized retrieved evidence.');
  }
  const evidence = brief.supportingClaims.flatMap(claim => claim.evidence);
  if (!evidence.length) {
    if (brief.status !== 'insufficient_evidence') throw new Error('Evidence required.');
    // No evidence means no synthesized recommendation can be validated. Use a fixed abstention.
    return { ...brief, recommendation: 'Insufficient evidence; no decision recommendation.', supportingClaims: [], conflicts: [], alternatives: [],
      unknowns: ['No sufficient authorized evidence.'], suggestedNextStep: 'Collect authorized source evidence for human review.' };
  }
  const statements: SemanticStatement[] = [
    ...brief.supportingClaims.map(claim => ({ text: claim.claim, evidence: claim.evidence })),
    ...brief.conflicts.map(conflict => ({ text: `${conflict.type}: ${conflict.description}${conflict.resolution ? ` Resolution: ${conflict.resolution}` : ''}`, evidence: [conflict.left, conflict.right] })),
    ...[brief.recommendation, brief.suggestedNextStep, ...brief.unknowns, ...brief.alternatives.map(option => `${option.option}: ${option.tradeoff}`)]
      .map(text => ({ text, evidence })),
  ];
  requireDecisionCoverage(brief.question, brief.supportingClaims.map(claim => ({ text: claim.claim, evidence: claim.evidence })), [...sources.values()]);
  const sourceIds = new Set([...evidence, ...brief.conflicts.flatMap(conflict => [conflict.left, conflict.right])].map(item => item.sourceId));
  const chunks = retrievedChunks ?? [...sources.values()].filter(source => sourceIds.has(source.id)).flatMap(source => source.chunks);
  requireSupportedSemantics(await assess(statements, chunks), statements.length);
  return brief;
}
