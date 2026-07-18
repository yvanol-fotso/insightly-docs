import { askNaiveRag } from "./naiveRag";
import { askGraphRag } from "./graphRag";
import { RagResult } from "./types";

export type RagStrategy = "naive" | "graph"; // "naive" | "graph"

const defaultStrategy: RagStrategy =
  (process.env.RAG_STRATEGY as RagStrategy) ?? "naive";

export async function askRag(
  question: string,
  sessionId: string,
  strategyOverride?: RagStrategy
): Promise<RagResult> {
  const strategy = strategyOverride ?? defaultStrategy;
  return strategy === "graph"
    ? askGraphRag(question, sessionId)
    : askNaiveRag(question, sessionId);
}
