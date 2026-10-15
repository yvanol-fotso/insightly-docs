import { useCallback, useRef, useState } from "react";
import { PLAN_BY_ID } from "../../config/plans";
import { useDismiss } from "../../hooks/useDismiss";
import { useSubscription } from "../../hooks/useSubscription";
import { formatDate } from "../../lib/pricing";
import type { RagMode } from "../../types";
import { CreditCardIcon, LogOutIcon, SettingsIcon } from "../ui/Icons";
import SearchModeSwitch from "./SearchModeSwitch";

interface UserMenuProps {
  userName?: string;
  ragMode: RagMode;
  onRagModeChange: (mode: RagMode) => void;
  onUpgradeClick: () => void;
}

export default function UserMenu({
  userName = "Guest account",
  ragMode,
  onRagModeChange,
  onUpgradeClick,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(menuRef, open, close);

  const { subscription, canUseGraph } = useSubscription();

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const planName = subscription.planId ? PLAN_BY_ID[subscription.planId].name : "No plan";
  const planLine =
    subscription.status === "trialing" && subscription.trialEndsAt
      ? `Trial until ${formatDate(subscription.trialEndsAt)}`
      : subscription.planId
        ? `${planName} plan`
        : "No active plan";

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="user-menu__avatar">{initials}</span>
        <span className="user-menu__info">
          <span className="user-menu__name">{userName}</span>
          <span className="user-menu__plan">{planLine}</span>
        </span>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__header">
            <span className="user-menu__avatar">{initials}</span>
            <div className="user-menu__info">
              <span className="user-menu__name">{userName}</span>
              <span className={`user-menu__plan-pill ${subscription.planId ? "" : "user-menu__plan-pill--muted"}`}>
                {planName}
              </span>
            </div>
          </div>

          <SearchModeSwitch ragMode={ragMode} graphUnlocked={canUseGraph} onChange={onRagModeChange} />

          <div className="user-menu__divider" />

          <button
            className="user-menu__item user-menu__item--accent"
            role="menuitem"
            onClick={() => {
              close();
              onUpgradeClick();
            }}
          >
            <CreditCardIcon />
            Plans &amp; billing
          </button>
          <button className="user-menu__item" role="menuitem" disabled>
            <SettingsIcon />
            Account settings
            <span className="soon-tag">Soon</span>
          </button>
          <button className="user-menu__item" role="menuitem" disabled>
            <LogOutIcon />
            Sign out
            <span className="soon-tag">Soon</span>
          </button>
        </div>
      )}
    </div>
  );
}
