import { pool } from "./db";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const result = await pool.query(
    `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
}

export async function addMessage(sessionId: string, message: Message) {
  await pool.query(
    `INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)`,
    [sessionId, message.role, message.content]
  );
}

export async function clearHistory(sessionId: string) {
  await pool.query(`DELETE FROM messages WHERE session_id = $1`, [sessionId]);
}