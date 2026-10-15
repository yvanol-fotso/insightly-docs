import { YEARLY_DISCOUNT } from "../config/plans";
import type { PlanDefinition } from "../config/plans";
import type { BillingCycle } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PlanPrice {
  /** Price per month for the selected cycle (already discounted when yearly). */
  perMonth: number;
  /** Total charged per year when paying yearly. */
  yearlyTotal: number;
  /** What yearly billing saves versus 12 monthly payments. */
  yearlySavings: number;
}

/** Returns `null` for custom-priced plans. */
export function getPlanPrice(plan: PlanDefinition, cycle: BillingCycle): PlanPrice | null {
  if (plan.monthlyPrice === null) return null;
  const full = plan.monthlyPrice * 12;
  const yearlyTotal = round2(full * (1 - YEARLY_DISCOUNT));
  return {
    perMonth: cycle === "yearly" ? round2(plan.monthlyPrice * (1 - YEARLY_DISCOUNT)) : plan.monthlyPrice,
    yearlyTotal,
    yearlySavings: round2(full - yearlyTotal),
  };
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
