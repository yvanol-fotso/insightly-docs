import { useEffect, useState } from "react";
import { listSessions } from "../api/ragApi";
import { FileIcon, MenuIcon, NewChatIcon, TrashIcon } from "./Icons";
import UserMenu from "./UserMenu";

export type DocumentStatus = "processing" | "ready" | "partial" | "failed";

export interface DocumentEntry {
  filename: string;
  chunks: number;
  status?: DocumentStatus; // absent = "ready", pour rester compatible avec l'existant
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
      return "Traitement en cours…";
    case "partial":
      return `${doc.chunks} extraits (partiel)`;
    case "failed":
      return doc.errorMessage ? `Échec : ${doc.errorMessage}` : "Échec du traitement";
    default:
      return `${doc.chunks} extraits`;
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
      .catch((err) => console.error("Erreur chargement des conversations", err));
  }, [refreshKey]);

  return (
    <>
      {isOpen && <div className="sidebar-scrim" onClick={onToggle} />}

      <aside className={`sidebar ${isOpen ? "sidebar--open" : "sidebar--collapsed"}`}>
        <div className="sidebar__header">
          <span className="sidebar__title">Insightly Docs</span>
          <button className="icon-button sidebar__collapse" onClick={onToggle} aria-label="Masquer la barre laterale">
            <MenuIcon />
          </button>
        </div>

        <button className="sidebar__new-session" onClick={onNewSession}>
          <NewChatIcon />
          Nouvelle conversation
        </button>

        <div className="sidebar__section-label">Conversations</div>
        <div className="sidebar__documents">
          {conversations.length === 0 && (
            <p className="sidebar__empty">
              Vos conversations apparaîtront ici après votre première question.
            </p>
          )}
          {conversations.map((conv) => (
            <div
              className={`document-item ${conv.session_id === activeSessionId ? "document-item--active" : ""}`}
              key={conv.session_id}
              onClick={() => onSelectSession(conv.session_id)}
              style={{ cursor: "pointer" }}
            >
              <div className="document-item__info">
                <span className="document-item__name">{conv.preview || "Nouvelle conversation"}</span>
                <span className="document-item__meta">
                  {new Date(conv.last_activity).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar__section-label">Documents indexes (conversation actuelle)</div>
        <div className="sidebar__documents">
          {documents.length === 0 && (
            <p className="sidebar__empty">
              Ajoutez un PDF pour commencer — Insightly Docs l'analyse et en extrait les informations clés.
            </p>
          )}
          {documents.map((doc) => (
            <div
              className={`document-item ${doc.status === "processing" ? "document-item--processing" : ""} ${doc.status === "failed" ? "document-item--failed" : ""}`}
              key={doc.filename}
            >
              <FileIcon />
              <div className="document-item__info">
                <span className="document-item__name" title={doc.filename}>{doc.filename}</span>
                <span className="document-item__meta">{documentMeta(doc)}</span>
              </div>
              <button
                className="icon-button document-item__remove"
                onClick={() => onRemoveDocument(doc.filename)}
                aria-label={`Retirer ${doc.filename}`}
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