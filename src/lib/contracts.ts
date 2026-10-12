import {z} from 'zod';
export const EvidenceRefSchema = z.object({
  sourceId:z.string().min(1),
  excerpt:z.string().min(8),
  sourceTitle:z.string().min(1),
  sourceUrl:z.string().url().optional(),
  modifiedAt:z.string().optional(),
});
export const SupportedClaimSchema = z.object({claim:z.string().min(3),evidence:z.array(EvidenceRefSchema).min(1)});
export const ConflictSchema = z.object({
  description:z.string().min(5),
  type:z.enum(['direct_contradiction','timeline_revision','stale_baseline','unresolved_status']),
  left:EvidenceRefSchema,
  right:EvidenceRefSchema,
  resolution:z.string().optional(),
});
export const DecisionBriefSchema = z.object({
  question:z.string().min(4),
  status:z.enum(['supported','at_risk','insufficient_evidence']),
  recommendation:z.string().min(5),
  supportingClaims:z.array(SupportedClaimSchema),
  conflicts:z.array(ConflictSchema),
  alternatives:z.array(z.object({option:z.string(),tradeoff:z.string()})),
  unknowns:z.array(z.string()),
  suggestedNextStep:z.string().min(5),
  reviewedByHuman:z.boolean().default(false),
});
export type DecisionBrief=z.infer<typeof DecisionBriefSchema>;
export function verifySourceReferences(brief:DecisionBrief, allowedSources:Map<string,string>):string[]{
  const errs:string[]=[];
  const check=(ev:z.infer<typeof EvidenceRefSchema>)=>{
    const text=allowedSources.get(ev.sourceId);
    if(!text){errs.push(`Unknown or unauthorized source: ${ev.sourceId}`);return;}
    const compact=(s:string)=>s.replace(/\s+/g,' ').trim().toLowerCase();
    if(!compact(text).includes(compact(ev.excerpt)))errs.push(`Excerpt does not appear in source: ${ev.sourceId}`);
  };
  brief.supportingClaims.forEach(c=>c.evidence.forEach(check));
  brief.conflicts.forEach(c=>{check(c.left);check(c.right);});
  return errs;
}
