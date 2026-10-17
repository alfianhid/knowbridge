import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, requireBriefIdentity } from '../../../lib/access';
import { limitPublicReads, readBoundedJson } from '../../../lib/api-limits';
import { createDecisionBrief, listDecisionBriefs } from '../../../lib/decision-briefs';
import { briefResponse } from '../../../lib/brief-response';
import { briefFailure } from '../../../lib/brief-errors';
import { consumeModelBudget } from '../../../lib/model-quota';

export const runtime = 'nodejs';

// Client may send only the question. Owner, tenant, sources, review and model metadata are server-owned.
const CreateBriefSchema = z.object({ question: z.string().trim().min(4).max(2000) }).strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    limitPublicReads();
    const identity = await requireBriefIdentity(request);
    const key = request.headers.get('idempotency-key') ?? '';
    if (!IDEMPOTENCY_KEY.test(key)) throw new ApiError(400, 'Valid Idempotency-Key header required.');
    let input: unknown;
    try { input = await readBoundedJson(request); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'Invalid brief request.');
    }
    const parsed = CreateBriefSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, 'Question must contain 4–2000 characters; no extra fields allowed.');
    await consumeModelBudget(identity.uid);
    const brief = await createDecisionBrief(identity, { question: parsed.data.question, idempotencyKey: key });
    return NextResponse.json(briefResponse(brief), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return briefFailure(error, 'Decision brief creation unavailable. Check configuration and retry.');
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    limitPublicReads();
    const identity = await requireBriefIdentity(request);
    const briefs = await listDecisionBriefs(identity);
    return NextResponse.json({ items: briefs.map(briefResponse) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return briefFailure(error, 'Saved briefs unavailable.');
  }
}
