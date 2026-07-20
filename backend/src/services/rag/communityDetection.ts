import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { getDriver } from "./graphStore";
import { callGroqWithLimit } from "../groqLimiter";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface EntityNode {
  key: string;
  displayName: string;
  type: string;
}

interface RelationEdge {
  sourceKey: string;
  targetKey: string;
  relationType: string;
}

/**
 * Charge toutes les entités et relations d'une session depuis Neo4j.
 */
async function loadSessionGraph(
  sessionId: string
): Promise<{ entities: EntityNode[]; relations: RelationEdge[] }> {
  const session = getDriver().session();
  try {
    const entitiesResult = await session.executeRead((tx) =>
      tx.run(
        `MATCH (e:Entity { sessionId: $sessionId })
         RETURN e.key AS key, e.displayName AS displayName, e.type AS type`,
        { sessionId }
      )
    );

    const entities: EntityNode[] = entitiesResult.records.map((r) => ({
      key: r.get("key"),
      displayName: r.get("displayName"),
      type: r.get("type"),
    }));

    const relationsResult = await session.executeRead((tx) =>
      tx.run(
        `MATCH (a:Entity { sessionId: $sessionId })-[r]->(b:Entity { sessionId: $sessionId })
         RETURN a.key AS sourceKey, b.key AS targetKey, type(r) AS relationType`,
        { sessionId }
      )
    );

    const relations: RelationEdge[] = relationsResult.records.map((r) => ({
      sourceKey: r.get("sourceKey"),
      targetKey: r.get("targetKey"),
      relationType: r.get("relationType"),
    }));

    return { entities, relations };
  } finally {
    await session.close();
  }
}

/**
 * Applique Louvain sur le graphe de la session, retourne un mapping key -> id de communauté.
 */
function detectCommunities(
  entities: EntityNode[],
  relations: RelationEdge[]
): Map<string, number> {
  const graph = new Graph({ type: "undirected" });

  for (const entity of entities) {
    if (!graph.hasNode(entity.key)) graph.addNode(entity.key);
  }

  for (const rel of relations) {
    if (graph.hasNode(rel.sourceKey) && graph.hasNode(rel.targetKey) && rel.sourceKey !== rel.targetKey) {
      if (!graph.hasEdge(rel.sourceKey, rel.targetKey)) {
        graph.addEdge(rel.sourceKey, rel.targetKey);
      }
    }
  }

  const communities = louvain(graph); // { [nodeKey]: communityId }

  const map = new Map<string, number>();
  for (const [key, communityId] of Object.entries(communities)) {
    map.set(key, communityId as number);
  }
  return map;
}

/**
 * Génère un résumé thématique pour une communauté via le LLM,
 * à partir de la liste de ses entités membres.
 */
async function summarizeCommunity(members: EntityNode[]): Promise<string> {
  const memberList = members
    .map((m) => `- ${m.displayName} (${m.type})`)
    .join("\n");

  const completion = await callGroqWithLimit(
    () =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Tu résumes en 2 à 3 phrases le thème commun d'un groupe d'entités issues d'un graphe de connaissances. Réponds uniquement avec le résumé, sans préambule.",
          },
          {
            role: "user",
            content: `Voici un groupe d'entités liées entre elles :\n${memberList}\n\nQuel est le thème commun de ce groupe ?`,
          },
        ],
        temperature: 0.3,
      }),
    "résumé de communauté"
  );

  return completion.choices[0]?.message?.content ?? "Résumé non disponible.";
}

/**
 * Stocke les communautés détectées (avec leurs résumés) dans Neo4j,
 * chaque communauté étant reliée à ses entités membres.
 */
async function storeCommunities(
  sessionId: string,
  communitiesWithSummary: { id: number; summary: string; members: EntityNode[] }[]
) {
  const session = getDriver().session();
  try {
    await session.executeWrite(async (tx) => {
      for (const community of communitiesWithSummary) {
        const communityKey = `${sessionId}-community-${community.id}`;

        await tx.run(
          `MERGE (c:Community { key: $communityKey, sessionId: $sessionId })
           SET c.summary = $summary, c.memberCount = $memberCount`,
          {
            communityKey,
            sessionId,
            summary: community.summary,
            memberCount: community.members.length,
          }
        );

        for (const member of community.members) {
          await tx.run(
            `MATCH (c:Community { key: $communityKey, sessionId: $sessionId })
             MATCH (e:Entity { key: $entityKey, sessionId: $sessionId })
             MERGE (c)-[:HAS_MEMBER]->(e)`,
            { communityKey, sessionId, entityKey: member.key }
          );
        }
      }
    });
  } finally {
    await session.close();
  }
}

const MIN_COMMUNITY_SIZE = 3; // ignore les micro-communautés peu informatives

/**
 * Pipeline complet : charge le graphe, détecte les communautés, génère leurs résumés,
 * et les stocke dans Neo4j. Appelé après la fin de l'ingestion graphe d'un document.
 */
export async function runCommunityDetection(sessionId: string): Promise<void> {
  const { entities, relations } = await loadSessionGraph(sessionId);

  if (entities.length === 0) {
    console.log(`[community-detection] Aucune entité pour la session ${sessionId}, rien à faire`);
    return;
  }

  const communityMap = detectCommunities(entities, relations);

  const grouped = new Map<number, EntityNode[]>();
  for (const entity of entities) {
    const communityId = communityMap.get(entity.key);
    if (communityId === undefined) continue;
    if (!grouped.has(communityId)) grouped.set(communityId, []);
    grouped.get(communityId)!.push(entity);
  }

  const significantCommunities = Array.from(grouped.entries()).filter(
    ([, members]) => members.length >= MIN_COMMUNITY_SIZE
  );

  console.log(
    `[community-detection] ${significantCommunities.length} communauté(s) significative(s) détectée(s) pour ${sessionId}`
  );

  const communitiesWithSummary: { id: number; summary: string; members: EntityNode[] }[] = [];

  for (const [id, members] of significantCommunities) {
    try {
      const summary = await summarizeCommunity(members);
      communitiesWithSummary.push({ id, summary, members });
    } catch (error) {
      console.error(`[community-detection] Échec du résumé pour la communauté ${id} :`, error);
    }
  }

  await storeCommunities(sessionId, communitiesWithSummary);

  console.log(`[community-detection] Terminé pour la session ${sessionId}`);
}