import { useCallback, useMemo, useState, type ReactNode } from "react";
import { PLAN_BY_ID, planAllowsGraph } from "../config/plans";
import type { BillingCycle, PlanId, Subscription } from "../types";
import { SubscriptionContext } from "./SubscriptionContext";

const NO_PLAN: Subscription = { planId: null, cycle: "monthly", status: "none" };

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  // TODO: hydrate from the backend once auth + Stripe are in place.
  const [subscription, setSubscription] = useState<Subscription>(NO_PLAN);

  const subscribe = useCallback((planId: PlanId, cycle: BillingCycle): Subscription => {
    const plan = PLAN_BY_ID[planId];
    let next: Subscription;

    if (plan.trialDays) {
      const end = new Date();
      end.setDate(end.getDate() + plan.trialDays);
      next = { planId, cycle, status: "trialing", trialEndsAt: end.toISOString() };
    } else {
      next = { planId, cycle, status: "active" };
    }

    setSubscription(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({ subscription, canUseGraph: planAllowsGraph(subscription.planId), subscribe }),
    [subscription, subscribe]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
