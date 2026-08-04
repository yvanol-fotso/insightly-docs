import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pdfParse from "pdf-parse";
import { createJob } from "../services/jobStore";
import { enqueueDocumentIngestion } from "../queue/documentQueue";

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
    // Vérification rapide du nombre de pages. On utilise pdf-parse seul ici (sans passer par extractTextFromPDF/OCR) : même sur un PDF scanné, ça reste
    // rapide car on ne lit que les métadonnées/texte natif jamais l'OCR cloud.
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

    const useGraph = process.env.RAG_STRATEGY === "graph";

    // Le reste du traitement (extraction/OCR chunking, embeddings  vector store,
    // puis ingestion graphe) part en arrière-plan via document-worker on répond tout de suite pour éviter qu'un PDF scanné (OCR potentiellement long) ne bloque la requête HTTP d'upload.
    const results = [];
    for (const file of files) {
      const jobId = await createJob(sessionId, file.filename, 0, "document");
      await enqueueDocumentIngestion({
        jobId,
        sessionId,
        filename: file.filename,
        filePath: file.path,
        useGraph,
      });

      results.push({ filename: file.filename, documentJobId: jobId });
    }

    res.json({
      message: `${files.length} fichier(s) reçu(s), traitement en cours en arrière-plan`,
      totalPages,
      files: results,
      graphIngestion: useGraph,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors du traitement des fichiers" });
  }
});

export default router;