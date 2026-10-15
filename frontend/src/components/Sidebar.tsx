import { useEffect, useState } from "react";
import { listSessions } from "../api/ragApi";
import { FileIcon, MenuIcon, NewChatIcon, TrashIcon } from "./Icons";
import UserMenu from "./UserMenu";

export type DocumentStatus = "processing" | "ready" | "partial" | "failed";

export interface DocumentEntry {
  filename: string;
  chunks: number;
  status?: DocumentStatus; // absent = "ready"
  errorMessage?: string;
}

interface ConversationEntry {
  session_id: string;
  preview: string;
  last_activity: string;
}

type Plan = "Starter" | "Pro" | "Scale";
type RagMode = "naive" | "graph";

interface SidebarProps {
  documents: DocumentEntry[];
  isOpen: boolean;
  activeSessionId: string;
  onToggle: () => void;
  onNewSession: () => void;
  onRemoveDocument: (filename: string) => void;
  onSelectSession: (sessionId: string) => void;
  onUpgradeClick: () => void;
  refreshKey: number;
  currentPlan: Plan;
  ragMode: RagMode;
  onRagModeChange: (mode: RagMode) => void;
}

function documentMeta(doc: DocumentEntry): string {
  switch (doc.status) {
    case "processing":
      return "Processing…";
    case "partial":
      return `${doc.chunks} chunks (partial)`;
    case "failed":
      return doc.errorMessage ? `Failed: ${doc.errorMessage}` : "Processing failed";
    default:
      return `${doc.chunks} chunks`;
  }
}

export default function Sidebar({
  documents,
  isOpen,
  activeSessionId,
  onToggle,
  onNewSession,
  onRemoveDocument,
  onSelectSession,
  onUpgradeClick,
  refreshKey,
  currentPlan,
  ragMode,
  onRagModeChange,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);

  useEffect(() => {
    listSessions()
      .then(setConversations)
      .catch((err) => console.error("Failed to load conversations", err));
  }, [refreshKey]);

  return (
    <>
      {isOpen && <div className="sidebar-scrim" onClick={onToggle} />}

      <aside className={`sidebar ${isOpen ? "sidebar--open" : "sidebar--collapsed"}`}>
        <div className="sidebar__header">
          <span className="sidebar__title">Insightly Docs</span>
          <button
            className="icon-button sidebar__collapse"
            onClick={onToggle}
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <MenuIcon />
          </button>
        </div>

        <button className="sidebar__new-session" onClick={onNewSession}>
          <NewChatIcon />
          New conversation
        </button>

        <div className="sidebar__section-label">Conversations</div>
        <div className="sidebar__documents">
          {conversations.length === 0 && (
            <p className="sidebar__empty">No conversations yet.</p>
          )}
          {conversations.map((conv) => (
            <div
              className={`document-item ${conv.session_id === activeSessionId ? "document-item--active" : ""}`}
              key={conv.session_id}
              onClick={() => onSelectSession(conv.session_id)}
              style={{ cursor: "pointer" }}
            >
              <div className="document-item__info">
                <span className="document-item__name">{conv.preview || "New conversation"}</span>
                <span className="document-item__meta">
                  {new Date(conv.last_activity).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar__section-label">Documents in this conversation</div>
        <div className="sidebar__documents">
          {documents.length === 0 && (
            <p className="sidebar__empty">No documents yet. Upload a PDF to get started.</p>
          )}
          {documents.map((doc) => (
            <div
              className={`document-item ${doc.status === "processing" ? "document-item--processing" : ""} ${doc.status === "failed" ? "document-item--failed" : ""}`}
              key={doc.filename}
            >
              <FileIcon />
              <div className="document-item__info">
                <span className="document-item__name" title={doc.filename}>{doc.filename}</span>
                <span className="document-item__meta" title={documentMeta(doc)}>{documentMeta(doc)}</span>
              </div>
              <button
                className="icon-button document-item__remove"
                onClick={() => onRemoveDocument(doc.filename)}
                aria-label={`Remove ${doc.filename}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <UserMenu
          planName={currentPlan}
          ragMode={ragMode}
          onRagModeChange={onRagModeChange}
          onUpgradeClick={onUpgradeClick}
        />
      </aside>
    </>
  );
}