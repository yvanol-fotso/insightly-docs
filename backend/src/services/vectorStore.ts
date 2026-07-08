// new bascule automatiquement entre Chroma (local) et Qdrant (prod)
// selon la presence de la variable d'environnement QDRANT_URL.

const useQdrant = !!process.env.QDRANT_URL;

type VectorStoreModule = typeof import("./vectorStore.qdrant");

let modulePromise: Promise<VectorStoreModule> | null = null;

function loadImpl(): Promise<VectorStoreModule> {
  if (!modulePromise) {
    modulePromise = useQdrant
      ? import("./vectorStore.qdrant")
      : (import("./vectorStore.chroma") as unknown as Promise<VectorStoreModule>);
  }
  return modulePromise;
}

interface StoredChunk {
  id: number;
  content: string;
  embedding: number[];
  filename: string;
  sessionId: string;
}

export async function addToStore(chunks: StoredChunk[]) {
  const impl = await loadImpl();
  return impl.addToStore(chunks);
}

export async function searchSimilar(
  queryEmbedding: number[],
  sessionId: string,
  topK: number = 3
) {
  const impl = await loadImpl();
  return impl.searchSimilar(queryEmbedding, sessionId, topK);
}

export async function getStoreSize() {
  const impl = await loadImpl();
  return impl.getStoreSize();
}