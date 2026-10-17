import { ApiError } from '../../../../../lib/access';
import { authorizedWorkspaceSources } from '../../../../../lib/workspace-import';
import { workspaceError, workspaceIdentity, workspaceJson } from '../../../../../lib/workspace-response';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ sourceId: string }> }) {
  try {
    const identity = await workspaceIdentity(request);
    const { sourceId } = await context.params;
    if (!/^[A-Z0-9-]{1,64}$/.test(sourceId)) throw new ApiError(404, 'Source not found.');
    const imported = (await authorizedWorkspaceSources(identity)).find(item => item.source.id === sourceId);
    if (!imported) throw new ApiError(404, 'Source not found.');
    const { id, title, kind, project, owner, recordedAt, effectiveAt, chunkCount, content } = imported.source;
    return workspaceJson({ id, title, kind, project, owner, recordedAt, effectiveAt, chunkCount, content, synthetic: true,
      sourceUrl: `/api/workspace/sources/${id}`, rawExport: imported.rawExport,
      fileId: imported.fileId, modifiedTime: imported.modifiedTime, version: imported.version, importedAt: imported.importedAt });
  } catch (error) { return workspaceError(error); }
}
