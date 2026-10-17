import { AskRequestSchema } from '../../../../lib/ask-contracts';
import { askWorkspace } from '../../../../lib/workspace-query';
import { workspaceBody, workspaceError, workspaceIdentity, workspaceJson } from '../../../../lib/workspace-response';

export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const identity = await workspaceIdentity(request);
    const { question } = await workspaceBody(request, AskRequestSchema);
    return workspaceJson(await askWorkspace(question, identity));
  } catch (error) { return workspaceError(error); }
}
