import { useState } from "react";
import PlanCard from "../components/PlanCard";
import { CloseIcon } from "../components/Icons";

interface BillingProps {
  currentPlan: "Starter" | "Pro" | "Scale";
  onClose: () => void;
  onSelectPlan: (plan: "Starter" | "Pro" | "Scale") => void;
}

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Can I change plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade whenever you like, with no long-term commitment. Changes take effect immediately.",
  },
  {
    question: "What does GraphRAG add compared to standard search?",
    answer:
      "GraphRAG builds a knowledge graph from your documents. This lets it answer more complex questions by following the relationships between concepts and documents, rather than relying on text similarity alone.",
  },
  {
    question: "Is my data protected?",
    answer:
      "Your documents and conversations are isolated per session and are never shared between users. For specific regulatory requirements, such as healthcare, the Scale plan offers dedicated hosting and compliance support.",
  },
];

function FaqAccordionItem({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item ${open ? "faq-item--open" : ""}`}>
      <button
        className="faq-item__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="faq-item__question">{question}</span>
        <span className="faq-item__icon">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <div className="faq-item__panel">
        <div className="faq-item__panel-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function Billing({ currentPlan, onClose, onSelectPlan }: BillingProps) {
  return (
    <div className="billing-page">
      <div className="billing-page__header">
        <div>
          <h1 className="billing-page__title">Plans &amp; billing</h1>
          <p className="billing-page__subtitle">
            Pick the plan that fits how you work. Switch or cancel at any time; changes apply immediately.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close" title="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="plans-grid">
        <PlanCard
          name="Starter"
          price="€0"
          description="For trying out Insightly Docs."
          features={[
            "5 indexed documents per month",
            "Standard vector search",
            "1 active conversation",
            "7-day history",
          ]}
          isCurrent={currentPlan === "Starter"}
          ctaLabel="Switch to Starter"
          onSelect={() => onSelectPlan("Starter")}
        />

        <PlanCard
          name="Pro"
          price="€29"
          description="For regular professional use."
          features={[
            "Unlimited documents",
            "GraphRAG (knowledge graph search)",
            "Unlimited conversation history",
            "Real-time indexing status",
            "Priority support",
          ]}
          isRecommended
          isCurrent={currentPlan === "Pro"}
          ctaLabel="Upgrade to Pro"
          onSelect={() => onSelectPlan("Pro")}
        />

        <PlanCard
          name="Scale"
          price="Custom"
          description="For teams and regulated industries such as healthcare."
          features={[
            "Everything in Pro, plus:",
            "Dedicated hosting",
            "SSO / SAML",
            "Advanced compliance (GDPR)",
            "Dedicated onboarding support",
          ]}
          isCustomPrice
          isCurrent={currentPlan === "Scale"}
          ctaLabel="Contact sales"
          onSelect={() => onSelectPlan("Scale")}
        />
      </div>

      <div className="billing-page__faq">
        <h2>Frequently asked questions</h2>

        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </div>
  );
}