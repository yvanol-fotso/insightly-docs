import Groq from "groq-sdk";
import { askLLM } from "../llm";
import { getHistory } from "../conversationStore";
import { queryGraph, getDriver } from "./graphStore";
import { RagResult } from "./types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Demande au LLM d'identifier les entités clés mentionnées dans la question,
 * pour cibler la recherche dans le graphe.
 */
async function extractQuestionEntities(question: string): Promise<string[]> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Extrait les 1 à 5 entités/concepts clés de la question suivante.
Réponds STRICTEMENT en JSON : { "entities": ["string", ...] }, sans texte autour.`,
      },
      { role: "user", content: question },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return Array.isArray(parsed.entities) ? parsed.entities : [];
  } catch {
    return [];
  }
}

interface CommunityMatch {
  summary: string;
  memberCount: number;
}

async function queryCommunitySummaries(sessionId: string): Promise<CommunityMatch[]> {
  const session = getDriver().session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `MATCH (c:Community { sessionId: $sessionId })
         RETURN c.summary AS summary, c.memberCount AS memberCount
         ORDER BY c.memberCount DESC
         LIMIT 5`,
        { sessionId }
      )
    );
    return result.records.map((r) => ({
      summary: r.get("summary"),
      memberCount: r.get("memberCount"),
    }));
  } finally {
    await session.close();
  }
}

const GLOBAL_QUESTION_KEYWORDS = [
  "thèmes", "thème", "résume", "résumé", "en général", "dans l'ensemble",
  "globalement", "de quoi parle", "sujet principal",
];

function isGlobalQuestion(question: string): boolean {
  const normalized = question.toLowerCase();
  return GLOBAL_QUESTION_KEYWORDS.some((kw) => normalized.includes(kw));
}

export async function askGraphRag(
  question: string,
  sessionId: string
): Promise<RagResult> {
  // Questions globales ("quels sont les thèmes...") : on interroge d'abord les résumés
  // de communautés, plus adaptés qu'une recherche par entité isolée.
  if (isGlobalQuestion(question)) {
    const communities = await queryCommunitySummaries(sessionId);

    if (communities.length > 0) {
      const context = communities
        .map((c, i) => `Thème ${i + 1} (${c.memberCount} entités liées) :\n${c.summary}`)
        .join("\n\n---\n\n");

      const history = await getHistory(sessionId);
      const answer = await askLLM(question, context, history);

      return {
        answer,
        sources: [], // les résumés de communauté ne sont pas rattachés à un fichier unique
      };
    }
    // si aucune communauté détectée, on retombe sur la recherche par entités classique ci-dessous
  }

  const entityNames = await extractQuestionEntities(question);

  if (entityNames.length === 0) {
    return {
      answer:
        "Je n'ai pas réussi à identifier de concepts clés dans votre question pour interroger le graphe de connaissances.",
      sources: [],
    };
  }

  const matches = await queryGraph(entityNames, sessionId);

  if (matches.length === 0) {
    return {
      answer:
        "Aucune information trouvée dans le graphe de connaissances pour cette conversation.",
      sources: [],
    };
  }

  const context = matches
    .map((m) => `${m.entity} (${m.type}) :\n${m.relatedFacts.join("\n")}`)
    .join("\n\n---\n\n");

  const history = await getHistory(sessionId);
  const answer = await askLLM(question, context, history);

  const sourceSet = new Set<string>();
  matches.forEach((m) => m.sources.forEach((s) => sourceSet.add(s)));

  return {
    answer,
    sources: Array.from(sourceSet).map((filename) => ({ filename, score: 1 })),
  };
}

export { closeGraphDriver } from "./graphStore";