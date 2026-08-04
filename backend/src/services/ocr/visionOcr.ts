import { rasterizePdfToImages } from "./pdfRasterizer";

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

// new limite imposée par l'API Vision pour une requête images:annotate synchrone
const MAX_IMAGES_PER_REQUEST = 16;

// Nombre de tentatives en cas d'erreur transitoire (429 quota, 5xx serveur)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface VisionAnnotateResponse {
  responses: {
    fullTextAnnotation?: { text?: string };
    error?: { message: string };
  }[];
}

/**
 * traite un lot d'images avec retry sur erreurs temporaires et arrêt sur erreurs définitives.
 */
async function callVisionWithRetry(
  images: string[],
  apiKey: string
): Promise<string[]> {
  const requests = images.map((content) => ({
    image: { content },
    features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
  }));

  let attempt = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (true) {
    attempt++;

    const response = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (response.ok) {
      const data = (await response.json()) as VisionAnnotateResponse;
      return data.responses.map((r) => r.fullTextAnnotation?.text ?? "");
    }

    const isTransient = response.status === 429 || response.status >= 500;
    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      continue;
    }

    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Google Vision OCR a échoué (status ${response.status}) : ${errorBody}`
    );
  }
}

/**
 * Pipeline OCR complet : convertit les pages en images et extrait le texte.
 */
export async function extractTextViaVisionOCR(pdfPath: string): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_VISION_API_KEY manquante : impossible de faire de l'OCR cloud"
    );
  }

  const images = await rasterizePdfToImages(pdfPath);

  const maxPages = Number(process.env.OCR_MAX_PAGES ?? 30);
  if (images.length > maxPages) {
    throw new Error(
      `Le document scanné dépasse la limite de ${maxPages} pages autorisées pour l'OCR ` +
        `(reçu : ${images.length} pages). Augmentez OCR_MAX_PAGES si nécessaire, en gardant ` +
        `à l'esprit le temps de traitement et le coût supplémentaire.`
    );
  }

  const pageTexts: string[] = [];
  for (let i = 0; i < images.length; i += MAX_IMAGES_PER_REQUEST) {
    const batch = images.slice(i, i + MAX_IMAGES_PER_REQUEST);
    const batchTexts = await callVisionWithRetry(batch, apiKey);
    pageTexts.push(...batchTexts);
  }

  return pageTexts.join("\n\n");
}