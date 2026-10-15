import { ingestSyntheticSources, SyntheticSeedAdapter } from '../src/lib/sources';
import { getSourceStore } from '../src/lib/source-store';

// Trusted CLI bootstrap. HTTP ingestion separately requires verified admin identity.
async function main(): Promise<void> {
  const args = process.argv.slice(3);
  if (args.length > 1 || (args.length && args[0] !== '--corpus=evaluation')) throw new Error('Unknown ingestion arguments.');
  const adapter = new SyntheticSeedAdapter(args.length ? 'evaluation' : 'harbour');
  const result = await ingestSyntheticSources({ store: getSourceStore(), adapter });
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}
main().catch(() => { console.error('Ingestion failed. Check storage configuration and permissions.'); process.exitCode = 1; });
