import { NextResponse } from 'next/server';
import { getWorkspaceConnection } from '../../../../lib/workspace-auth';
import { getWorkspaceConfig } from '../../../../lib/workspace-config';
import { EmptyWorkspaceRequest, workspaceBody, workspaceError, workspaceIdentity } from '../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const identity = await workspaceIdentity(request);
    await workspaceBody(request, EmptyWorkspaceRequest);
    const connection = await getWorkspaceConnection(identity);
    const config = getWorkspaceConfig();
    return NextResponse.json({ accessToken: connection.accessToken, expiresAt: connection.expiresAt, developerKey: config.pickerApiKey, appId: config.pickerAppId }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return workspaceError(error); }
}
