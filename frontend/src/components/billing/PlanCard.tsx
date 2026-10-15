import { PLAN_RANK } from "../../config/plans";
import type { PlanDefinition } from "../../config/plans";
import { formatEuro, getPlanPrice } from "../../lib/pricing";
import type { BillingCycle, Subscription } from "../../types";

interface PlanCardProps {
  plan: PlanDefinition;
  cycle: BillingCycle;
  subscription: Subscription;
  onSelect: () => void;
}

function ctaLabel(plan: PlanDefinition, sub: Subscription, cycle: BillingCycle): string {
  if (plan.monthlyPrice === null) return "Contact sales";
  if (sub.planId === plan.id) return cycle === "yearly" ? "Switch to yearly billing" : "Switch to monthly billing";
  if (plan.trialDays) return `Start ${plan.trialDays}-day free trial`;
  if (sub.planId === null || PLAN_RANK[plan.id] > PLAN_RANK[sub.planId]) return `Choose ${plan.name}`;
  return `Switch to ${plan.name}`;
}

export default function PlanCard({ plan, cycle, subscription, onSelect }: PlanCardProps) {
  const price = getPlanPrice(plan, cycle);
  const isCurrent = subscription.planId === plan.id && subscription.cycle === cycle;
  const isCustom = price === null;

  return (
    <div className={`plan-card ${plan.recommended ? "plan-card--recommended" : ""}`}>
      {plan.recommended && <span className="plan-card__badge">Most popular</span>}

      <h3 className="plan-card__name">{plan.name}</h3>
      <p className="plan-card__description">{plan.description}</p>

      <div className="plan-card__price">
        <span className={`plan-card__price-amount ${isCustom ? "plan-card__price-amount--custom" : ""}`}>
          {isCustom ? "Custom" : formatEuro(price.perMonth)}
        </span>
        {!isCustom && <span className="plan-card__price-period">/ month</span>}
      </div>

      <p className="plan-card__billing-note">
        {isCustom && "Tailored to your organisation"}
        {!isCustom && plan.trialDays && `Free for ${plan.trialDays} days, then billed ${cycle === "yearly" ? "yearly" : "monthly"}`}
        {!isCustom && !plan.trialDays && (cycle === "yearly" ? "Billed yearly" : "Billed monthly")}
        {!isCustom && cycle === "yearly" && ` · ${formatEuro(price.yearlyTotal)}/year`}
      </p>

      <button
        className={`plan-card__cta ${isCurrent ? "plan-card__cta--current" : ""} ${
          !plan.recommended && !isCurrent ? "plan-card__cta--secondary" : ""
        }`}
        onClick={onSelect}
        disabled={isCurrent}
      >
        {isCurrent ? "Current plan" : ctaLabel(plan, subscription, cycle)}
      </button>

      {plan.trialDays && !isCurrent && (
        <p className="plan-card__fineprint">Card required. You are only charged when the trial ends; cancel any time before.</p>
      )}

      <div className="plan-card__features-wrap">
        {plan.featuresIntro && <p className="plan-card__features-intro">{plan.featuresIntro}</p>}
        <ul className="plan-card__features">
          {plan.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
