import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import uploadRoutes from "./routes/upload";
import chatRoutes from "./routes/chat";
import sessionsRoutes from "./routes/sessions";
import cors from "cors";
import { initDb } from "./services/db";

const app = express();
const PORT = process.env.PORT || 3000;

//  PR s'assurer que le dossier uploads existe CAR (Render a un filesystem ephemere,
// donc ce dossier disparait a chaque restart/redeploy)
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json());
app.use(cors());
app.use("/api", uploadRoutes);
app.use("/api", chatRoutes);
app.use("/api", sessionsRoutes);

app.get("/", (req, res) => {
  res.send("Test backend RAG operationnel");
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erreur lors de l'initialisation de la base de données :", err);
    process.exit(1);
  });