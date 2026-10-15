// All API calls live in this file.

import axios from "axios";
import type { ConversationEntry } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const api = axios.create({
  baseURL: BASE_URL,
});

export interface UploadedFile {
  filename: string;
  documentJobId: number;
}

export interface UploadResult {
  message: string;
  totalPages: number;
  files: UploadedFile[];
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
        `Upload failed (${error.response?.status ?? "unknown"})`
    );
  }
}

export async function askQuestion(
  question: string,
  sessionId: string,
  ragStrategy?: "naive" | "graph"
): Promise<AskResult> {
  try {
    const { data } = await api.post<AskResult>("/chat", {
      question,
      sessionId,
      ragStrategy,
    });
    return data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error ??
        `Request failed (${error.response?.status ?? "unknown"})`
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
      `Could not reset the conversation (${error.response?.status ?? "unknown"})`
    );
  }
}

export async function listSessions() {
  const { data } = await api.get<ConversationEntry[]>("/sessions");
  return data;
}

/** Requires PATCH /sessions/:id on the backend (see FEATURES.manageConversations). */
export async function renameSession(sessionId: string, title: string): Promise<void> {
  await api.patch(`/sessions/${sessionId}`, { title });
}

/** Requires DELETE /sessions/:id on the backend (see FEATURES.manageConversations). */
export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}`);
}

export async function getSession(sessionId: string) {
  const { data } = await api.get<{
    messages: { role: "user" | "assistant"; content: string }[];
    documents: { filename: string; chunks: number }[];
  }>(`/sessions/${sessionId}`);

  return data;
}

export type IndexingJobType = "document" | "graph";

export interface IndexingJob {
  id: number;
  session_id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "completed_with_errors" | "failed";
  job_type: IndexingJobType;
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
      `Could not fetch the indexing status (${error.response?.status ?? "unknown"})`
    );
  }
}