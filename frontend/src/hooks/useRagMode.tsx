import { useCallback, useState } from "react";
import { GraphIcon, SearchIcon } from "../components/ui/Icons";
import { useToast } from "../components/ui/toast/useToast";
import type { RagMode } from "../types";

interface UseRagModeOptions {
  canUseGraph: boolean;
  /** Called when the user taps "View plans" in the upgrade toast. */
  onUpgradeRequired: () => void;
}

/**
 * Owns the search mode (standard vs graph) and the plan gate around it.
 *
 *  - Standard is always available and is the default.
 *  - Asking for Graph without a Starter+ plan keeps Standard, shows an
 *    upgrade toast and remembers the intent...
 *  - ...so `onPlanChanged(true)` can switch to Graph the moment a plan that
 *    allows it is activated.
 */
export function useRagMode({ canUseGraph, onUpgradeRequired }: UseRagModeOptions) {
  const { showToast } = useToast();
  const [selectedMode, setSelectedMode] = useState<RagMode>("naive");
  const [graphRequested, setGraphRequested] = useState(false);

  // A downgrade can never leave the app stuck in a mode the plan doesn't allow.
  const ragMode: RagMode = canUseGraph ? selectedMode : "naive";

  const announce = useCallback(
    (mode: RagMode) => {
      showToast(mode === "graph" ? "Graph mode enabled" : "Standard search enabled", {
        variant: "info",
        icon: mode === "graph" ? <GraphIcon size={15} /> : <SearchIcon size={15} />,
      });
    },
    [showToast]
  );

  const requestRagMode = useCallback(
    (mode: RagMode) => {
      if (mode === "graph" && !canUseGraph) {
        setGraphRequested(true);
        showToast("Graph mode is available from the Starter plan. Choose a plan to use it.", {
          variant: "warning",
          icon: <GraphIcon size={15} />,
          durationMs: 8000,
          action: { label: "View plans", onClick: onUpgradeRequired },
        });
        return;
      }
      setGraphRequested(false);
      setSelectedMode(mode);
      announce(mode);
    },
    [canUseGraph, announce, showToast, onUpgradeRequired]
  );

  /** Call right after a plan change, with whether the new plan allows Graph. */
  const onPlanChanged = useCallback(
    (nowCanUseGraph: boolean) => {
      if (nowCanUseGraph && graphRequested) {
        setGraphRequested(false);
        setSelectedMode("graph");
        announce("graph");
      } else if (!nowCanUseGraph) {
        setSelectedMode("naive");
        setGraphRequested(false);
      }
    },
    [graphRequested, announce]
  );

  return { ragMode, requestRagMode, onPlanChanged };
}
