import { useEffect, useRef, useState } from "react";
import { getIndexingStatus } from "../api/ragApi";
import type { IndexingJob } from "../api/ragApi";

interface IndexingProgressProps {
  sessionId: string;
  onAllCompleted?: () => void;
// call a la fin d'un job "document" pour mettre à jour les informations finales
  onDocumentJobSettled?: (job: IndexingJob) => void;
}

const POLL_INTERVAL_MS = 2000;

const TERMINAL_STATUSES = new Set(["completed", "completed_with_errors", "failed"]);

function jobLabel(job: IndexingJob): string {
  return job.job_type === "graph" ? "Indexation du graphe" : "Extraction du document";
}

function jobUnitLabel(job: IndexingJob): string {
  return job.job_type === "graph" ? "extraits traités" : "extraits générés";
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

        // notifie le parent à la fin de chaque job "document" (une seule fois)
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
        // erreur de polling ponctuelle : on retentera au prochain intervalle
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
                {jobLabel(job)} — {job.filename}
              </span>
              <span>{job.total_chunks > 0 ? `${percent}%` : "…"}</span>
            </div>
            <div className="indexing-progress__bar-track">
              <div className="indexing-progress__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="indexing-progress__meta">
              {job.total_chunks > 0
                ? `${job.processed_chunks} / ${job.total_chunks} ${jobUnitLabel(job)}`
                : "Préparation en cours…"}
              {job.failed_chunks > 0 && (
                <span className="indexing-progress__warning"> · {job.failed_chunks} échec(s)</span>
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
                {jobLabel(job)} partielle — {job.filename}
              </span>
            </div>
            <p className="indexing-progress__partial-text">
              {job.total_chunks - job.failed_chunks} / {job.total_chunks} extraits traités avec succès
              ({successRate}%). {job.failed_chunks} extrait(s) n'ont pas pu être traités, généralement en
              raison d'une limite de requêtes atteinte auprès du fournisseur LLM. Le résultat pour ce
              document est donc incomplet — les réponses peuvent ne pas couvrir l'intégralité du contenu.
            </p>
          </div>
        );
      })}

      {failedJobs.map((job) => (
        <div key={job.id} className="indexing-progress__error">
          Échec de "{jobLabel(job).toLowerCase()}" pour {job.filename}
          {job.error_message ? ` : ${job.error_message}` : ""}
        </div>
      ))}
    </div>
  );
}