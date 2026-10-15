import { GraphIcon, LockIcon, SearchIcon } from "../ui/Icons";
import type { RagMode } from "../../types";

interface SearchModeSwitchProps {
  ragMode: RagMode;
  /** Whether the current plan unlocks Graph. When false the option shows a lock but stays clickable. */
  graphUnlocked: boolean;
  onChange: (mode: RagMode) => void;
}

export default function SearchModeSwitch({ ragMode, graphUnlocked, onChange }: SearchModeSwitchProps) {
  const hint = !graphUnlocked
    ? "Graph search is available from the Starter plan."
    : ragMode === "graph"
      ? "Uses a knowledge graph for complex, multi-document questions."
      : "Fast semantic search across your documents.";

  return (
    <div className="user-menu__section">
      <span className="user-menu__section-label">Search mode</span>

      <div className="segmented" role="radiogroup" aria-label="Search mode">
        <button
          role="radio"
          aria-checked={ragMode === "naive"}
          className={`segmented__option ${ragMode === "naive" ? "segmented__option--active" : ""}`}
          onClick={() => onChange("naive")}
        >
          <SearchIcon size={14} />
          Standard
        </button>
        <button
          role="radio"
          aria-checked={ragMode === "graph"}
          className={`segmented__option ${ragMode === "graph" ? "segmented__option--active" : ""} ${
            graphUnlocked ? "" : "segmented__option--locked"
          }`}
          onClick={() => onChange("graph")}
          title={graphUnlocked ? undefined : "Requires the Starter plan or higher"}
        >
          <GraphIcon size={14} />
          Graph
          {!graphUnlocked && <LockIcon size={11} />}
        </button>
      </div>

      <p className="user-menu__hint">{hint}</p>
    </div>
  );
}
