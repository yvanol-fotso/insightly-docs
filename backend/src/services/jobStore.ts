import { pool } from "./db";

export type JobStatus = "pending" | "processing" | "completed" | "completed_with_errors" | "failed";
export type JobType = "document" | "graph";

export interface IndexingJob {
  id: number;
  session_id: string;
  filename: string;
  status: JobStatus;
  job_type: JobType;
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
  error_message: string | null;
}

export async function createJob(
  sessionId: string,
  filename: string,
  totalChunks: number,
  jobType: JobType = "graph"
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO indexing_jobs (session_id, filename, status, total_chunks, job_type)
     VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
    [sessionId, filename, totalChunks, jobType]
  );
  return result.rows[0].id;
}

export async function markProcessing(jobId: number) {
  await pool.query(
    `UPDATE indexing_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [jobId]
  );
}

/**
 * Fixe le nombre total de chunks a posteriori, pour les jobs dont ce nombre
 * n'est connu qu'après extraction + découpage (job de type "document"),
 * contrairement aux jobs "graph" où il est connu dès la création.
 */
export async function setTotalChunks(jobId: number, totalChunks: number) {
  await pool.query(
    `UPDATE indexing_jobs SET total_chunks = $2, updated_at = NOW() WHERE id = $1`,
    [jobId, totalChunks]
  );
}

export async function incrementProgress(jobId: number, failed = false) {
  await pool.query(
    `UPDATE indexing_jobs
     SET processed_chunks = processed_chunks + 1,
         failed_chunks = failed_chunks + $2,
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, failed ? 1 : 0]
  );
}

/**
 * Marque le job comme terminé. Le statut final dépend du nombre de chunks échoués :
 * - "completed" si tout s'est bien passé
 * - "completed_with_errors" si au moins un chunk a échoué (le résultat est alors partiel)
 */
export async function markCompleted(jobId: number) {
  const result = await pool.query(
    `SELECT failed_chunks FROM indexing_jobs WHERE id = $1`,
    [jobId]
  );
  const failedChunks = result.rows[0]?.failed_chunks ?? 0;
  const finalStatus: JobStatus = failedChunks > 0 ? "completed_with_errors" : "completed";

  await pool.query(
    `UPDATE indexing_jobs SET status = $2, updated_at = NOW() WHERE id = $1`,
    [jobId, finalStatus]
  );
}

export async function markFailed(jobId: number, errorMessage: string) {
  await pool.query(
    `UPDATE indexing_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
    [jobId, errorMessage]
  );
}

export async function getJobsForSession(sessionId: string): Promise<IndexingJob[]> {
  const result = await pool.query(
    `SELECT id, session_id, filename, status, job_type, total_chunks, processed_chunks, failed_chunks, error_message
     FROM indexing_jobs WHERE session_id = $1 ORDER BY created_at DESC`,
    [sessionId]
  );
  return result.rows;
}