import { requireBriefIdentity } from '../src/lib/access';

// Trusted operator check. Supply token through the process environment, never argv or a tracked file.
async function main(): Promise<void> {
  const token = process.env.KNOWBRIDGE_ID_TOKEN;
  const intendedUid = process.env.KNOWBRIDGE_EXPECTED_UID;
  if (!token || !intendedUid) throw new Error('Identity input missing.');
  const identity = await requireBriefIdentity(new Request('http://localhost/operator-check', {
    headers: { authorization: `Bearer ${token}` },
  }));
  if (identity.uid !== intendedUid) throw new Error('Unexpected identity.');
  console.log(JSON.stringify({ verified: true, intendedUidMatched: true, revocationChecked: true, tenantId: identity.tenantId }));
}
main().catch(() => { console.error('Intended brief identity verification failed. Check protected operator inputs and Firebase membership.'); process.exitCode = 1; });
