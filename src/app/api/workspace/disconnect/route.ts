import { disconnectWorkspaceConnection } from '../../../../lib/workspace-auth';
import { clearWorkspaceImports } from '../../../../lib/workspace-import';
import { EmptyWorkspaceRequest, workspaceBody, workspaceError, workspaceIdentity, workspaceJson } from '../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const identity = await workspaceIdentity(request, true);
    await workspaceBody(request, EmptyWorkspaceRequest);
    const connection = await disconnectWorkspaceConnection(identity);
    try {
      await clearWorkspaceImports(identity, {}, connection.connectionId);
      return workspaceJson({ revocation: connection.revocation, cleanup: 'completed' });
    } catch {
      return workspaceJson({ revocation: connection.revocation, cleanup: 'incomplete',
        error: 'Access disabled. Application cleanup incomplete; retry disconnect.' }, 207);
    }
  } catch (error) { return workspaceError(error); }
}
