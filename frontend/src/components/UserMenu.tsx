import { useState, useRef, useEffect } from "react";
import { Network, Search, CreditCard, Settings, LogOut, Lock } from "lucide-react";

interface UserMenuProps {
  userName?: string;
  planName?: "Starter" | "Pro" | "Scale";
  ragMode: "naive" | "graph";
  onRagModeChange: (mode: "naive" | "graph") => void;
  onUpgradeClick: () => void;
}

export default function UserMenu({
  userName = "Guest account",
  planName = "Starter",
  ragMode,
  onRagModeChange,
  onUpgradeClick,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const initials = userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const graphAllowed = planName === "Pro" || planName === "Scale";

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
          <span className="user-menu__plan">{planName} plan</span>
        </span>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__header">
            <span className="user-menu__avatar">{initials}</span>
            <div className="user-menu__info">
              <span className="user-menu__name">{userName}</span>
              <span className="user-menu__plan-pill">{planName}</span>
            </div>
          </div>

          <div className="user-menu__section">
            <span className="user-menu__section-label">Search mode</span>

            <div className="segmented" role="radiogroup" aria-label="Search mode">
              <button
                role="radio"
                aria-checked={ragMode === "naive"}
                className={`segmented__option ${ragMode === "naive" ? "segmented__option--active" : ""}`}
                onClick={() => onRagModeChange("naive")}
              >
                <Search size={14} />
                Standard
              </button>
              <button
                role="radio"
                aria-checked={ragMode === "graph"}
                className={`segmented__option ${ragMode === "graph" ? "segmented__option--active" : ""}`}
                disabled={!graphAllowed}
                onClick={() => onRagModeChange("graph")}
                title={graphAllowed ? "" : "Available on Pro and Scale plans"}
              >
                <Network size={14} />
                Graph
                {!graphAllowed && <Lock size={11} />}
              </button>
            </div>

            <p className="user-menu__hint">
              {!graphAllowed
                ? "Graph mode is available on Pro and Scale plans."
                : ragMode === "graph"
                  ? "Uses a knowledge graph for complex, multi-document questions."
                  : "Fast semantic search across your documents."}
            </p>
          </div>

          <div className="user-menu__divider" />

          <button
            className="user-menu__item user-menu__item--accent"
            role="menuitem"
            onClick={() => { setOpen(false); onUpgradeClick(); }}
          >
            <CreditCard size={15} />
            Plans &amp; billing
          </button>
          <button className="user-menu__item" role="menuitem" disabled>
            <Settings size={15} />
            Account settings
          </button>
          <button className="user-menu__item" role="menuitem" disabled>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}