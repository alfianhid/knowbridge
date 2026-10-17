import { z } from 'zod';
import { startWorkspaceImport } from '../../../../lib/workspace-import';
import { workspaceBody, workspaceError, workspaceIdentity, workspaceJson } from '../../../../lib/workspace-response';

export const runtime = 'nodejs';
const ImportRequest = z.object({ fileIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/)).min(1).max(3)
  .refine(ids => new Set(ids).size === ids.length, 'Select distinct files.') }).strict();

export async function POST(request: Request) {
  try {
    const identity = await workspaceIdentity(request);
    const { fileIds } = await workspaceBody(request, ImportRequest);
    return workspaceJson(await startWorkspaceImport(identity, fileIds));
  } catch (error) { return workspaceError(error); }
}
