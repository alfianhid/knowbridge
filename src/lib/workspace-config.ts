import { ApiError } from './access';

export interface WorkspaceRegistryEntry { fileId: string; sourceId: string; subject: string }
export interface WorkspaceConfig {
  origin: string; clientId: string; clientSecret: string; pickerApiKey: string;
  pickerAppId: string; kmsKey: string; allowedSubjects: ReadonlySet<string>; registry: WorkspaceRegistryEntry[];
}

export function requireWorkspaceEnabled(): void {
  if (process.env.KNOWBRIDGE_WORKSPACE_ENABLED !== 'true') throw new ApiError(503, 'Workspace integration is disabled.');
}

export function getWorkspaceConfig(): WorkspaceConfig {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new ApiError(503, 'Workspace configuration is incomplete.');
    return value;
  };
  const origin = required('WORKSPACE_ORIGIN');
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new ApiError(503, 'Workspace origin is invalid.');
  }
  const kmsKey = required('WORKSPACE_KMS_KEY');
  if (!/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/.test(kmsKey)) throw new ApiError(503, 'Workspace key is invalid.');
  let registry: unknown;
  try { registry = JSON.parse(required('WORKSPACE_REGISTRY_JSON')); } catch { throw new ApiError(503, 'Workspace registry is invalid.'); }
  if (!Array.isArray(registry) || !registry.length || registry.length > 3 || registry.some(entry => !entry || typeof entry.fileId !== 'string' || typeof entry.sourceId !== 'string' || typeof entry.subject !== 'string')) throw new ApiError(503, 'Workspace registry is invalid.');
  if (registry.some(entry => !/^[A-Za-z0-9_-]{1,200}$/.test(entry.fileId) || !/^[A-Za-z0-9_-]{1,100}$/.test(entry.sourceId) || !/^[A-Za-z0-9_-]{1,200}$/.test(entry.subject)) || new Set(registry.map(entry => entry.fileId)).size !== registry.length || new Set(registry.map(entry => entry.sourceId)).size !== registry.length) throw new ApiError(503, 'Workspace registry contains invalid or duplicate files.');
  const allowedSubjects = new Set(required('WORKSPACE_ALLOWED_SUBJECTS').split(',').map(value => value.trim()).filter(Boolean));
  if (!allowedSubjects.size || registry.some(entry => !allowedSubjects.has(entry.subject))) throw new ApiError(503, 'Workspace registry account is invalid.');
  return { origin, kmsKey, registry: registry as WorkspaceRegistryEntry[], allowedSubjects, clientId: required('GOOGLE_OAUTH_CLIENT_ID'), clientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'), pickerApiKey: required('GOOGLE_PICKER_API_KEY'), pickerAppId: required('GOOGLE_PICKER_APP_ID') };
}

export function workspacePublicConfig(): { enabled: boolean; configured: boolean } {
  let configured = false;
  try { getWorkspaceConfig(); configured = true; } catch { /* Missing prerequisites keep the connector unavailable. */ }
  return { enabled: process.env.KNOWBRIDGE_WORKSPACE_ENABLED === 'true', configured };
}

export function requireWorkspaceOrigin(request: Request, cleanup = false): void {
  // Bearer-authenticated cleanup remains available after connector configuration is removed.
  const origin = process.env.WORKSPACE_ORIGIN || (cleanup ? new URL(request.url).origin : undefined);
  if (!origin || request.headers.get('origin') !== origin || !workspaceRequestHasOrigin(request, origin)) throw new ApiError(403, 'Workspace origin check failed.');
}

export function workspaceRequestHasOrigin(request: Request, origin: string): boolean {
  if (new URL(request.url).origin === origin) return true;
  // Cloud Run terminates HTTPS before Next receives its internal HTTP request.
  // Require the configured external Host; do not trust caller-supplied forwarded host values.
  const expected = new URL(origin);
  return Boolean(process.env.K_SERVICE) && expected.protocol === 'https:'
    && request.headers.get('host') === expected.host
    && request.headers.get('x-forwarded-proto') === 'https';
}
