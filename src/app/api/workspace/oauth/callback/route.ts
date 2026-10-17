import { NextRequest, NextResponse } from 'next/server';
import { finishWorkspaceOAuth } from '../../../../../lib/workspace-auth';
import { getWorkspaceConfig, workspaceRequestHasOrigin } from '../../../../../lib/workspace-config';
import { limitPublicReads } from '../../../../../lib/api-limits';

export const runtime = 'nodejs';
export async function GET(request: NextRequest): Promise<NextResponse> {
  let result = 'error';
  let origin: string;
  try { origin = getWorkspaceConfig().origin; } catch {
    return new NextResponse('Workspace unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'" } });
  }
  try {
    limitPublicReads();
    const url = new URL(request.url);
    if (!workspaceRequestHasOrigin(request, origin) || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 || url.searchParams.has('error')) throw new Error('Invalid callback');
    await finishWorkspaceOAuth(url.searchParams.get('state') ?? '', url.searchParams.get('code') ?? '', request.cookies.get('workspace_oauth')?.value ?? '');
    result = 'connected';
  } catch { /* Provider details and credentials must never enter error output. */ }
  const response = NextResponse.redirect(`${origin}/?workspace=${result}`, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Content-Security-Policy', "default-src 'none'");
  response.cookies.set('workspace_oauth', '', { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: '/api/workspace/oauth/callback', maxAge: 0 });
  return response;
}
