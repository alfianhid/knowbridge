import { stepWorkspaceImport } from '../../../../../lib/workspace-import';
import { EmptyWorkspaceRequest, workspaceBody, workspaceError, workspaceIdentity, workspaceJson } from '../../../../../lib/workspace-response';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const identity = await workspaceIdentity(request);
    await workspaceBody(request, EmptyWorkspaceRequest);
    return workspaceJson(await stepWorkspaceImport(identity));
  } catch (error) { return workspaceError(error); }
}
