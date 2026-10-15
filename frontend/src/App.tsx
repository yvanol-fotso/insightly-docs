import { useCallback, useState } from "react";
import "./App.css";
import { getSession } from "./api/ragApi";
import ChatBox from "./components/chat/ChatBox";
import Sidebar from "./components/sidebar/Sidebar";
import { MenuIcon } from "./components/ui/Icons";
import ThemeToggle from "./components/ui/ThemeToggle";
import { useToast } from "./components/ui/toast/useToast";
import { PLAN_BY_ID, planAllowsGraph } from "./config/plans";
import { SALES_EMAIL } from "./config/features";
import { useRagMode } from "./hooks/useRagMode";
import { useSubscription } from "./hooks/useSubscription";
import { useTheme } from "./hooks/useTheme";
import { formatDate } from "./lib/pricing";
import BillingPage from "./pages/BillingPage";
import type { BillingCycle, ChatMessage, DocumentEntry, PlanId, View } from "./types";

const makeSessionId = () => `session-${Date.now()}`;

export default function App() {
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("chat");
  const [refreshKey, setRefreshKey] = useState(0);

  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { canUseGraph, subscribe } = useSubscription();

  const openBilling = useCallback(() => setView("billing"), []);
  const { ragMode, requestRagMode, onPlanChanged } = useRagMode({ canUseGraph, onUpgradeRequired: openBilling });

  // ---- Sessions ----------------------------------------------------------

  const startFreshSession = () => {
    setSessionId(makeSessionId());
    setInitialMessages([]);
    setDocuments([]);
  };

  const handleNewSession = () => {
    startFreshSession();
    setView("chat");
    setRefreshKey((v) => v + 1);
  };

  const handleSelectSession = async (selectedId: string) => {
    setView("chat");
    if (selectedId === sessionId) return;
    try {
      const session = await getSession(selectedId);
      setInitialMessages(session.messages);
      setDocuments(session.documents.map((d) => ({ ...d, status: "ready" as const })));
      setSessionId(selectedId);
    } catch (err) {
      console.error(err);
      showToast("Could not load this conversation.", { variant: "error" });
    }
  };

  const handleSessionDeleted = (deletedId: string) => {
    if (deletedId === sessionId) startFreshSession();
  };

  // ---- Documents ---------------------------------------------------------

  const handleDocumentsIndexed = (newDocs: DocumentEntry[]) => {
    setDocuments((prev) => [...prev, ...newDocs]);
    setRefreshKey((v) => v + 1);
  };

  // Update an existing document once extraction / OCR has finished.
  const handleDocumentUpdated = (filename: string, update: Partial<DocumentEntry>) => {
    setDocuments((prev) => prev.map((d) => (d.filename === filename ? { ...d, ...update } : d)));
  };

  const handleRemoveDocument = (filename: string) => {
    setDocuments((prev) => prev.filter((d) => d.filename !== filename));
  };

  // ---- Billing -----------------------------------------------------------

  const handleSelectPlan = (planId: PlanId, cycle: BillingCycle) => {
    // TODO: replace with Stripe Checkout (card up front, trial billed at its end).
    const next = subscribe(planId, cycle);
    const plan = PLAN_BY_ID[planId];

    showToast(
      next.status === "trialing" && next.trialEndsAt
        ? `Free trial started. Billing begins on ${formatDate(next.trialEndsAt)}.`
        : `${plan.name} plan activated.`,
      { variant: "success" }
    );

    onPlanChanged(planAllowsGraph(planId));
    setView("chat");
  };

  const handleContactSales = () => {
    if (SALES_EMAIL) {
      window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Insightly Docs Enterprise")}`;
    } else {
      showToast("Thanks for your interest. Our team will get in touch.", { variant: "info" });
    }
  };

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        isOpen={sidebarOpen}
        activeSessionId={sessionId}
        refreshKey={refreshKey}
        ragMode={ragMode}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onSessionDeleted={handleSessionDeleted}
        onRemoveDocument={handleRemoveDocument}
        onRagModeChange={requestRagMode}
        onUpgradeClick={openBilling}
      />

      <main className="main">
        {!sidebarOpen && (
          <button
            className="icon-button main__open-sidebar"
            onClick={() => setSidebarOpen(true)}
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <MenuIcon />
          </button>
        )}

        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        {view === "chat" ? (
          <ChatBox
            key={sessionId}
            sessionId={sessionId}
            ragMode={ragMode}
            initialMessages={initialMessages}
            onDocumentsIndexed={handleDocumentsIndexed}
            onDocumentUpdated={handleDocumentUpdated}
            onMessageSent={() => setRefreshKey((v) => v + 1)}
          />
        ) : (
          <BillingPage onClose={() => setView("chat")} onSelectPlan={handleSelectPlan} onContactSales={handleContactSales} />
        )}
      </main>
    </div>
  );
}
