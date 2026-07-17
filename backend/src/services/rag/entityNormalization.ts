// Articles français à retirer en tête d'entité, pour éviter que
// "le réducteur" et "réducteur" soient traités comme deux entités différentes.
const LEADING_ARTICLES = /^(le|la|les|l'|un|une|des|du|de la|de l'|d')\s+/i;

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface NormalizedEntity {
  key: string;         // clé de fusion, stable, insensible à la casse/accents/articles
  display: string;      // nom "propre" à afficher, tel que fourni (juste trim des espaces)
}

export function normalizeEntityName(rawName: string): NormalizedEntity {
  const display = rawName.trim().replace(/\s+/g, " ");

  const withoutArticle = display.replace(LEADING_ARTICLES, "");
  const key = stripAccents(withoutArticle)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return { key, display };
}

/**
 * Choisit le "meilleur" nom d'affichage entre l'existant et le nouveau,
 * en préférant celui qui commence par une majuscule (souvent plus propre / nom propre)
 * et, à défaut, le plus court (moins de risque d'inclure du bruit).
 */
export function pickBetterDisplayName(existing: string, candidate: string): string {
  const existingStartsUpper = /^[A-ZÀ-Ý]/.test(existing);
  const candidateStartsUpper = /^[A-ZÀ-Ý]/.test(candidate);

  if (candidateStartsUpper && !existingStartsUpper) return candidate;
  if (existingStartsUpper && !candidateStartsUpper) return existing;

  return candidate.length < existing.length ? candidate : existing;
}