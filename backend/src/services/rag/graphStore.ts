import neo4j, { Driver, Session } from "neo4j-driver";
import { ExtractionResult } from "./graphExtraction";
import { normalizeEntityName, pickBetterDisplayName } from "./entityNormalization";

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI ?? "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER ?? "neo4j",
        process.env.NEO4J_PASSWORD ?? ""
      )
    );
  }
  return driver;
}

export async function closeGraphDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function ingestExtraction(
  extraction: ExtractionResult,
  sessionId: string,
  filename: string
) {
  if (extraction.entities.length === 0) return;

  const session: Session = getDriver().session();
  try {
    await session.executeWrite(async (tx) => {
      // upsert des entités, fusionnées par clé normalisée
      for (const entity of extraction.entities) {
        const { key, display } = normalizeEntityName(entity.name);
        if (!key) continue; // sécurité si la normalisation vide totalement le nom

        await tx.run(
          `MERGE (e:Entity { key: $key, sessionId: $sessionId })
           ON CREATE SET e.displayName = $display, e.type = $type, e.sources = [$filename]
           ON MATCH SET
             e.sources = CASE
               WHEN NOT $filename IN e.sources THEN e.sources + $filename
               ELSE e.sources
             END`,
          { key, sessionId, display, type: entity.type, filename }
        );
      }

      // upsert des relations, elles aussi fusionnées par clé normalisée sur source/target
      for (const rel of extraction.relations) {
        const source = normalizeEntityName(rel.source);
        const target = normalizeEntityName(rel.target);
        if (!source.key || !target.key) continue;

        await tx.run(
          `MERGE (a:Entity { key: $sourceKey, sessionId: $sessionId })
           ON CREATE SET a.displayName = $sourceDisplay
           MERGE (b:Entity { key: $targetKey, sessionId: $sessionId })
           ON CREATE SET b.displayName = $targetDisplay
           MERGE (a)-[r:${rel.relation}]->(b)`,
          {
            sourceKey: source.key,
            sourceDisplay: source.display,
            targetKey: target.key,
            targetDisplay: target.display,
            sessionId,
          }
        );
      }
    });

    // Deuxième passe : affine le displayName si un nom "plus propre" a été vu
    // (fait séparément pour rester simple sur la logique de MERGE ci-dessus)
    await session.executeWrite(async (tx) => {
      for (const entity of extraction.entities) {
        const { key, display } = normalizeEntityName(entity.name);
        if (!key) continue;

        const result = await tx.run(
          `MATCH (e:Entity { key: $key, sessionId: $sessionId }) RETURN e.displayName AS current`,
          { key, sessionId }
        );
        const current = result.records[0]?.get("current") as string | undefined;
        if (!current) continue;

        const better = pickBetterDisplayName(current, display);
        if (better !== current) {
          await tx.run(
            `MATCH (e:Entity { key: $key, sessionId: $sessionId }) SET e.displayName = $better`,
            { key, sessionId, better }
          );
        }
      }
    });
  } finally {
    await session.close();
  }
}

export interface GraphMatch {
  entity: string;       // displayName, présenté à l'utilisateur / au LLM
  type: string;
  relatedFacts: string[];
  sources: string[];
}

export async function queryGraph(
  entityNames: string[],
  sessionId: string
): Promise<GraphMatch[]> {
  if (entityNames.length === 0) return [];

  const keys = entityNames
    .map((n) => normalizeEntityName(n).key)
    .filter((k) => k.length > 0);

  if (keys.length === 0) return [];

  const session: Session = getDriver().session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `MATCH (e:Entity { sessionId: $sessionId })
         WHERE e.key IN $keys
         OPTIONAL MATCH (e)-[r]-(related:Entity { sessionId: $sessionId })
         RETURN e.displayName AS name, e.type AS type, e.sources AS sources,
                collect(DISTINCT { relType: type(r), relatedName: related.displayName }) AS relations`,
        { sessionId, keys }
      )
    );

    return result.records.map((record) => {
      const relations = record.get("relations") as {
        relType: string | null;
        relatedName: string | null;
      }[];

      const relatedFacts = relations
        .filter((r) => r.relType && r.relatedName)
        .map((r) => `${record.get("name")} ${r.relType} ${r.relatedName}`);

      return {
        entity: record.get("name"),
        type: record.get("type"),
        relatedFacts,
        sources: record.get("sources") ?? [],
      };
    });
  } finally {
    await session.close();
  }
}