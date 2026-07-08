// prod

import { QdrantClient } from "@qdrant/js-client-rest";
import { v5 as uuidv5 } from "uuid";

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "rag_poc";
const VECTOR_SIZE = 384;
const NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

let collectionReady = false;

async function ensureCollection() {
  if (collectionReady) return;
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
  collectionReady = true;
}

interface StoredChunk {
  id: number;
  content: string;
  embedding: number[];
  filename: string;
  sessionId: string;
}

export async function addToStore(chunks: StoredChunk[]) {
  await ensureCollection();
  await client.upsert(COLLECTION_NAME, {
    points: chunks.map((c) => ({
      id: uuidv5(`${c.sessionId}-${c.filename}-${c.id}`, NAMESPACE),
      vector: c.embedding,
      payload: {
        content: c.content,
        filename: c.filename,
        sessionId: c.sessionId,
      },
    })),
  });
}

export async function searchSimilar(
  queryEmbedding: number[],
  sessionId: string,
  topK: number = 3
) {
  await ensureCollection();
  const results = await client.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    limit: topK,
    filter: {
      must: [{ key: "sessionId", match: { value: sessionId } }],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    content: r.payload?.content as string,
    filename: r.payload?.filename as string,
    score: r.score as number,
  }));
}

export async function getStoreSize() {
  await ensureCollection();
  const info = await client.getCollection(COLLECTION_NAME);
  return info.points_count ?? 0;
}