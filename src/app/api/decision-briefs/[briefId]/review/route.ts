import { NextResponse } from 'next/server';
import { requireBriefIdentity } from '../../../../../lib/access';
import { reviewDecisionBrief } from '../../../../../lib/decision-briefs';
import { BRIEF_ID_PATTERN } from '../../../../../lib/brief-store';
import { briefResponse } from '../../../../../lib/brief-response';
import { briefFailure } from '../../../../../lib/brief-errors';
import { limitPublicReads } from '../../../../../lib/api-limits';

export const runtime = 'nodejs';

interface ReviewRouteContext {
  params: Promise<{ briefId: string }>;
}

// Records human acknowledgement of evidence inspection only; never production approval or execution.
export async function POST(request: Request, context: ReviewRouteContext): Promise<NextResponse> {
  try {
    limitPublicReads();
    const identity = await requireBriefIdentity(request);
    const { briefId } = await context.params;
    if (!BRIEF_ID_PATTERN.test(briefId)) return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
    const brief = await reviewDecisionBrief(identity, briefId);
    return NextResponse.json(briefResponse(brief), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return briefFailure(error, 'Brief review unavailable.');
  }
}
