import Groq from "groq-sdk";
import { callGroqWithLimit } from "../groqLimiter";
import {
  extractionResultSchema,
  entitiesArraySchema,
  relationsArraySchema,
  ValidatedEntity,
  ValidatedRelation,
} from "./graphSchema";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ExtractionResult {
  entities: ValidatedEntity[];
  relations: ValidatedRelation[];
}

// Nombre de chunks regroupés par appel LLM.
// Un batch trop grand risque de dépasser la fenêtre de contexte du modèle
// ou de dégrader la qualité d'extraction (le LLM "dilue" son attention).
const BATCH_SIZE = 5;

const EXTRACTION_SYSTEM_PROMPT = `Tu es un moteur d'extraction d'entités et de relations pour un graphe de connaissances.

Tu vas recevoir PLUSIEURS extraits de texte, chacun précédé d'un marqueur [EXTRAIT n].
Pour CHAQUE extrait, identifie :
- les entités importantes (concepts, composants, processus, personnes, organisations, lieux, matériaux, etc.)
- les relations entre ces entités

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "entities": [{ "name": "string", "type": "string" }],
  "relations": [{ "source": "string", "relation": "string", "target": "string" }]
}

Règles :
- Fusionne les résultats de tous les extraits dans un seul JSON global (pas de séparation par extrait dans la réponse).
- Les noms d'entités doivent être courts et normalisés (pas de phrases entières).
- Les relations doivent être des verbes ou expressions courtes en MAJUSCULES_AVEC_UNDERSCORE (ex: FAIT_PARTIE_DE, UTILISE, PERMET_DE).
- Limite-toi aux entités et relations clairement présentes dans le texte, n'invente rien.
- Si aucun extrait ne contient d'entité exploitable, retourne { "entities": [], "relations": [] }.`;

function buildBatchPrompt(chunks: string[]): string {
  return chunks
    .map((content, i) => `[EXTRAIT ${i + 1}]\n${content}`)
    .join("\n\n");
}

/**
 * Extrait les entités/relations d'UN SEUL batch (plusieurs chunks regroupés en un appel LLM).
 */
async function extractBatch(chunkContents: string[]): Promise<ExtractionResult> {
  let rawParsed: unknown;

  try {
    const completion = await callGroqWithLimit(
      () =>
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: buildBatchPrompt(chunkContents) },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      `extraction batch (${chunkContents.length} chunks)`
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    rawParsed = JSON.parse(raw);
  } catch (error) {
    console.error("[graph-extraction] Échec de l'appel LLM ou JSON invalide pour ce batch :", error);
    return { entities: [], relations: [] };
  }

  const validation = extractionResultSchema.safeParse(rawParsed);

  if (!validation.success) {
    console.warn(
      "[graph-extraction] JSON structurellement invalide, filtrage entité par entité en repli :",
      validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ")
    );
    return filterValidItemsManually(rawParsed);
  }

  return validation.data;
}

function filterValidItemsManually(rawParsed: unknown): ExtractionResult {
  const obj = rawParsed as { entities?: unknown[]; relations?: unknown[] };

  const entities: ValidatedEntity[] = [];
  if (Array.isArray(obj?.entities)) {
    for (const item of obj.entities) {
      const parsed = entitiesArraySchema.element.safeParse(item);
      if (parsed.success) entities.push(parsed.data);
    }
  }

  const relations: ValidatedRelation[] = [];
  if (Array.isArray(obj?.relations)) {
    for (const item of obj.relations) {
      const parsed = relationsArraySchema.element.safeParse(item);
      if (parsed.success) relations.push(parsed.data);
    }
  }

  return { entities, relations };
}

/**
 * Découpe une liste de chunks en groupes de BATCH_SIZE.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Point d'entrée public : extrait les entités/relations pour TOUS les chunks fournis,
 * en les regroupant par batchs pour limiter le nombre d'appels LLM.
 */
export async function extractEntitiesAndRelationsBatched(
  chunkContents: string[]
): Promise<ExtractionResult> {
  const batches = chunkArray(chunkContents, BATCH_SIZE);
  const allEntities: ValidatedEntity[] = [];
  const allRelations: ValidatedRelation[] = [];

  for (const batch of batches) {
    const result = await extractBatch(batch);
    allEntities.push(...result.entities);
    allRelations.push(...result.relations);
  }

  return { entities: allEntities, relations: allRelations };
}

// Conservé pour compatibilité si un appel unitaire est nécessaire ailleurs
export async function extractEntitiesAndRelations(
  chunkText: string
): Promise<ExtractionResult> {
  return extractBatch([chunkText]);
}