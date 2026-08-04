import { Worker, Job } from "bullmq";
import { connection } from "./redis";
import { DocumentIngestionJobData } from "./documentQueue";
import { extractTextFromPDF } from "../services/pdfLoader";
import { chunkText } from "../services/chunker";
import { embedText } from "../services/embeddings";
import { addToStore } from "../services/vectorStore";
import { pool } from "../services/db";
import { enqueueGraphIngestion } from "./graphQueue";
import {
  markProcessing,
  setTotalChunks,
  incrementProgress,
  markCompleted,
  markFailed,
  createJob,
} from "../services/jobStore";

export function startDocumentWorker() {
  const worker = new Worker<DocumentIngestionJobData>(
    "document-ingestion",
    async (job: Job<DocumentIngestionJobData>) => {
      const { jobId, sessionId, filename, filePath, useGraph } = job.data;

      await markProcessing(jobId);
      console.log(`[document-worker] Début extraction/indexation : ${filename}`);

      try {
        const text = await extractTextFromPDF(filePath);
        const chunks = chunkText(text);

        // Le nombre total de chunks n'est connu qu'à cette étape contrairement à un job graphe où il est fourni dès la création
        await setTotalChunks(jobId, chunks.length);

        console.log(
          `[document-worker] Génération des embeddings pour ${filename} (${chunks.length} chunks)...`
        );

        const chunksWithEmbeddings = [];
        for (const chunk of chunks) {
          try {
            const embedding = await embedText(chunk.content);
            chunksWithEmbeddings.push({
              ...chunk,
              embedding,
              filename,
              sessionId,
            });
            await incrementProgress(jobId, false);
          } catch (embedError) {
            console.error(
              `[document-worker] Échec de l'embedding d'un chunk de ${filename} :`,
              embedError
            );
            await incrementProgress(jobId, true);
          }
        }

        // On indexe toujours le vector store pour permettre au user de basculer librement entre mode Naive et mode Graph sans avoir à réuploader le document Un échec ici ne doit pas empêcher l'ingestion graphe.
        try {
          await addToStore(chunksWithEmbeddings);
        } catch (vectorStoreError) {
          console.error(
            `[document-worker] Échec de l'indexation vectorielle pour ${filename} (mode Naive indisponible pour ce document tant que ce n'est pas corrigé) :`,
            vectorStoreError
          );
        }

        await pool.query(
          `INSERT INTO documents (session_id, filename, chunks) VALUES ($1, $2, $3)`,
          [sessionId, filename, chunks.length]
        );

        // L'ingestion graphe part dans sa propre queue et son propre job de suivi indépendamment du résultat du vector store ci dessus
        if (useGraph) {
          const graphJobId = await createJob(
            sessionId,
            filename,
            chunksWithEmbeddings.length,
            "graph"
          );
          await enqueueGraphIngestion({
            jobId: graphJobId,
            sessionId,
            filename,
            chunks: chunksWithEmbeddings.map((c) => ({ content: c.content })),
          });
        }

        await markCompleted(jobId);
        console.log(`[document-worker] Extraction/indexation terminée : ${filename}`);
      } catch (error) {
        console.error(`[document-worker] Échec du traitement de ${filename} :`, error);
        await markFailed(jobId, error instanceof Error ? error.message : String(error));
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    if (job) {
      console.error(`[document-worker] Job échoué (niveau BullMQ) pour ${job.data.filename} :`, err.message);
    }
  });

  console.log("[document-worker] Worker d'extraction/indexation démarré");
  return worker;
}