import { NextResponse } from 'next/server';
import { DEMO_TENANT_ID, listSourceSummariesForTenant } from '../../../lib/sources';
import { ApiError, publicTenant } from '../../../lib/access';
import { limitPublicReads } from '../../../lib/api-limits';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    limitPublicReads();
    const tenantId = publicTenant(request);
    const sources = await listSourceSummariesForTenant(tenantId);
    return NextResponse.json({ items: sources, synthetic: true });
  } catch (error: unknown) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Unable to load the synthetic source catalog.');
    return NextResponse.json({ error: 'Source catalog unavailable.' }, { status: 500 });
  }
}
