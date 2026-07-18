import { Router } from "express";
import { askRag } from "../services/rag/ragEngine";
import { addMessage, clearHistory } from "../services/conversationStore";

const router = Router();

router.post("/chat", async (req, res) => {
  const { question, sessionId, ragStrategy } = req.body;

  if (!question) return res.status(400).json({ error: "Le champ 'question' est requis" });
  if (!sessionId) return res.status(400).json({ error: "Le champ 'sessionId' est requis" });

  try {
    const { answer, sources } = await askRag(question, sessionId, ragStrategy);

    await addMessage(sessionId, { role: "user", content: question });
    await addMessage(sessionId, { role: "assistant", content: answer });

    res.json({ question, answer, sources, ragStrategy: ragStrategy ?? process.env.RAG_STRATEGY ?? "naive" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la génération de la réponse" });
  }
});


router.post("/chat/reset", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Le champ 'sessionId' est requis" });
  await clearHistory(sessionId);
  res.json({ message: "Historique réinitialisé" });
});

export default router;