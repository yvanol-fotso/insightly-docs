import { useEffect, useRef, useState } from "react";
import { getIndexingStatus } from "../../api/ragApi";
import type { IndexingJob } from "../../api/ragApi";

interface IndexingProgressProps {
  sessionId: string;
  onAllCompleted?: () => void;
  // Called once when a "document" job finishes, to update the final document info.
  onDocumentJobSettled?: (job: IndexingJob) => void;
}

const POLL_INTERVAL_MS = 2000;

const TERMINAL_STATUSES = new Set(["completed", "completed_with_errors", "failed"]);

function jobLabel(job: IndexingJob): string {
  return job.job_type === "graph" ? "Graph indexing" : "Document extraction";
}

function jobUnitLabel(job: IndexingJob): string {
  return job.job_type === "graph" ? "chunks processed" : "chunks generated";
}

export default function IndexingProgress({
  sessionId,
  onAllCompleted,
  onDocumentJobSettled,
}: IndexingProgressProps) {
  const [jobs, setJobs] = useState<IndexingJob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settledJobIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getIndexingStatus(sessionId);
        if (cancelled) return;
        setJobs(result);

        for (const job of result) {
          if (
            job.job_type === "document" &&
            TERMINAL_STATUSES.has(job.status) &&
            !settledJobIdsRef.current.has(job.id)
          ) {
            settledJobIdsRef.current.add(job.id);
            onDocumentJobSettled?.(job);
          }
        }

        const stillRunning = result.some(
          (j) => j.status === "pending" || j.status === "processing"
        );

        if (!stillRunning && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          onAllCompleted?.();
        }
      } catch {
        // Transient polling error: retry on the next interval.
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, onAllCompleted, onDocumentJobSettled]);

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const partialJobs = jobs.filter((j) => j.status === "completed_with_errors");
  const failedJobs = jobs.filter((j) => j.status === "failed");

  if (jobs.length === 0) return null;

  return (
    <div className="indexing-progress">
      {activeJobs.map((job) => {
        const percent =
          job.total_chunks > 0
            ? Math.round((job.processed_chunks / job.total_chunks) * 100)
            : 0;

        return (
          <div key={job.id} className="indexing-progress__item">
            <div className="indexing-progress__label">
              <span>
                {jobLabel(job)} · {job.filename}
              </span>
              <span>{job.total_chunks > 0 ? `${percent}%` : "…"}</span>
            </div>
            <div className="indexing-progress__bar-track">
              <div className="indexing-progress__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="indexing-progress__meta">
              {job.total_chunks > 0
                ? `${job.processed_chunks} / ${job.total_chunks} ${jobUnitLabel(job)}`
                : "Preparing…"}
              {job.failed_chunks > 0 && (
                <span className="indexing-progress__warning"> · {job.failed_chunks} failed</span>
              )}
            </div>
          </div>
        );
      })}

      {partialJobs.map((job) => {
        const successRate =
          job.total_chunks > 0
            ? Math.round(((job.total_chunks - job.failed_chunks) / job.total_chunks) * 100)
            : 0;

        return (
          <div key={job.id} className="indexing-progress__partial">
            <div className="indexing-progress__partial-header">
              <span>
                {jobLabel(job)} partially completed · {job.filename}
              </span>
            </div>
            <p className="indexing-progress__partial-text">
              {job.total_chunks - job.failed_chunks} of {job.total_chunks} chunks processed successfully (
              {successRate}%). {job.failed_chunks} chunk(s) could not be processed, most often because the
              LLM provider's rate limit was reached. Answers may not cover the entire document.
            </p>
          </div>
        );
      })}

      {failedJobs.map((job) => (
        <div key={job.id} className="indexing-progress__error">
          "{jobLabel(job)}" failed for {job.filename}
          {job.error_message ? `: ${job.error_message}` : ""}
        </div>
      ))}
    </div>
  );
}