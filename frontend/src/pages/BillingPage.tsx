import { useState } from "react";
import BillingToggle from "../components/billing/BillingToggle";
import FaqAccordion from "../components/billing/FaqAccordion";
import type { FaqItem } from "../components/billing/FaqAccordion";
import PlanCard from "../components/billing/PlanCard";
import { CloseIcon } from "../components/ui/Icons";
import { PLANS, YEARLY_DISCOUNT } from "../config/plans";
import { useSubscription } from "../hooks/useSubscription";
import type { BillingCycle, PlanId } from "../types";

interface BillingPageProps {
  onClose: () => void;
  onSelectPlan: (planId: PlanId, cycle: BillingCycle) => void;
  onContactSales: () => void;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How does the free trial work?",
    answer:
      "You get 30 days to try Insightly Docs. A card is required to start, but you are only charged when the trial ends. Cancel before then and you pay nothing.",
  },
  {
    question: "Can I change plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade whenever you like, with no long-term commitment. Changes take effect immediately.",
  },
  {
    question: "What does GraphRAG add compared to standard search?",
    answer:
      "GraphRAG builds a knowledge graph from your documents. This lets it answer more complex questions by following the relationships between concepts and documents, rather than relying on text similarity alone. It is available from the Starter plan.",
  },
  {
    question: "Is my data protected?",
    answer:
      "Your documents and conversations are isolated per session and are never shared between users. For specific regulatory requirements, such as healthcare, the Enterprise plan offers dedicated hosting and compliance support.",
  },
];

export default function BillingPage({ onClose, onSelectPlan, onContactSales }: BillingPageProps) {
  const { subscription } = useSubscription();
  const [cycle, setCycle] = useState<BillingCycle>(subscription.cycle);

  return (
    <div className="billing-page">
      <div className="billing-page__header">
        <div>
          <h1 className="billing-page__title">Plans &amp; billing</h1>
          <p className="billing-page__subtitle">
            Pick the plan that fits how you work. Switch or cancel at any time; changes apply immediately. Pay yearly
            and save {Math.round(YEARLY_DISCOUNT * 100)}%.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close" title="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="billing-page__toggle">
        <BillingToggle value={cycle} onChange={setCycle} />
      </div>

      <div className="plans-grid">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            subscription={subscription}
            onSelect={() => (plan.monthlyPrice === null ? onContactSales() : onSelectPlan(plan.id, cycle))}
          />
        ))}
      </div>

      <div className="billing-page__faq">
        <h2>Frequently asked questions</h2>
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
