import fs from "fs";
import pdfParse from "pdf-parse";
import { extractTextViaVisionOCR } from "./ocr/visionOcr";

function cleanExtractedText(text: string): string {
  return text
    .replace(/([a-zà-ÿ0-9])([A-ZÀ-Ÿ])/g, "$1 $2")
    // pr normalise les espaces multiples avec retours a la ligne en un seul espace
    .replace(/\s+/g, " ")
    .trim();
}

// En dessous de ce nombre moyen de caractères par page, on considère que
// le PDF n'a pas de couche de texte exploitable (probablement un scan)
// et on bascule sur l'OCR cloud plutôt que de retourner un texte vide/inutile.
const MIN_CHARS_PER_PAGE = 20;

export async function extractTextFromPDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const cleaned = cleanExtractedText(data.text);

  const avgCharsPerPage =
    data.numpages > 0 ? cleaned.length / data.numpages : cleaned.length;

  if (avgCharsPerPage >= MIN_CHARS_PER_PAGE) {
    return cleaned;
  }

  console.log(
    `[pdf-loader] Texte natif insuffisant (${avgCharsPerPage.toFixed(1)} caractères/page en moyenne), ` +
      `bascule sur l'OCR cloud pour ${filePath}`
  );

  const ocrText = await extractTextViaVisionOCR(filePath);
  return cleanExtractedText(ocrText);
}