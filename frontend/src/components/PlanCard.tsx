interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  isCurrent?: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}

export default function PlanCard({
  name,
  price,
  period = "/mois",
  description,
  features,
  isCurrent = false,
  isRecommended = false,
  onSelect,
}: PlanCardProps) {
  return (
    <div className={`plan-card ${isRecommended ? "plan-card--recommended" : ""}`}>
      {isRecommended && <span className="plan-card__badge">Recommandé</span>}

      <h3 className="plan-card__name">{name}</h3>
      <p className="plan-card__description">{description}</p>

      <div className="plan-card__price">
        <span className="plan-card__price-amount">{price}</span>
        {price !== "Sur devis" && <span className="plan-card__price-period">{period}</span>}
      </div>

      <ul className="plan-card__features">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <button
        className={`plan-card__cta ${isCurrent ? "plan-card__cta--current" : ""}`}
        onClick={onSelect}
        disabled={isCurrent}
      >
        {isCurrent ? "Plan actuel" : "Choisir ce plan"}
      </button>
    </div>
  );
}