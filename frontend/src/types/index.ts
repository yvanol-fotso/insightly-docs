export type View = "chat" | "billing";
export type RagMode = "naive" | "graph";

export type PlanId = "free" | "starter" | "scale" | "enterprise";
export type BillingCycle = "monthly" | "yearly";
export type GraphAccess = "none" | "limited" | "full";

export type DocumentStatus = "processing" | "ready" | "partial" | "failed";

export interface DocumentEntry {
  filename: string;
  chunks: number;
  status?: DocumentStatus; // absent = "ready"
  errorMessage?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { filename: string; score: number }[];
}

export interface ConversationEntry {
  session_id: string;
  preview: string;
  /** User-defined title (rename feature). Falls back to `preview` when absent. */
  title?: string | null;
  last_activity: string;
}

export interface Subscription {
  /** `null` = no plan yet (guest / trial not started). */
  planId: PlanId | null;
  cycle: BillingCycle;
  status: "none" | "trialing" | "active";
  /** ISO date, only while `status === "trialing"`. */
  trialEndsAt?: string;
}
