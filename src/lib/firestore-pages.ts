import type { DocumentData, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// A document cursor advances even when callers retain or delete processed records.
export async function* firestoreDocuments(query: Query<DocumentData>, pageSize = 100): AsyncGenerator<QueryDocumentSnapshot<DocumentData>> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('Invalid Firestore page size.');
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  for (;;) {
    const page = await (cursor ? query.startAfter(cursor) : query).limit(pageSize).get();
    for (const document of page.docs) yield document;
    if (page.size < pageSize) return;
    cursor = page.docs[page.docs.length - 1];
  }
}
