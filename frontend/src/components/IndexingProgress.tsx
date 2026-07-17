import { useEffect, useRef, useState } from "react";
import { getIndexingStatus } from "../api/ragApi";
import type { IndexingJob } from "../api/ragApi";

interface IndexingProgressProps {
  sessionId: string;
  onAllCompleted?: () => void;
}

const POLL_INTERVAL_MS = 2000;

export default function IndexingProgress({ sessionId, onAllCompleted }: IndexingProgressProps) {
  const [jobs, setJobs] = useState<IndexingJob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getIndexingStatus(sessionId);
        if (cancelled) return;
        setJobs(result);

        const stillRunning = result.some(
          (j) => j.status === "pending" || j.status === "processing"
        );

        if (!stillRunning && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          onAllCompleted?.();
        }
      } catch {
        // erreur de polling ponctuelle : on retentera au prochain intervalle
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, onAllCompleted]);

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
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
              <span>Indexation du graphe — {job.filename}</span>
              <span>{percent}%</span>
            </div>
            <div className="indexing-progress__bar-track">
              <div className="indexing-progress__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="indexing-progress__meta">
              {job.processed_chunks} / {job.total_chunks} extraits traités
              {job.failed_chunks > 0 && (
                <span className="indexing-progress__warning"> · {job.failed_chunks} échec(s)</span>
              )}
            </div>
          </div>
        );
      })}

      {failedJobs.map((job) => (
        <div key={job.id} className="indexing-progress__error">
          Échec de l'indexation graphe pour {job.filename}
          {job.error_message ? ` : ${job.error_message}` : ""}
        </div>
      ))}
    </div>
  );
}