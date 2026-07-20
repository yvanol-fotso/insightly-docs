import { Router } from "express";
import multer from "multer";
import path from "path";
import { extractTextFromPDF } from "../services/pdfLoader";
import { chunkText } from "../services/chunker";
import { embedText } from "../services/embeddings";
import { addToStore, getStoreSize } from "../services/vectorStore";
import { createJob } from "../services/jobStore";
import { enqueueGraphIngestion } from "../queue/graphQueue";
import { pool } from "../services/db";
import pdfParse from "pdf-parse";
import fs from "fs";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const MAX_FILES = 5;
const MAX_TOTAL_PAGES = 500;

router.post("/upload", upload.array("files", MAX_FILES), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const sessionId = req.body.sessionId;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }
  if (!sessionId) {
    return res.status(400).json({ error: "Le champ 'sessionId' est requis" });
  }

  try {
    let totalPages = 0;
    const pageCounts: { filename: string; pages: number }[] = [];

    for (const file of files) {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdfParse(dataBuffer);
      totalPages += data.numpages;
      pageCounts.push({ filename: file.filename, pages: data.numpages });
    }

    if (totalPages > MAX_TOTAL_PAGES) {
      return res.status(400).json({
        error: `Limite dépassée : ${totalPages} pages au total (max ${MAX_TOTAL_PAGES})`,
        details: pageCounts,
      });
    }

    const results = [];
    const useGraph = process.env.RAG_STRATEGY === "graph";

    for (const file of files) {
      const text = await extractTextFromPDF(file.path);
      const chunks = chunkText(text);

      console.log(`Génération des embeddings pour ${file.filename} (${chunks.length} chunks)...`);

      const chunksWithEmbeddings = [];
      for (const chunk of chunks) {
        const embedding = await embedText(chunk.content);
        chunksWithEmbeddings.push({
          ...chunk,
          embedding,
          filename: file.filename,
          sessionId,
        });
      }

      // On indexe toujours le vector store, pour permettre à l'utilisateur de basculer
      // librement entre mode Naive et mode Graph sans avoir à réuploader le document.
      // Un échec ici (ex: Chroma non lancé) ne doit pas empêcher l'ingestion graphe.
      let vectorStoreIndexed = true;
      try {
        await addToStore(chunksWithEmbeddings);
      } catch (vectorStoreError) {
        vectorStoreIndexed = false;
        console.error(
          `Échec de l'indexation vectorielle pour ${file.filename} (le mode Naive ne fonctionnera pas pour ce document tant que ce n'est pas corrigé) :`,
          vectorStoreError
        );
      }

      // L'ingestion graphe part en arrière-plan, indépendamment du résultat du vector store.
      let jobId: number | null = null;
      if (useGraph) {
        jobId = await createJob(sessionId, file.filename, chunksWithEmbeddings.length);
        await enqueueGraphIngestion({
          jobId,
          sessionId,
          filename: file.filename,
          chunks: chunksWithEmbeddings.map((c) => ({ content: c.content })),
        });
      }

      await pool.query(
        `INSERT INTO documents (session_id, filename, chunks) VALUES ($1, $2, $3)`,
        [sessionId, file.filename, chunks.length]
      );

      results.push({
        filename: file.filename,
        totalChunks: chunks.length,
        graphJobId: jobId,
        vectorStoreIndexed,
      });
    }

    const anyVectorStoreFailure = results.some((r) => !r.vectorStoreIndexed);

    let totalStored: number | null = null;
    try {
      totalStored = await getStoreSize();
    } catch {
      // le vector store peut être indisponible ; on ne bloque pas la réponse pour autant
      totalStored = null;
    }

    res.json({
      message: anyVectorStoreFailure
        ? `${files.length} fichier(s) traité(s) — indexation graphe lancée, mais le stockage vectoriel a échoué pour un ou plusieurs fichiers (mode Naive indisponible pour ceux-ci)`
        : `${files.length} fichier(s) traité(s) et indexé(s) avec succès`,
      totalPages,
      files: results,
      totalStored,
      graphIngestion: useGraph,
      vectorStoreWarning: anyVectorStoreFailure,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors du traitement des fichiers" });
  }
});

export default router;