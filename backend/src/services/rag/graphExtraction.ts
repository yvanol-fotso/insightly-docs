import Groq from "groq-sdk";
import { callGroqWithLimit } from "../groqLimiter";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ExtractedEntity {
  name: string;
  type: string;
}

export interface ExtractedRelation {
  source: string;
  relation: string;
  target: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
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
    const parsed = JSON.parse(raw);

    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    };
  } catch (error) {
    // on arrive ici seulement après épuisement des 3 tentatives (ou erreur définitive)
    console.error("Erreur définitive d'extraction pour ce chunk :", error);
    return { entities: [], relations: [] };
  }
}