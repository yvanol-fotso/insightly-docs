import path from "path";
import os from "os";
import fs from "fs/promises";
// @ts-ignore -- pdf-poppler n'a pas de types TS publiés
import poppler from "pdf-poppler";

/**
 * Convertit chaque page PDF en image pour permettre le traitement OCR par lot.
 */
export async function rasterizePdfToImages(pdfPath: string): Promise<string[]> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-ocr-"));
  const prefix = "page";

  try {
    await poppler.convert(pdfPath, {
      format: "png",
      out_dir: outDir,
      out_prefix: prefix,
      page: null, // toutes les pages
    });

    const files = (await fs.readdir(outDir))
      .filter((f) => f.startsWith(prefix) && f.endsWith(".png"))
      .sort((a, b) => extractPageNumber(a) - extractPageNumber(b));

    const base64Images: string[] = [];
    for (const file of files) {
      const buffer = await fs.readFile(path.join(outDir, file));
      base64Images.push(buffer.toString("base64"));
    }
    return base64Images;
  } finally {
    // Nettoyage systématique du dossier temporaire même si la conversion a échoué
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

function extractPageNumber(filename: string): number {
  const match = filename.match(/-(\d+)\.png$/);
  return match ? parseInt(match[1], 10) : 0;
}