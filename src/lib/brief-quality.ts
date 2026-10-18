import { z } from 'zod';
import type { DecisionBrief } from './contracts';
import { decisionFacts } from './decision-semantics';
import type { SourceRecord } from './sources';

// R7 deterministic post-generation gate plus R6 Evidence Readiness rubric (docs/ROADMAP.md).
// The gate only flags and blocks; it never auto-fixes evidence, never auto-approves, and the
// rubric is a quality signal only: never approval, production readiness or compliance.

export const BRIEF_GATE_RULES = [
  'fabricated-source',
  'excerpt-mismatch',
  'empty-evidence',
  'cross-tenant-reference',
  'autonomous-decision-wording',
] as const;
export type BriefGateRuleId = (typeof BRIEF_GATE_RULES)[number];

export const RUBRIC_DIMENSIONS = [
  'citation-verification',
  'date-typing',
  'conflict-handling',
  'unknowns-surfaced',
  'next-step-actionability',
  'reviewer-testability',
] as const;
export type RubricDimensionId = (typeof RUBRIC_DIMENSIONS)[number];

export const GateRuleResultSchema = z.object({
  ruleId: z.enum(BRIEF_GATE_RULES),
  passed: z.boolean(),
  message: z.string().min(1).max(500),
});
export type GateRuleResult = z.infer<typeof GateRuleResultSchema>;

export const RubricDimensionSchema = z.object({
  id: z.enum(RUBRIC_DIMENSIONS),
  label: z.string().min(1).max(120),
  score: z.number().int().min(0).max(100),
  finding: z.string().min(1).max(500),
});
export type RubricDimension = z.infer<typeof RubricDimensionSchema>;

export const RUBRIC_NOTE = 'Quality signal only. Never approval, production readiness or compliance.';

export const EvidenceReadinessRubricSchema = z.object({
  overall: z.number().int().min(0).max(100),
  dimensions: z.array(RubricDimensionSchema).length(RUBRIC_DIMENSIONS.length),
  note: z.literal(RUBRIC_NOTE),
});
export type EvidenceReadinessRubric = z.infer<typeof EvidenceReadinessRubricSchema>;

export const BriefQualityGateSchema = z.object({
  passed: z.boolean(),
  rules: z.array(GateRuleResultSchema).length(BRIEF_GATE_RULES.length),
  rubric: EvidenceReadinessRubricSchema,
});
export type BriefQualityGate = z.infer<typeof BriefQualityGateSchema>;

// Thrown only where a caller wants exception style; the brief pipeline uses the plain result.
export class BriefGateError extends Error {
  readonly ruleIds: BriefGateRuleId[];
  constructor(ruleIds: BriefGateRuleId[]) {
    super(`Generated brief blocked by evidence gate rules: ${ruleIds.join(', ')}.`);
    this.ruleIds = ruleIds;
  }
}

interface BriefEvidenceRef {
  sourceId: string;
  excerpt: string;
  sourceUrl?: string;
}

// Assertions by the brief itself; quoted source excerpts are literal evidence and are excluded.
function narrativeText(brief: DecisionBrief): string {
  return [
    brief.recommendation,
    brief.suggestedNextStep,
    ...brief.supportingClaims.map(claim => claim.claim),
    ...brief.conflicts.flatMap(conflict => [conflict.description, conflict.resolution ?? '']),
    ...brief.alternatives.map(option => `${option.option}. ${option.tradeoff}`),
    ...brief.unknowns,
  ].join(' ');
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.;!?])\s+/).map(part => part.trim()).filter(Boolean);
}

