import { Router } from "express";
import { pool } from "../services/db";

const router = Router();

// new pr liiste toutes les conversations
router.get("/sessions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        session_id,
        MIN(created_at) AS started_at,
        MAX(created_at) AS last_activity,
        (
          SELECT content FROM messages m2
          WHERE m2.session_id = m.session_id AND m2.role = 'user'
          ORDER BY m2.created_at ASC LIMIT 1
        ) AS preview
      FROM messages m
      GROUP BY session_id
      ORDER BY last_activity DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des conversations" });
  }
});

// load les messages et docs d'une conversation precise
router.get("/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const messagesResult = await pool.query(
      `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    const documentsResult = await pool.query(
      `SELECT filename, chunks FROM documents WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    res.json({
      messages: messagesResult.rows,
      documents: documentsResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors du chargement de la conversation" });
  }
});

export default router;