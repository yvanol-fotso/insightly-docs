interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  isCurrent?: boolean;
  isRecommended?: boolean;
  isCustomPrice?: boolean;
  ctaLabel?: string;
  onSelect: () => void;
}

export default function PlanCard({
  name,
  price,
  period = "/month",
  description,
  features,
  isCurrent = false,
  isRecommended = false,
  isCustomPrice = false,
  ctaLabel = "Choose plan",
  onSelect,
}: PlanCardProps) {
  return (
    <div className={`plan-card ${isRecommended ? "plan-card--recommended" : ""}`}>
      {isRecommended && <span className="plan-card__badge">Most popular</span>}

      <h3 className="plan-card__name">{name}</h3>
      <p className="plan-card__description">{description}</p>

      <div className="plan-card__price">
        <span className={`plan-card__price-amount ${isCustomPrice ? "plan-card__price-amount--custom" : ""}`}>
          {price}
        </span>
        {!isCustomPrice && <span className="plan-card__price-period">{period}</span>}
      </div>

      <button
        className={`plan-card__cta ${isCurrent ? "plan-card__cta--current" : ""} ${
          !isRecommended && !isCurrent ? "plan-card__cta--secondary" : ""
        }`}
        onClick={onSelect}
        disabled={isCurrent}
      >
        {isCurrent ? "Current plan" : ctaLabel}
      </button>

      <ul className="plan-card__features">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  );
}