function clip(text: string): string {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function allEvidence(brief: DecisionBrief): BriefEvidenceRef[] {
  return [
    ...brief.supportingClaims.flatMap(claim => claim.evidence),
    ...brief.conflicts.flatMap(conflict => [conflict.left, conflict.right]),
  ];
}

// Wording that asserts an approval, completion or autonomous decision. Assertions need a copula
// ("is approved", "has been cleared") so noun phrases like "authorized source evidence" stay clean.
// A sentence matching without a softening marker (negation, pending, conditionality) is unevidenced.
// Kept as small pattern arrays to stay under per-regex complexity budgets.
const DECISION_ASSERTIONS = [
  /\b(is|are|was|were|has been|have been|is now|now|fully)\s+(approved|authorized|cleared|finalized|guaranteed)\b/i,
  /\bsigned off\b/i,
  /\bhas signed\b/i,
  /\b(QA|regression|testing|work|project|milestone|release)\b.{0,40}\b(is|are|was|has been|have been)\s+(complete|completed|finished)\b/i,
];
const SOFTENERS = [
  /\b(pending|not|no|never|insufficient|unverified|awaiting)\b/i,
  /\b(requires?|seek|obtain|until|after|conditional|if|before|proposed|planned)\b/i,
  /\b(recommend|should|may|might|forecast|predict|unknown|cannot|does not)\b/i,
];
const AUTONOMOUS_WORDINGS = [
  /\bautomatically\b/i,
  /\bauto-approve[sd]?\b/i,
  /\bwithout (further )?(human )?review\b/i,
  /\bno (further )?(human )?review (is )?(needed|required)\b/i,
  /\bdecision (has been |is )?(made|finalized|approved)\b/i,
  /\bwe (have )?decided\b/i,
  /\bproduction[- ]ready\b/i,
  /\bgo[- ]?ahead\b/i,
];

const matchesAny = (patterns: RegExp[], text: string): boolean => patterns.some(pattern => pattern.test(text));
const isSoftened = (sentence: string): boolean => matchesAny(SOFTENERS, sentence);
const hasDecisionAssertion = (sentence: string): boolean => matchesAny(DECISION_ASSERTIONS, sentence);
const isAutonomousWording = (sentence: string): boolean => matchesAny(AUTONOMOUS_WORDINGS, sentence);

function autonomousWordingFindings(brief: DecisionBrief): string[] {
  return sentences(narrativeText(brief))
    .filter(sentence => isAutonomousWording(sentence) || (hasDecisionAssertion(sentence) && !isSoftened(sentence)))
    .map(sentence => `Unevidenced decision or autonomous wording: "${clip(sentence)}"`);
}

function firstOr<T>(items: T[], fallback: T): T {
  return items.length ? items[0] : fallback;
}

// R7: deterministic rules over a finalized brief. Pure; never mutates the brief.
export function runBriefGate(brief: DecisionBrief, sources: ReadonlyMap<string, SourceRecord>,
  authorizedScope: ReadonlySet<string>): { passed: boolean; rules: GateRuleResult[]; violations: BriefGateRuleId[] } {
  const refs = allEvidence(brief);

  const unknownIds = [...new Set(refs.filter(ref => !sources.has(ref.sourceId)).map(ref => ref.sourceId))];
  const fabricated: GateRuleResult = {
    ruleId: 'fabricated-source',
    passed: unknownIds.length === 0,
    message: unknownIds.length
      ? `Cited source ID is not an authorized record: ${unknownIds.join(', ')}.`
      : 'Every cited source ID exists in the authorized source set.',
  };

  const mismatchedIds = [...new Set(refs.filter(ref => {
    const source = sources.get(ref.sourceId);
    return source ? !source.content.includes(ref.excerpt) : false;
  }).map(ref => ref.sourceId))];
  const excerptMismatch: GateRuleResult = {
    ruleId: 'excerpt-mismatch',
    passed: mismatchedIds.length === 0,
    message: mismatchedIds.length
      ? `Quoted excerpt does not appear verbatim in source: ${mismatchedIds.join(', ')}.`
      : 'Every quoted excerpt matches its source text verbatim.',
  };

  const abstaining = brief.status === 'insufficient_evidence';
  const emptyEvidenceProblems = abstaining
    ? [...(brief.supportingClaims.length || brief.conflicts.length ? ['an abstention carries claims or conflicts'] : []),
      ...(brief.unknowns.length ? [] : ['an abstention does not state the missing evidence'])]
    : [...(refs.length ? [] : [`${brief.status} brief carries no evidence`])];
  let emptyEvidenceMessage = 'Brief status is backed by evidence.';
  if (emptyEvidenceProblems.length) emptyEvidenceMessage = `Evidence shape invalid: ${emptyEvidenceProblems.join('; ')}.`;
  else if (abstaining) emptyEvidenceMessage = 'Abstention states missing evidence and carries no claims.';
  const emptyEvidence: GateRuleResult = {
    ruleId: 'empty-evidence',
    passed: emptyEvidenceProblems.length === 0,
    message: emptyEvidenceMessage,
  };

  const outOfScopeIds = [...new Set(refs.filter(ref => !authorizedScope.has(ref.sourceId)).map(ref => ref.sourceId))];
  const crossTenant: GateRuleResult = {
    ruleId: 'cross-tenant-reference',
    passed: outOfScopeIds.length === 0,
    message: outOfScopeIds.length
      ? `Citation is outside this request's authorized source scope: ${outOfScopeIds.join(', ')}.`
      : 'All citations stay inside the requesting user\'s authorized source scope.',
  };

  const wordingFindings = autonomousWordingFindings(brief);
  const autonomous: GateRuleResult = {
    ruleId: 'autonomous-decision-wording',
    passed: wordingFindings.length === 0,
    message: wordingFindings.length
      ? firstOr(wordingFindings, 'Unevidenced decision wording.')
      : 'No autonomous-decision or unevidenced approval wording.',
  };

  const rules = [fabricated, excerptMismatch, emptyEvidence, crossTenant, autonomous];
  return { passed: rules.every(rule => rule.passed), rules, violations: rules.filter(rule => !rule.passed).map(rule => rule.ruleId) };
}

type DecisionFact = ReturnType<typeof decisionFacts>[number];
interface DimensionScore { score: number; finding: string; }

// R6 rubric dimension: every quoted span must byte-match an authorized source.
function scoreCitations(refs: BriefEvidenceRef[], sources: ReadonlyMap<string, SourceRecord>): DimensionScore {
  if (!refs.length) return { score: 100, finding: 'No excerpts to verify; an abstention carries none.' };
  for (const ref of refs) {
    const source = sources.get(ref.sourceId);
    if (!source) return { score: 0, finding: `Cited source is not an authorized record: ${ref.sourceId}; a reviewer would chase a source that does not exist.` };
    if (!source.content.includes(ref.excerpt)) return { score: 0, finding: `Quoted excerpt does not match source ${ref.sourceId}; a reviewer would open a passage the source does not contain.` };
  }
  return { score: 100, finding: 'Every quoted excerpt matches its authorized source verbatim.' };
}

// R6 rubric dimension: baseline vs forecast vs commitment vs approval status must stay distinguished.
function scoreDateTyping(narrative: string, narrativeSentences: string[], facts: DecisionFact[]): DimensionScore {
  const expectation = facts.find(fact => fact.category === 'client_expectation');
  const forecast = facts.find(fact => fact.category === 'forecast');
  const approval = facts.find(fact => fact.category === 'approval');
  const problems: string[] = [];
  for (const sentence of narrativeSentences) {
    const forecastAsCommitment = Boolean(forecast) && sentence.includes(forecast!.value)
      && /\b(commit(?:ted|ment)?|guaranteed?|locked|approved|promised)\b/i.test(sentence)
      && !/\b(forecast|predict|projection|not a commitment|does not|cannot)\b/i.test(sentence);
    if (forecastAsCommitment) problems.push(`Forecast date ${forecast!.value} is written as a commitment in: "${clip(sentence)}"`);
    const pendingAsResolved = approval?.value === 'PENDING' && hasDecisionAssertion(sentence) && !isSoftened(sentence);
    if (pendingAsResolved) problems.push(`Pending security approval is written as resolved in: "${clip(sentence)}"`);
  }
  if (forecast && !narrative.includes(forecast.value)) problems.push(`QA forecast date ${forecast.value} is not preserved in the brief narrative.`);
  if (expectation && !narrative.includes(expectation.value)) problems.push(`Client expectation date ${expectation.value} is not preserved in the brief narrative.`);
  if (approval && !narrative.toUpperCase().includes(approval.value.toUpperCase())) problems.push(`Approval status ${approval.value} is not preserved in the brief narrative.`);
  if (problems.length) return { score: Math.max(0, 100 - 50 * problems.length), finding: firstOr(problems, 'Dates lose their types.') };
  if (!facts.length) return { score: 100, finding: 'No dated expectation, forecast or approval facts in the cited evidence to re-type.' };
  return { score: 100, finding: 'Expectation, forecast and approval status keep their recorded types and dates.' };
}

// R6 rubric dimension: a client target plus a later QA forecast is a readiness mismatch the brief must surface.
function scoreConflictHandling(narrative: string, conflicts: DecisionBrief['conflicts'], facts: DecisionFact[]): DimensionScore {
  const expectation = facts.find(fact => fact.category === 'client_expectation');
  const forecast = facts.find(fact => fact.category === 'forecast');
  if (!expectation || !forecast || expectation.value === forecast.value) {
    return { score: 100, finding: 'No cross-document date mismatch to reconcile in the cited evidence.' };
  }
  const bothMentioned = narrative.includes(expectation.value) && narrative.includes(forecast.value);
  const pairPattern = new RegExp(`${expectation.value}[^0-9]{0,80}${forecast.value}|${forecast.value}[^0-9]{0,80}${expectation.value}`);
  const framed = conflicts.length > 0
    || /\b(mismatch|conflict|later than|after|does not support|risk|different|not support)\b/i.test(narrative)
    || pairPattern.test(narrative);
  if (bothMentioned && framed) {
    return { score: 100, finding: `Readiness mismatch is surfaced: client expectation ${expectation.value} versus QA forecast ${forecast.value}, with framing.` };
  }
  if (bothMentioned) {
    return { score: 70, finding: `Both dates are cited (${expectation.value}, ${forecast.value}) but the mismatch is not framed as a readiness gap.` };
  }
  return { score: 30, finding: `Readiness mismatch is incomplete: the brief does not cite both client expectation ${expectation.value} and QA forecast ${forecast.value}.` };
}

// R6 rubric dimension: unresolved approvals must read as open, never as settled.
function scoreUnknowns(brief: DecisionBrief, facts: DecisionFact[]): DimensionScore {
  if (brief.status === 'insufficient_evidence') {
    return brief.unknowns.length
      ? { score: 100, finding: 'Abstention states what evidence is missing.' }
      : { score: 0, finding: 'Abstention does not state what evidence is missing.' };
  }
  const approval = facts.find(fact => fact.category === 'approval');
  if (approval && approval.value !== 'APPROVED') {
    const surfaced = brief.unknowns.some(item => /approv|security|pending|not recorded|unknown/i.test(item));
    return surfaced
      ? { score: 100, finding: `Open item "approval ${approval.value}" is listed as an unknown.` }
      : { score: 40, finding: `Approval status ${approval.value} is cited but not listed as an open unknown; a reviewer could read the brief as settled.` };
  }
  return { score: brief.unknowns.length ? 90 : 80, finding: 'No unresolved approval in the cited evidence.' };
}

// R6 rubric dimension: a concrete human action, never autonomous execution.
function scoreNextStep(step: string): DimensionScore {
  if (isAutonomousWording(step)) {
    return { score: 0, finding: `Next step implies autonomous execution: "${clip(step)}". A human decision-maker must act.` };
  }
  const actionable = /\b(review|confirm|verify|escalate|seek|obtain|ask|collect|decide|approve|discuss|agree|check|contact)\w*/i.test(step);
  if (step.length >= 20 && actionable) return { score: 100, finding: 'Next step names a concrete human action.' };
  if (step.length >= 20) return { score: 60, finding: `Next step lacks a concrete human action verb: "${clip(step)}".` };
  return { score: 20, finding: `Next step is too vague to act on: "${clip(step)}".` };
}

// R6 rubric dimension: a reviewer must be able to open each excerpt and byte-verify it.
function scoreReviewerTestability(refs: BriefEvidenceRef[], sources: ReadonlyMap<string, SourceRecord>): DimensionScore {
  if (!refs.length) return { score: 100, finding: 'Abstention requires no excerpt to open; unknowns name what to collect.' };
  const verifiable = refs.filter(ref => {
    const source = sources.get(ref.sourceId);
    return Boolean(source && source.content.includes(ref.excerpt) && /\/api\/sources\//.test(ref.sourceUrl ?? ''));
  }).length;
  return { score: Math.round((100 * verifiable) / refs.length), finding: `${verifiable} of ${refs.length} evidence excerpts open and byte-match for a reviewer.` };
}

const RUBRIC_LABELS: Record<RubricDimensionId, string> = {
  'citation-verification': 'Citation verification',
  'date-typing': 'Date typing (baseline vs forecast vs commitment vs approval)',
  'conflict-handling': 'Conflict and readiness-mismatch handling',
  'unknowns-surfaced': 'Open unknowns surfaced',
  'next-step-actionability': 'Next step actionability (human action)',
  'reviewer-testability': 'Reviewer testability',
};

// R6: Evidence Readiness Score. Deterministic per-dimension scores with specific findings.
export function scoreEvidenceReadiness(brief: DecisionBrief, sources: ReadonlyMap<string, SourceRecord>): EvidenceReadinessRubric {
  const refs = allEvidence(brief);
  const narrative = narrativeText(brief);
  const facts = decisionFacts([...sources.values()]);
  const scores: Record<RubricDimensionId, DimensionScore> = {
    'citation-verification': scoreCitations(refs, sources),
    'date-typing': scoreDateTyping(narrative, sentences(narrative), facts),
    'conflict-handling': scoreConflictHandling(narrative, brief.conflicts, facts),
    'unknowns-surfaced': scoreUnknowns(brief, facts),
    'next-step-actionability': scoreNextStep(brief.suggestedNextStep),
    'reviewer-testability': scoreReviewerTestability(refs, sources),
  };
  const dimensions: RubricDimension[] = RUBRIC_DIMENSIONS.map(id => ({ id, label: RUBRIC_LABELS[id], ...scores[id] }));
  const overall = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length);
  return EvidenceReadinessRubricSchema.parse({ overall, dimensions, note: RUBRIC_NOTE });
}

// Combined result attached to every saved brief before human review.
export function evaluateBriefQuality(brief: DecisionBrief, sources: ReadonlyMap<string, SourceRecord>,
  authorizedScope: ReadonlySet<string>): BriefQualityGate {
  const { rules } = runBriefGate(brief, sources, authorizedScope);
  return BriefQualityGateSchema.parse({
    passed: rules.every(rule => rule.passed),
    rules,
    rubric: scoreEvidenceReadiness(brief, sources),
  });
}
