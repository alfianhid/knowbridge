import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { DEMO_TENANT_ID, type SourceChunk } from './sources';
import { getAdminApp } from './firebase';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfterSeconds?: number) { super(message); }
}

export interface AccessScope {
  tenantId: string;
  sourceIds: ReadonlySet<string>;
}

export function authorizeChunks(chunks: SourceChunk[], scope: AccessScope): SourceChunk[] {
  if (chunks.some(chunk => chunk.tenantId !== scope.tenantId || !scope.sourceIds.has(chunk.sourceId))) {
    throw new ApiError(403, 'Source access denied.');
  }
  return chunks;
}

export function publicTenant(request: Request): string {
  const requested = request.headers.get('x-knowbridge-tenant');
  if (requested && requested !== DEMO_TENANT_ID) throw new ApiError(403, 'Source access denied.');
  // Public routes are fixed to the synthetic tenant, never a caller-selected private tenant.
  return DEMO_TENANT_ID;
}

type TokenVerifier = (token: string, checkRevoked: boolean) => Promise<DecodedIdToken>;

async function verifiedIdentity(request: Request, verifier?: TokenVerifier): Promise<DecodedIdToken> {
  if (!verifier && !process.env.GOOGLE_CLOUD_PROJECT) throw new ApiError(503, 'Admin authentication is not configured.');
  const header = request.headers.get('authorization') ?? '';
  if (header.length > 8192 || !/^Bearer [^\s]+$/.test(header)) throw new ApiError(401, 'Valid admin authentication required.');
  let identity: DecodedIdToken;
  try {
    identity = await (verifier ?? ((token, revoked) => getAuth(getAdminApp()).verifyIdToken(token, revoked)))(header.slice(7), true);
  } catch { throw new ApiError(401, 'Valid admin authentication required.'); }
  return identity;
}

export interface BriefIdentity { uid: string; tenantId: string }

// Preparation for protected Phase 3 routes; public synthetic search grants no write role.
export async function requireBriefIdentity(request: Request, verifier?: TokenVerifier): Promise<BriefIdentity> {
  const identity = await verifiedIdentity(request, verifier);
  if (!identity.uid || identity.knowbridgeTenant !== DEMO_TENANT_ID ||
    (identity.knowbridgeMember !== true && identity.knowbridgeAdmin !== true)) {
    throw new ApiError(403, 'Synthetic brief membership required.');
  }
  publicTenant(request);
  return { uid: identity.uid, tenantId: DEMO_TENANT_ID };
}

export async function requireIngestionAdmin(request: Request, verifier?: TokenVerifier): Promise<string> {
  const identity = await verifiedIdentity(request, verifier);
  if (identity.knowbridgeAdmin !== true || identity.knowbridgeTenant !== DEMO_TENANT_ID) {
    throw new ApiError(403, 'Synthetic ingestion admin access required.');
  }
  publicTenant(request);
  return identity.uid;
}
