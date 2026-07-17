import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// Plafonne le nombre d'appels Groq simultanés.
// Groq (tier gratuit) tolère un certain nombre de requêtes/minute selon le modèle ;
// on reste volontairement prudent avec une concurrence faible.
const MAX_CONCURRENT_CALLS = 2;

const limit = pLimit(MAX_CONCURRENT_CALLS);

interface GroqErrorLike {
  status?: number;
  response?: { status?: number };
}

function getStatusCode(error: unknown): number | undefined {
  const err = error as GroqErrorLike;
  return err?.status ?? err?.response?.status;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Exécute un appel Groq en respectant :
 * - la limite de concurrence globale (MAX_CONCURRENT_CALLS)
 * - un retry avec backoff exponentiel en cas de 429 (rate limit) ou 5xx (erreur serveur)
 *
 * Les erreurs 4xx autres que 429 (ex: 400 mauvaise requête) ne sont PAS retentées,
 * car réessayer une requête mal formée ne changera rien.
 */
export async function callGroqWithLimit<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  return limit(() =>
    pRetry(
      async () => {
        try {
          return await fn();
        } catch (error) {
          const status = getStatusCode(error);

          // erreur définitive : on ne réessaie pas, on abandonne immédiatement
          if (status && status < 500 && status !== 429) {
            throw new AbortError(error as Error);
          }

          // 429 (rate limit) ou 5xx (erreur serveur) : on relance pRetry
          throw error;
        }
      },
      {
        retries: 3,
        factor: 2, // backoff exponentiel : 1s, 2s, 4s...
        minTimeout: 1000,
        maxTimeout: 15000,
        randomize: true, // jitter, pour éviter que plusieurs chunks ne retentent pile au même moment
        onFailedAttempt: (error: any) => {
          const attemptNumber = error?.attemptNumber ?? "?";
          const retriesLeft = error?.retriesLeft ?? "?";
          console.warn(
            `[groq-limiter] ${context} — tentative ${attemptNumber} échouée ` +
            `(${retriesLeft} restantes) : ${getErrorMessage(error)}`
          );
        },
      }
    )
  );
}