import type { StoredBrief } from './brief-store';

// Public brief shape: never exposes tenant, owner UID or stored storage internals.
export function briefResponse(brief: StoredBrief) {
  return {
    id: brief.id,
    question: brief.question,
    createdAt: brief.createdAt,
    mode: brief.mode,
    model: brief.model,
    status: brief.brief.status,
    reviewedByHuman: brief.reviewedByHuman,
    reviewedAt: brief.reviewedAt ?? null,
    brief: brief.brief,
    sourceAttribution: brief.sourceAttribution,
    // Quality gate findings travel with the brief; a score is never approval.
    qualityGate: brief.qualityGate ?? null,
    synthetic: true as const,
  };
}
