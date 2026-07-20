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

      {partialJobs.map((job) => {
        const successRate = Math.round(
          ((job.total_chunks - job.failed_chunks) / job.total_chunks) * 100
        );

        return (
          <div key={job.id} className="indexing-progress__partial">
            <div className="indexing-progress__partial-header">
              <span>Indexation partielle - {job.filename}</span>
            </div>
            <p className="indexing-progress__partial-text">
              {job.total_chunks - job.failed_chunks} / {job.total_chunks} extraits indexés avec succès
              ({successRate}%). {job.failed_chunks} extrait(s) n'ont pas pu être traités, généralement en
              raison d'une limite de requêtes atteinte auprès du fournisseur LLM. Le graphe de connaissances
              pour ce document est donc incomplet — les réponses peuvent ne pas couvrir l'intégralité du
              contenu.
            </p>
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