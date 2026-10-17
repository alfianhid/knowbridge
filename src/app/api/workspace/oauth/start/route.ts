import { NextResponse } from 'next/server';
import { startWorkspaceOAuth } from '../../../../../lib/workspace-auth';
import { getWorkspaceConfig } from '../../../../../lib/workspace-config';
import { EmptyWorkspaceRequest, workspaceBody, workspaceError, workspaceIdentity } from '../../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const identity = await workspaceIdentity(request);
    await workspaceBody(request, EmptyWorkspaceRequest);
    const result = await startWorkspaceOAuth(identity);
    const response = NextResponse.json({ url: result.authorizationUrl }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    response.cookies.set('workspace_oauth', result.binding, { httpOnly: true, secure: getWorkspaceConfig().origin.startsWith('https:'), sameSite: 'lax', path: '/api/workspace/oauth/callback', maxAge: 300 });
    return response;
  } catch (error) { return workspaceError(error); }
}
