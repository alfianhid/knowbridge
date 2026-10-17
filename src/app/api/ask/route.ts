import { NextResponse } from 'next/server';
import { ApiError, publicTenant } from '../../../lib/access';
import { limitPublicReads, readBoundedJson } from '../../../lib/api-limits';
import { askQuestion } from '../../../lib/ask';
import { AskRequestSchema } from '../../../lib/ask-contracts';
import { consumeModelBudget } from '../../../lib/model-quota';

export const runtime = 'nodejs';

function errorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof ApiError) {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (typeof error.retryAfterSeconds === 'number') headers['Retry-After'] = String(error.retryAfterSeconds);
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  console.error('Grounded search unavailable.');
  return NextResponse.json({ error: fallback }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    limitPublicReads();
    const tenantId = publicTenant(request);
    let input: unknown;
    try { input = await readBoundedJson(request); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'Invalid question request.');
    }
    const parsed = AskRequestSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, 'Question must contain 4–2000 characters; no extra fields allowed.');
    await consumeModelBudget();
    return NextResponse.json(await askQuestion(parsed.data.question, tenantId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, 'Grounded search unavailable. Check configuration, index and service access.');
  }
}
