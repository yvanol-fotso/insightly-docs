import { ChromaClient, EmbeddingFunction } from "chromadb";

const client = new ChromaClient({ path: "http://localhost:8000" });
const COLLECTION_NAME = "rag_poc";


// jamais call car on fournit toujour nos propres embeddings
const noopEmbeddingFunction: EmbeddingFunction = {
  generate: async (texts: string[]): Promise<number[][]> => {
    throw new Error("embeddingFunction ne devrait jamais être appelée ici");
  },
};

let collection: any = null;

async function getCollection() {
  if (!collection) {
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: noopEmbeddingFunction,
    });
  }
  return collection;
}

interface StoredChunk {
  id: number;
  content: string;
  embedding: number[];
  filename: string;
  sessionId: string; 
}

export async function addToStore(chunks: StoredChunk[]) {
  const col = await getCollection();

  await col.add({
    ids: chunks.map((c) => `${c.sessionId}-${c.filename}-${c.id}`),
    embeddings: chunks.map((c) => c.embedding),
    documents: chunks.map((c) => c.content),
    metadatas: chunks.map((c) => ({ filename: c.filename, sessionId: c.sessionId })),
  });
}

export async function searchSimilar(
  queryEmbedding: number[],
  sessionId: string, 
  topK: number = 3
) {
  const col = await getCollection();

  const results = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where: { sessionId }, 
  });

  const documents = results.documents[0] as string[];
  const metadatas = results.metadatas[0] as { filename: string }[];
  const distances = results.distances[0] as number[];

  return documents.map((content, i) => ({
    content,
    filename: metadatas[i].filename,
    score: 1 - distances[i], // use chroma pr retourner une distance on la convertit en score de similarite
  }));
}

export async function getStoreSize() {
  const col = await getCollection();
  const count = await col.count();
  return count;
}