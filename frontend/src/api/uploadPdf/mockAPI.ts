// vu que c est un pcoc je ne vais pas creer des les fichier de call des api pour chaque endpoint je vais tout mettre dans ce fichier 
// test axios et le fetch mais axios est plus court et top 
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface UploadedFile {
  filename: string;
  totalChunks: number;
}

export interface UploadResult {
  message: string;
  totalPages: number;
  files: UploadedFile[];
  totalStored: number;
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

export async function uploadFiles(files: File[], sessionId: string): Promise<UploadResult> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("sessionId", sessionId);

  const response = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Echec de l'upload (${response.status})`);
  }

  return response.json();
}

export async function askQuestion(question: string, sessionId: string): Promise<AskResult> {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, sessionId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Echec de la requete (${response.status})`);
  }

  return response.json();
}

export async function resetConversation(sessionId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/chat/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Echec de la reinitialisation (${response.status})`);
  }
}


export async function listSessions() {
  const res = await axios.get(`${BASE_URL}/sessions`);
  return res.data as {
    session_id: string;
    started_at: string;
    last_activity: string;
    preview: string;
  }[];
}

export async function getSession(sessionId: string) {
  const res = await axios.get(`${BASE_URL}/sessions/${sessionId}`);
  return res.data as {
    messages: { role: "user" | "assistant"; content: string }[];
    documents: { filename: string; chunks: number }[];
  };
}