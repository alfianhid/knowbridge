import { ingestSyntheticSources } from '../src/lib/sources';
import { getSourceStore } from '../src/lib/source-store';

// Trusted CLI bootstrap. HTTP ingestion separately requires verified admin identity.
async function main(): Promise<void> {
  const result = await ingestSyntheticSources({ store: getSourceStore() });
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}
main().catch(() => { console.error('Ingestion failed. Check storage configuration and permissions.'); process.exitCode = 1; });
