import { getDatabase } from '../src/lib/firebase';
import { disconnectWorkspaceConnection } from '../src/lib/workspace-auth';
import { clearWorkspaceImports } from '../src/lib/workspace-import';
import { firestoreDocuments } from '../src/lib/firestore-pages';

// Trusted operator maintenance. Dry-run by default; never prints identity, credentials or file data.
async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes('--execute');
  const now = Date.now();
  const database = getDatabase();
  let expired = 0, cleaned = 0, failed = 0, attempts = 0, scanned = 0;
  for await (const document of firestoreDocuments(database.collection('workspace_connections'))) {
    scanned++;
    const record = document.data();
    if (record.active === true && Number(record.expiresAt) > now) continue;
    if (typeof record.ownerUid !== 'string' || typeof record.tenantId !== 'string' || typeof record.id !== 'string' || !Number.isInteger(record.generation)) { failed++; continue; }
    expired++;
    if (!execute) continue;
    const identity = { uid: record.ownerUid, tenantId: record.tenantId };
    try {
      const disabled = await disconnectWorkspaceConnection(identity, { id: record.id, generation: record.generation });
      await clearWorkspaceImports(identity, {}, disabled.connectionId);
      cleaned++;
    } catch { failed++; }
  }
  for await (const attempt of firestoreDocuments(database.collection('workspace_oauth_attempts').where('expiresAt', '<=', now))) {
    attempts++;
    if (execute) {
      try { await attempt.ref.delete(); } catch { failed++; }
    }
  }
  console.info(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', scanned, expiredOrInactive: expired,
    cleaned, expiredAttempts: attempts, failed, truncated: false }));
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Workspace maintenance unavailable.'); process.exitCode = 1; });
