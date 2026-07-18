import { useState, useRef, useEffect } from "react";

interface UserMenuProps {
  userName?: string;
  planName?: "Starter" | "Pro" | "Scale";
  ragMode: "naive" | "graph";
  onRagModeChange: (mode: "naive" | "graph") => void;
  onUpgradeClick: () => void;
}

export default function UserMenu({
  userName = "Compte invité",
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const graphAllowed = planName === "Pro" || planName === "Scale";

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu__trigger" onClick={() => setOpen((v) => !v)}>
        <span className="user-menu__avatar">{initials}</span>
        <span className="user-menu__info">
          <span className="user-menu__name">{userName}</span>
          <span className="user-menu__plan">{planName}</span>
        </span>
      </button>

      {open && (
        <div className="user-menu__dropdown">
          <div className="user-menu__toggle-row">
            <div>
              <span className="user-menu__toggle-label">Mode de recherche</span>
              <span className="user-menu__toggle-sublabel">
                {ragMode === "graph" ? "Graphe de connaissances" : "Recherche vectorielle"}
              </span>
            </div>
            <button
              className={`rag-toggle ${ragMode === "graph" ? "rag-toggle--on" : ""}`}
              disabled={!graphAllowed}
              onClick={() => onRagModeChange(ragMode === "graph" ? "naive" : "graph")}
              title={graphAllowed ? "" : "Disponible à partir du plan Pro"}
            >
              <span className="rag-toggle__thumb" />
            </button>
          </div>
          {!graphAllowed && (
            <p className="user-menu__hint">Le mode Graphe nécessite le plan Pro ou Scale.</p>
          )}

          <button
            className="user-menu__item user-menu__item--accent"
            onClick={() => { setOpen(false); onUpgradeClick(); }}
          >
            Passer au plan supérieur
          </button>
          <button className="user-menu__item" disabled>Paramètres du compte</button>
          <button className="user-menu__item" disabled>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}