import { Worker, Job } from "bullmq";
import { connection } from "./redis";
import { GraphIngestionJobData } from "./graphQueue";
import { extractEntitiesAndRelationsBatched } from "../services/rag/graphExtraction";
import { ingestExtraction } from "../services/rag/graphStore";
import { runCommunityDetection } from "../services/rag/communityDetection";
import {
  markProcessing,
  incrementProgress,
  markCompleted,
  markFailed,
} from "../services/jobStore";

export function startGraphWorker() {
  const worker = new Worker<GraphIngestionJobData>(
    "graph-ingestion",
    async (job: Job<GraphIngestionJobData>) => {
      const { jobId, sessionId, filename, chunks } = job.data;

      await markProcessing(jobId);
      console.log(`[graph-worker] Début indexation graphe (batched) : ${filename} (${chunks.length} chunks)`);

      const chunkContents = chunks.map((c) => c.content);

      try {
        const extraction = await extractEntitiesAndRelationsBatched(chunkContents);
        await ingestExtraction(extraction, sessionId, filename);

        // on marque la progression comme complète en une fois, vu que le traitement
        // est désormais fait par batch et non plus chunk par chunk
        for (let i = 0; i < chunks.length; i++) {
          await incrementProgress(jobId, false);
        }
      } catch (error) {
        console.error(`[graph-worker] Échec du batch pour ${filename} :`, error);
        for (let i = 0; i < chunks.length; i++) {
          await incrementProgress(jobId, true);
        }
      }

      await markCompleted(jobId);
      console.log(`[graph-worker] Indexation graphe terminée : ${filename}`);

      // Détection de communautés en arrière-plan, ne bloque pas la réponse du job principal
      runCommunityDetection(sessionId).catch((err) =>
        console.error(`[graph-worker] Échec de la détection de communautés pour ${filename} :`, err)
      );
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("failed", async (job, err) => {
    if (job) {
      await markFailed(job.data.jobId, err.message);
      console.error(`[graph-worker] Job échoué pour ${job.data.filename} :`, err.message);
    }
  });

  console.log("[graph-worker] Worker d'indexation graphe démarré");
  return worker;
}