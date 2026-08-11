import { Queue } from "bullmq";
import { connection } from "./redis";

export interface DocumentIngestionJobData {
  jobId: number;       // id dans la table indexing_jobs pour le suivi
  sessionId: string;
  filename: string;
  filePath: string;
  useGraph: boolean;   // si true l'ingestion graphe est enfilée après l'extraction
}

export const documentQueue = new Queue<DocumentIngestionJobData>("document-ingestion", {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export async function enqueueDocumentIngestion(data: DocumentIngestionJobData) {
  await documentQueue.add("ingest-document", data);
}