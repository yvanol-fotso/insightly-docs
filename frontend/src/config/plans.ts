import type { BillingCycle, GraphAccess, PlanId } from "../types";

/** Discount applied when paying yearly instead of monthly. */
export const YEARLY_DISCOUNT = 0.15;
export const TRIAL_DAYS = 30;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  /** Monthly price in EUR. `null` = custom pricing (contact sales). */
  monthlyPrice: number | null;
  /** Which search modes the plan unlocks. */
  graphAccess: GraphAccess;
  trialDays?: number;
  recommended?: boolean;
  /** Line shown above the feature list, e.g. "Everything in Starter, plus:". */
  featuresIntro?: string;
  features: string[];
}

/*
 * NOTE: quotas below (documents, history…) are placeholders — adjust them to
 * the real limits enforced by the backend.
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Try Insightly Docs free for 30 days with standard search.",
    monthlyPrice: 9,
    graphAccess: "none",
    trialDays: TRIAL_DAYS,
    features: [
      "30-day free trial",
      "Standard RAG (vector search)",
      "5 indexed documents per month",
      "1 active conversation",
      "7-day history",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "Unlock GraphRAG for multi-document questions.",
    monthlyPrice: 49,
    graphAccess: "limited",
    recommended: true,
    featuresIntro: "Everything in Free, plus:",
    features: [
      "GraphRAG (usage limits apply)",
      "50 indexed documents per month",
      "Unlimited conversations",
      "30-day history",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    description: "Full GraphRAG for teams working at volume.",
    monthlyPrice: 99,
    graphAccess: "full",
    featuresIntro: "Everything in Starter, plus:",
    features: [
      "GraphRAG without usage limits",
      "Unlimited indexed documents",
      "Unlimited history",
      "Real-time indexing status",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organisations with security and compliance needs.",
    monthlyPrice: null,
    graphAccess: "full",
    featuresIntro: "Everything in Scale, plus:",
    features: [
      "Dedicated hosting",
      "SSO / SAML",
      "GDPR & advanced compliance",
      "Dedicated onboarding",
      "Custom contract & SLA",
    ],
  },
];

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<
  PlanId,
  PlanDefinition
>;

export const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, scale: 2, enterprise: 3 };

export const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly" };

/** True when the plan unlocks GraphRAG (Starter and above). */
export function planAllowsGraph(planId: PlanId | null): boolean {
  return planId !== null && PLAN_BY_ID[planId].graphAccess !== "none";
}
