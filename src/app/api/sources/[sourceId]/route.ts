import { NextResponse } from 'next/server';
import { DEMO_TENANT_ID, getSourceForTenant } from '../../../../lib/sources';

interface SourceRouteContext {
  params: Promise<{ sourceId: string }>;
}

export async function GET(request: Request, context: SourceRouteContext): Promise<NextResponse> {
  const tenantId = request.headers.get('x-knowbridge-tenant') ?? DEMO_TENANT_ID;
  const { sourceId } = await context.params;

  try {
    const source = await getSourceForTenant(tenantId, sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found.' }, { status: 404 });
    const { tenantId: _tenantId, ...publicSource } = source;
    return NextResponse.json(publicSource);
  } catch (error: unknown) {
    console.error('Unable to load synthetic source details.', error);
    return NextResponse.json({ error: 'Source unavailable.' }, { status: 500 });
  }
}
