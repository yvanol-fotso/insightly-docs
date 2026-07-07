import { Router } from "express";
import { embedText } from "../services/embeddings";
import { searchSimilar } from "../services/vectorStore";
import { askLLM } from "../services/llm";
import { getHistory, addMessage, clearHistory } from "../services/conversationStore";

const router = Router();

router.post("/chat", async (req, res) => {
  const { question, sessionId } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Le champ 'question' est requis" });
  }
  if (!sessionId) {
    return res.status(400).json({ error: "Le champ 'sessionId' est requis" });
  }

  try {
    const queryEmbedding = await embedText(question);
    const relevantChunks = await searchSimilar(queryEmbedding, sessionId, 3); // new on passe le sessionId au retrieval pour filtrer les documents pertinents pour cette conversation

    if (relevantChunks.length === 0) {
      return res.status(400).json({ error: "Aucun document indexé pour cette conversation" });
    }

    const context = relevantChunks.map((c) => c.content).join("\n\n---\n\n");
    const history = await getHistory(sessionId);

    const answer = await askLLM(question, context, history);

    await addMessage(sessionId, { role: "user", content: question });
    await addMessage(sessionId, { role: "assistant", content: answer });

    res.json({
      question,
      answer,
      sources: relevantChunks.map((c) => ({ filename: c.filename, score: c.score })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la génération de la réponse" });
  }
});

router.post("/chat/reset", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "Le champ 'sessionId' est requis" });
  }
  await clearHistory(sessionId);
  res.json({ message: "Historique réinitialisé" });
});

export default router;