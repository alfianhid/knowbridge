import { FieldValue } from 'firebase-admin/firestore';
import { authorizeChunks, type AccessScope } from './access';
import { getDatabase } from './firebase';
import { embed, getAIConfig, validateEmbedding } from './gemini';
import { getSourceStore } from './source-store';
import { DEMO_TENANT_ID, SourceRecordSchema, type IngestionStore, type SourceChunk } from './sources';

export async function retrieveVectors(question: string, scope: AccessScope): Promise<SourceChunk[]> {
  if (scope.tenantId !== DEMO_TENANT_ID || !scope.sourceIds.size) return [];
  const ids = [...scope.sourceIds];
  if (ids.length > 192 || ids.some(id => !/^[A-Z0-9-]{1,64}$/.test(id))) throw new Error('Invalid retrieval scope.');
  const queryVector = await embed(question, 'RETRIEVAL_QUERY');
  const collection = getDatabase().collection(`tenants/${scope.tenantId}/chunks`);
  const candidates: { chunk: SourceChunk; distance: number }[] = [];
  const store = getSourceStore();
  const config = getAIConfig();
  for (let offset = 0; offset < ids.length; offset += 30) {
    const snapshot = await collection.where('sourceId', 'in', ids.slice(offset, offset + 30)).findNearest({
      vectorField: 'embedding', queryVector, distanceMeasure: 'COSINE', limit: 24, distanceResultField: 'vectorDistance',
    }).get();
    for (const document of snapshot.docs) {
      const data = document.data();
      if (data.tenantId !== scope.tenantId || !scope.sourceIds.has(data.sourceId)) throw new Error('Vector scope violation.');
      if (data.embeddingModel !== config.embeddingModel || data.embeddingDimensions !== 768) continue;
      const source = await store.get(scope.tenantId, data.sourceId);
      if (!source) continue;
      const parsed = SourceRecordSchema.parse(source);
      const chunk = parsed.chunks.find(item => item.id === document.id);
      if (!chunk || data.contentHash !== parsed.contentHash || Object.entries(chunk).some(([key, value]) => data[key] !== value)) continue;
      if (typeof data.vectorDistance !== 'number' || !Number.isFinite(data.vectorDistance)) throw new Error('Invalid vector distance.');
      candidates.push({ chunk, distance: data.vectorDistance });
    }
  }
  return authorizeChunks(candidates.sort((a, b) => a.distance - b.distance).slice(0, 12).map(item => item.chunk), scope);
}

export async function indexVectors(store: IngestionStore = getSourceStore(), options: { embeddingIntervalMs?: number } = {}): Promise<{ indexed: number; cached: number }> {
  const interval = options.embeddingIntervalMs ?? 0;
  if (!Number.isInteger(interval) || interval < 0 || interval > 60_000) throw new Error('Invalid embedding interval.');
  const config = getAIConfig();
  const database = getDatabase();
  let indexed = 0;
  let cached = 0;
  let lastEmbeddingAt = 0;
  for (const record of await store.list(DEMO_TENANT_ID)) {
    const source = SourceRecordSchema.parse(record);
    for (const chunk of source.chunks) {
      const cacheId = `${config.embeddingModel}-768-${chunk.checksum.slice(7)}`;
      const cache = database.doc(`tenants/${DEMO_TENANT_ID}/embeddingCache/${cacheId}`);
      const existing = await cache.get();
      let values: number[];
      if (existing.exists) {
        const data = existing.data();
        if (data?.model !== config.embeddingModel || data?.dimensions !== 768 || data?.checksum !== chunk.checksum) {
          throw new Error('Embedding cache provenance mismatch.');
        }
        values = validateEmbedding(data.values);
        cached += 1;
      } else {
        const delay = interval - (Date.now() - lastEmbeddingAt);
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        lastEmbeddingAt = Date.now();
        values = await embed(chunk.body, 'RETRIEVAL_DOCUMENT');
        await cache.set({ values, model: config.embeddingModel, dimensions: 768, checksum: chunk.checksum });
      }
      await database.doc(`tenants/${DEMO_TENANT_ID}/chunks/${chunk.id}`).set({
        ...chunk, contentHash: source.contentHash, embedding: FieldValue.vector(values),
        embeddingModel: config.embeddingModel, embeddingDimensions: 768,
      });
      indexed += 1;
    }
  }
  return { indexed, cached };
}
