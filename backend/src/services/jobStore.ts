import { pool } from "./db";

export type JobStatus = "pending" | "processing" | "completed" | "completed_with_errors" | "failed";

export interface IndexingJob {
  id: number;
  session_id: string;
  filename: string;
  status: JobStatus;
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
  error_message: string | null;
}

export async function createJob(
  sessionId: string,
  filename: string,
  totalChunks: number
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO indexing_jobs (session_id, filename, status, total_chunks)
     VALUES ($1, $2, 'pending', $3) RETURNING id`,
    [sessionId, filename, totalChunks]
  );
  return result.rows[0].id;
}

export async function markProcessing(jobId: number) {
  await pool.query(
    `UPDATE indexing_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [jobId]
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
 * - "completed_with_errors" si au moins un chunk a échoué (le graphe est alors partiel)
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
    `SELECT id, session_id, filename, status, total_chunks, processed_chunks, failed_chunks, error_message
     FROM indexing_jobs WHERE session_id = $1 ORDER BY created_at DESC`,
    [sessionId]
  );
  return result.rows;
}