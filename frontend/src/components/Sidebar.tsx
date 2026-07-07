import { useEffect, useState } from "react";
import { listSessions } from "../api/ragApi";
import { FileIcon, MenuIcon, NewChatIcon, TrashIcon } from "./Icons";

export interface DocumentEntry {
  filename: string;
  chunks: number;
}

interface ConversationEntry {
  session_id: string;
  preview: string;
  last_activity: string;
}

interface SidebarProps {
  documents: DocumentEntry[];
  isOpen: boolean;
  activeSessionId: string;
  onToggle: () => void;
  onNewSession: () => void;
  onRemoveDocument: (filename: string) => void;
  onSelectSession: (sessionId: string) => void;
  refreshKey: number; // new  pour forcer un rechargement de la liste apres une nouvelle question
}

export default function Sidebar({
  documents,
  isOpen,
  activeSessionId,
  onToggle,
  onNewSession,
  onRemoveDocument,
  onSelectSession,
  refreshKey,
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
          <span className="sidebar__title">Assistant documentaire</span>
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
            <p className="sidebar__empty">Aucune conversation pour l'instant.</p>
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
            <p className="sidebar__empty">Aucun document pour l'instant.</p>
          )}
          {documents.map((doc) => (
            <div className="document-item" key={doc.filename}>
              <FileIcon />
              <div className="document-item__info">
                <span className="document-item__name" title={doc.filename}>{doc.filename}</span>
                <span className="document-item__meta">{doc.chunks} extraits</span>
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
      </aside>
    </>
  );
}