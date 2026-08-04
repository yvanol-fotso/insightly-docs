import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import uploadRoutes from "./routes/upload";
import chatRoutes from "./routes/chat";
import sessionsRoutes from "./routes/sessions";
import cors from "cors";
import { initDb } from "./services/db";
import { startGraphWorker } from "./queue/graphWorker";
import { startDocumentWorker } from "./queue/documentWorker";
import indexingStatusRoutes from "./routes/indexingStatus";

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json());
app.use(cors());
app.use("/api", uploadRoutes);
app.use("/api", chatRoutes);
app.use("/api", sessionsRoutes);
app.use("/api", indexingStatusRoutes);

app.get("/", (req, res) => {
  res.send("Test backend RAG operationnel");
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Le document-worker démarre toujours : l'extraction/OCR, le chunking et les
    // embeddings sont nécessaires quel que soit le mode RAG (Naive ou Graph).
    startDocumentWorker();

    // Le graph-worker, lui, ne démarre que si on est en stratégie graphe.
    if (process.env.RAG_STRATEGY === "graph") {
      startGraphWorker();
    }
  })
  .catch((err) => {
    console.error("Erreur lors de l'initialisation de la base de données :", err);
    process.exit(1);
  });