import { indexVectors } from '../src/lib/vector-retrieval';

// Trusted operator command; never called by a public HTTP endpoint.
async function main(): Promise<void> {
  if (process.env.KNOWBRIDGE_STORE !== 'firestore') throw new Error('Vector indexing requires Firestore source storage.');
  // The demo project's observed quota is five embedding requests per minute.
  console.log(JSON.stringify(await indexVectors(undefined, { embeddingIntervalMs: 15_000 })));
}
main().catch(() => {
  console.error('Vector indexing failed. Check Vertex AI configuration, ADC, Firestore permissions and ingested records.');
  process.exitCode = 1;
});
