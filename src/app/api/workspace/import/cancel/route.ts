import { cancelWorkspaceImport } from '../../../../../lib/workspace-import';
import { EmptyWorkspaceRequest, workspaceBody, workspaceError, workspaceIdentity, workspaceJson } from '../../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const identity = await workspaceIdentity(request, true);
    await workspaceBody(request, EmptyWorkspaceRequest);
    return workspaceJson(await cancelWorkspaceImport(identity));
  } catch (error) { return workspaceError(error); }
}
