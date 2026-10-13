import { z } from 'zod';
import type { SourceRecord } from './sources';

export const EvidenceRefSchema = z.object({
  sourceId: z.string().regex(/^[A-Z0-9-]{1,64}$/),
  excerpt: z.string().min(8),
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().regex(/^\/api\/sources\/[A-Z0-9-]{1,64}$/).optional(),
  recordedAt: z.iso.date().optional(),
  effectiveAt: z.iso.date().nullable().optional(),
});
export const SupportedClaimSchema = z.object({ claim: z.string().min(3), evidence: z.array(EvidenceRefSchema).min(1) });
export const ConflictSchema = z.object({
  description: z.string().min(5),
  type: z.enum(['direct_contradiction', 'timeline_revision', 'stale_baseline', 'unresolved_status']),
  left: EvidenceRefSchema, right: EvidenceRefSchema, resolution: z.string().optional(),
});
export const DecisionBriefSchema = z.object({
  question: z.string().min(4), status: z.enum(['supported', 'at_risk', 'insufficient_evidence']),
  recommendation: z.string().min(5), supportingClaims: z.array(SupportedClaimSchema), conflicts: z.array(ConflictSchema),
  alternatives: z.array(z.object({ option: z.string(), tradeoff: z.string() })), unknowns: z.array(z.string()),
  suggestedNextStep: z.string().min(5), reviewedByHuman: z.boolean().default(false),
}).superRefine((brief, context) => {
  if (brief.status !== 'insufficient_evidence' && !brief.supportingClaims.length) {
    context.addIssue({ code: 'custom', path: ['supportingClaims'], message: 'Evidence required for supported or at-risk briefs.' });
  }
  if (brief.status === 'insufficient_evidence' && !brief.unknowns.length) {
    context.addIssue({ code: 'custom', path: ['unknowns'], message: 'State the missing evidence.' });
  }
});
export type DecisionBrief = z.infer<typeof DecisionBriefSchema>;
type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export function verifySourceReferences(brief: DecisionBrief, allowedSources: Map<string, string>): string[] {
  const errors: string[] = [];
  if (brief.status !== 'insufficient_evidence' && !brief.supportingClaims.length) errors.push('Evidence required.');
  const check = (evidence: EvidenceRef) => {
    const text = allowedSources.get(evidence.sourceId);
    if (!text) errors.push(`Unknown or unauthorized source: ${evidence.sourceId}`);
    else if (!text.includes(evidence.excerpt)) errors.push(`Excerpt does not appear in source: ${evidence.sourceId}`);
  };
  brief.supportingClaims.forEach(claim => claim.evidence.forEach(check));
  brief.conflicts.forEach(conflict => { check(conflict.left); check(conflict.right); });
  return errors;
}

// Model metadata is discarded before parsing; only an authorized server record can supply it.
const inputEvidence = z.object({ sourceId: z.string(), excerpt: z.string().min(8) });
const inputBrief = z.object({
  question: z.string(), status: z.enum(['supported', 'at_risk', 'insufficient_evidence']), recommendation: z.string(),
  supportingClaims: z.array(z.object({ claim: z.string(), evidence: z.array(inputEvidence) })),
  conflicts: z.array(z.object({ description: z.string(), type: ConflictSchema.shape.type, left: inputEvidence, right: inputEvidence, resolution: z.string().optional() })),
  alternatives: z.array(z.object({ option: z.string(), tradeoff: z.string() })), unknowns: z.array(z.string()), suggestedNextStep: z.string(),
});

export function finalizeDecisionBrief(input: unknown, sources: ReadonlyMap<string, SourceRecord>): DecisionBrief {
  const parsed = inputBrief.parse(input);
  const enrich = (evidence: z.infer<typeof inputEvidence>): EvidenceRef => {
    const source = sources.get(evidence.sourceId);
    if (!source) throw new Error(`Unknown or unauthorized source: ${evidence.sourceId}`);
    if (!source.content.includes(evidence.excerpt)) throw new Error(`Excerpt does not appear in source: ${evidence.sourceId}`);
    return { ...evidence, sourceTitle: source.title, sourceUrl: `/api/sources/${encodeURIComponent(source.id)}`, recordedAt: source.recordedAt, effectiveAt: source.effectiveAt };
  };
  return DecisionBriefSchema.parse({ ...parsed, reviewedByHuman: false,
    supportingClaims: parsed.supportingClaims.map(claim => ({ ...claim, evidence: claim.evidence.map(enrich) })),
    conflicts: parsed.conflicts.map(conflict => ({ ...conflict, left: enrich(conflict.left), right: enrich(conflict.right) })),
  });
}
