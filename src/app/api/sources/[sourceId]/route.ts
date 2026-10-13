import { NextResponse } from 'next/server';
import { DEMO_TENANT_ID, getSourceForTenant } from '../../../../lib/sources';
import { ApiError, publicTenant } from '../../../../lib/access';
import { limitPublicReads } from '../../../../lib/api-limits';

interface SourceRouteContext {
  params: Promise<{ sourceId: string }>;
}

export async function GET(request: Request, context: SourceRouteContext): Promise<NextResponse> {
  const { sourceId } = await context.params;

  try {
    limitPublicReads();
    const tenantId = publicTenant(request);
    const source = await getSourceForTenant(tenantId, sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found.' }, { status: 404 });
    const { chunks: _chunks, tenantId: _tenantId, ...publicSource } = source;
    return NextResponse.json(publicSource);
  } catch (error: unknown) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.status === 403 ? 'Source not found.' : error.message }, { status: error.status === 403 ? 404 : error.status });
    console.error('Unable to load synthetic source details.');
    return NextResponse.json({ error: 'Source unavailable.' }, { status: 500 });
  }
}
