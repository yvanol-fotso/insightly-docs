import { useContext } from "react";
import { SubscriptionContext } from "../context/SubscriptionContext";

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside a SubscriptionProvider");
  return ctx;
}
