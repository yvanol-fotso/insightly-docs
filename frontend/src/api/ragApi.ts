// vu que c est un POC je ne vais pas creer des fichiers de call API pour chaque endpoint.
// je vais centraliser tous les appels API dans ce fichier.

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const api = axios.create({
  baseURL: BASE_URL,
});

export interface UploadedFile {
  filename: string;
  totalChunks: number;
}

export interface UploadResult {
  message: string;
  totalPages: number;
  files: UploadedFile[];
  totalStored: number;
  graphIngestion?: boolean;
}

export interface Source {
  filename: string;
  score: number;
}

export interface AskResult {
  question: string;
  answer: string;
  sources: Source[];
}

export async function uploadFiles(
  files: File[],
  sessionId: string
): Promise<UploadResult> {
  const formData = new FormData();

  files.forEach((file) => formData.append("files", file));
  formData.append("sessionId", sessionId);

  try {
    const { data } = await api.post<UploadResult>("/upload", formData);
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error ??
        `Echec de l'upload (${error.response?.status ?? "unknown"})`
    );
  }
}

export async function askQuestion(
  question: string,
  sessionId: string
): Promise<AskResult> {
  try {
    const { data } = await api.post<AskResult>("/chat", {
      question,
      sessionId,
    });

    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error ??
        `Echec de la requete (${error.response?.status ?? "unknown"})`
    );
  }
}

export async function resetConversation(sessionId: string): Promise<void> {
  try {
    await api.post("/chat/reset", {
      sessionId,
    });
  } catch (error: any) {
    throw new Error(
      `Echec de la reinitialisation (${error.response?.status ?? "unknown"})`
    );
  }
}

export async function listSessions() {
  const { data } = await api.get<
    {
      session_id: string;
      started_at: string;
      last_activity: string;
      preview: string;
    }[]
  >("/sessions");

  return data;
}

export async function getSession(sessionId: string) {
  const { data } = await api.get<{
    messages: { role: "user" | "assistant"; content: string }[];
    documents: { filename: string; chunks: number }[];
  }>(`/sessions/${sessionId}`);

  return data;
}


export interface IndexingJob {
  id: number;
  session_id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
  error_message: string | null;
}

export async function getIndexingStatus(sessionId: string): Promise<IndexingJob[]> {
  try {
    const { data } = await api.get<{ jobs: IndexingJob[] }>(
      `/indexing-status/${sessionId}`
    );
    return data.jobs;
  } catch (error: any) {
    throw new Error(
      `Echec de la récupération du statut d'indexation (${error.response?.status ?? "unknown"})`
    );
  }
}