import { workspaceConnectionStatus } from '../../../../lib/workspace-auth';
import { getWorkspaceStatus } from '../../../../lib/workspace-import';
import { workspaceError, workspaceIdentity, workspaceJson } from '../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const identity = await workspaceIdentity(request, true);
    const connection = await workspaceConnectionStatus(identity);
    const imports = await getWorkspaceStatus(identity);
    const connected = connection.connected && imports.connected;
    return workspaceJson({ ...imports, ...connection, connected, expiresAt: connection.expiresAt ?? undefined,
      sources: connected ? imports.sources : [] });
  } catch (error) { return workspaceError(error); }
}
