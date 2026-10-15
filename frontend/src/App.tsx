import { useState } from "react";
import "./App.css";
import ChatBox from "./components/ChatBox";
import Sidebar from "./components/Sidebar";
import type { DocumentEntry } from "./components/Sidebar";
import Billing from "./pages/Billing";
import { MenuIcon } from "./components/Icons";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./hooks/useTheme";

function makeSessionId() {
  return `session-${Date.now()}`;
}

type View = "chat" | "billing";
type Plan = "Starter" | "Pro" | "Scale";
type RagMode = "naive" | "graph";

export default function App() {
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("chat");

  // Placeholder for the real auth / subscription logic
  const [currentPlan, setCurrentPlan] = useState<Plan>("Starter");
  const [ragMode, setRagMode] = useState<RagMode>("naive");

  const { theme, toggleTheme } = useTheme();

  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewSession = () => {
    const newSession = makeSessionId();
    setSessionId(newSession);
    setDocuments([]);
    setRefreshKey((v) => v + 1);
  };

  const handleSelectSession = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setDocuments([]);
  };

  const handleDocumentsIndexed = (newDocs: DocumentEntry[]) => {
    setDocuments((prev) => [...prev, ...newDocs]);
    setRefreshKey((v) => v + 1);
  };

  // Update an existing document once extraction / OCR has finished.
  const handleDocumentUpdated = (filename: string, update: Partial<DocumentEntry>) => {
    setDocuments((prev) =>
      prev.map((d) => (d.filename === filename ? { ...d, ...update } : d))
    );
  };

  const handleRemoveDocument = (filename: string) => {
    setDocuments((prev) => prev.filter((d) => d.filename !== filename));
  };

  const handleSelectPlan = (plan: Plan) => {
    // TODO: wire up Stripe Checkout here during the billing phase
    setCurrentPlan(plan);
    setView("chat");
  };

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        isOpen={sidebarOpen}
        activeSessionId={sessionId}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewSession={handleNewSession}
        onRemoveDocument={handleRemoveDocument}
        onSelectSession={handleSelectSession}
        onUpgradeClick={() => setView("billing")}
        refreshKey={refreshKey}
        currentPlan={currentPlan}
        ragMode={ragMode}
        onRagModeChange={setRagMode}
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
            onDocumentsIndexed={handleDocumentsIndexed}
            onDocumentUpdated={handleDocumentUpdated}
          />
        ) : (
          <Billing
            currentPlan={currentPlan}
            onClose={() => setView("chat")}
            onSelectPlan={handleSelectPlan}
          />
        )}
      </main>
    </div>
  );
}