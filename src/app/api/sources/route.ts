import { NextResponse } from 'next/server';
import { DEMO_TENANT_ID, listSourceSummariesForTenant } from '../../../lib/sources';

export async function GET(request: Request): Promise<NextResponse> {
  const tenantId = request.headers.get('x-knowbridge-tenant') ?? DEMO_TENANT_ID;
  if (tenantId !== DEMO_TENANT_ID) {
    return NextResponse.json({ error: 'Source access denied.' }, { status: 403 });
  }

  try {
    const sources = await listSourceSummariesForTenant(tenantId);
    return NextResponse.json({ items: sources, synthetic: true });
  } catch (error: unknown) {
    console.error('Unable to load the synthetic source catalog.', error);
    return NextResponse.json({ error: 'Source catalog unavailable.' }, { status: 500 });
  }
}
