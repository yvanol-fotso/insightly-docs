import { CYCLE_LABEL, YEARLY_DISCOUNT } from "../../config/plans";
import type { BillingCycle } from "../../types";

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

const CYCLES: BillingCycle[] = ["monthly", "yearly"];

export default function BillingToggle({ value, onChange }: BillingToggleProps) {
  return (
    <div className="billing-toggle" role="radiogroup" aria-label="Billing period">
      {CYCLES.map((cycle) => (
        <button
          key={cycle}
          role="radio"
          aria-checked={value === cycle}
          className={`billing-toggle__option ${value === cycle ? "billing-toggle__option--active" : ""}`}
          onClick={() => onChange(cycle)}
        >
          {CYCLE_LABEL[cycle]}
          {cycle === "yearly" && <span className="billing-toggle__save">-{Math.round(YEARLY_DISCOUNT * 100)}%</span>}
        </button>
      ))}
    </div>
  );
}
