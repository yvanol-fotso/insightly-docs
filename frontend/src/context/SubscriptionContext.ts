import { createContext } from "react";
import type { BillingCycle, PlanId, Subscription } from "../types";

export interface SubscriptionContextValue {
  subscription: Subscription;
  /** True when the current plan unlocks GraphRAG. */
  canUseGraph: boolean;
  /**
   * Activates a plan. Placeholder for the real flow: Stripe Checkout (card is
   * collected up front, the trial is billed when it ends) + backend webhook.
   */
  subscribe: (planId: PlanId, cycle: BillingCycle) => Subscription;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
