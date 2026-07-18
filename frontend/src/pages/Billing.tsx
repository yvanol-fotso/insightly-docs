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
    question: "Puis-je changer de plan à tout moment ?",
    answer:
      "Oui, vous pouvez passer à un plan supérieur ou inférieur quand vous le souhaitez, sans engagement.",
  },
  {
    question: "Qu'est-ce que le GraphRAG apporte de plus ?",
    answer:
      "Le GraphRAG construit un graphe de connaissances à partir de vos documents, ce qui permet de répondre à des questions plus complexes en s'appuyant sur les relations entre les concepts, pas uniquement sur la similarité de texte.",
  },
  {
    question: "Mes données sont-elles protégées ?",
    answer:
      "Vos documents et conversations sont scopés par session et ne sont jamais partagés entre utilisateurs. Pour les besoins réglementaires spécifiques (secteur santé notamment), le plan Scale propose un hébergement dédié et un accompagnement conformité.",
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <h1 className="billing-page__title">Choisissez votre plan</h1>
          <p className="billing-page__subtitle">
            Changez ou annulez à tout moment. Les changements de plan prennent effet immédiatement.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>
      </div>

      <div className="plans-grid">
        <PlanCard
          name="Starter"
          price="0€"
          description="Pour découvrir Insightly Docs"
          features={[
            "5 documents indexés / mois",
            "RAG classique (recherche vectorielle)",
            "1 conversation active",
            "Historique 7 jours",
          ]}
          isCurrent={currentPlan === "Starter"}
          onSelect={() => onSelectPlan("Starter")}
        />

        <PlanCard
          name="Pro"
          price="29€"
          description="Pour un usage professionnel régulier"
          features={[
            "Documents illimités",
            "GraphRAG activé (graphe de connaissances)",
            "Historique de conversation illimité",
            "Statut d'indexation en temps réel",
            "Support prioritaire",
          ]}
          isRecommended
          isCurrent={currentPlan === "Pro"}
          onSelect={() => onSelectPlan("Pro")}
        />

        <PlanCard
          name="Scale"
          price="Sur devis"
          description="Pour les équipes et le secteur santé"
          features={[
            "Tout Pro, plus :",
            "Hébergement dédié",
            "SSO / SAML",
            "Conformité renforcée (RGPD avancé)",
            "Accompagnement dédié à l'intégration",
          ]}
          isCurrent={currentPlan === "Scale"}
          onSelect={() => onSelectPlan("Scale")}
        />
      </div>

      <div className="billing-page__faq">
        <h2>Questions fréquentes</h2>

        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </div>
  );
}