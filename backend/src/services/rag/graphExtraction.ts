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

const EXTRACTION_SYSTEM_PROMPT = `Tu es un moteur d'extraction d'entités et de relations pour un graphe de connaissances.
À partir du texte fourni, identifie :
- les entités importantes (concepts, composants, processus, personnes, organisations, lieux, matériaux, etc.)
- les relations entre ces entités

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "entities": [{ "name": "string", "type": "string" }],
  "relations": [{ "source": "string", "relation": "string", "target": "string" }]
}

Règles :
- Les noms d'entités doivent être courts et normalisés (pas de phrases entières).
- Les relations doivent être des verbes ou expressions courtes en MAJUSCULES_AVEC_UNDERSCORE (ex: FAIT_PARTIE_DE, UTILISE, PERMET_DE).
- Limite-toi aux entités et relations clairement présentes dans le texte, n'invente rien.
- Si le texte ne contient aucune entité exploitable, retourne { "entities": [], "relations": [] }.`;

export async function extractEntitiesAndRelations(
  chunkText: string
): Promise<ExtractionResult> {
  let rawParsed: unknown;

  try {
    const completion = await callGroqWithLimit(
      () =>
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: chunkText },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      "extraction entités/relations"
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    rawParsed = JSON.parse(raw);
  } catch (error) {
    // échec réseau/LLM après épuisement des retries, ou JSON illisible
    console.error("[graph-extraction] Échec de l'appel LLM ou JSON invalide :", error);
    return { entities: [], relations: [] };
  }

  // Validation stricte via Zod. safeParse plutôt que parse : on ne veut jamais
  // qu'une erreur de validation fasse planter le worker, juste qu'elle soit loggée
  // et qu'on retombe sur un résultat vide pour ce chunk.
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

/**
 * Filet de sécurité : si la structure globale échoue (ex: "entities" n'est pas un tableau
 * à cause d'une hallucination de format par le LLM), on tente quand même de récupérer
 * les entités/relations individuellement valides plutôt que de tout jeter.
 */

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