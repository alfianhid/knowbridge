import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, requireBriefIdentity, type BriefIdentity } from './access';
import { limitPublicReads, readBoundedJson } from './api-limits';
import { requireWorkspaceEnabled, requireWorkspaceOrigin } from './workspace-config';

const HEADERS = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export function workspaceJson(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, { status, headers: HEADERS });
}

export function workspaceError(error: unknown): NextResponse {
  if (error instanceof ApiError) return workspaceJson({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return workspaceJson({ error: 'Invalid Workspace request.' }, 400);
  // Provider errors can contain credentials and file contents; never serialize or log them.
  return workspaceJson({ error: 'Workspace unavailable. Check the connection and retry.' }, 503);
}

export async function workspaceIdentity(request: Request, cleanup = false): Promise<BriefIdentity> {
  limitPublicReads();
  if (!cleanup) requireWorkspaceEnabled();
  if (request.method !== 'GET') requireWorkspaceOrigin(request, cleanup);
  return requireBriefIdentity(request);
}

export async function workspaceBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await readBoundedJson(request));
}

export const EmptyWorkspaceRequest = z.object({}).strict();
