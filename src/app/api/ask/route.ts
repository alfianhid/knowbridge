import { NextResponse } from 'next/server';
import { ApiError, publicTenant } from '../../../lib/access';
import { limitPublicReads, readBoundedJson } from '../../../lib/api-limits';
import { askQuestion } from '../../../lib/ask';
import { AskRequestSchema } from '../../../lib/ask-contracts';

export const runtime = 'nodejs';

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
    return NextResponse.json(await askQuestion(parsed.data.question, tenantId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Grounded search unavailable.');
    return NextResponse.json({ error: 'Grounded search unavailable. Check configuration, index and service access.' }, { status: 503 });
  }
}
