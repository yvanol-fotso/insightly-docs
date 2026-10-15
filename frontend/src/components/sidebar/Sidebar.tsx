import type { DocumentEntry, RagMode } from "../../types";
import { MenuIcon, NewChatIcon } from "../ui/Icons";
import UserMenu from "../user-menu/UserMenu";
import ConversationList from "./ConversationList";
import DocumentList from "./DocumentList";

interface SidebarProps {
  documents: DocumentEntry[];
  isOpen: boolean;
  activeSessionId: string;
  refreshKey: number;
  ragMode: RagMode;
  onToggle: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onSessionDeleted: (sessionId: string) => void;
  onRemoveDocument: (filename: string) => void;
  onRagModeChange: (mode: RagMode) => void;
  onUpgradeClick: () => void;
}

export default function Sidebar({
  documents,
  isOpen,
  activeSessionId,
  refreshKey,
  ragMode,
  onToggle,
  onNewSession,
  onSelectSession,
  onSessionDeleted,
  onRemoveDocument,
  onRagModeChange,
  onUpgradeClick,
}: SidebarProps) {
  return (
    <>
      {isOpen && <div className="sidebar-scrim" onClick={onToggle} />}

      <aside className={`sidebar ${isOpen ? "sidebar--open" : "sidebar--collapsed"}`}>
        <div className="sidebar__header">
          <span className="sidebar__title">Insightly Docs</span>
          <button className="icon-button" onClick={onToggle} aria-label="Hide sidebar" title="Hide sidebar">
            <MenuIcon />
          </button>
        </div>

        <button className="sidebar__new-session" onClick={onNewSession}>
          <NewChatIcon />
          New conversation
        </button>

        <ConversationList
          activeSessionId={activeSessionId}
          refreshKey={refreshKey}
          onSelect={onSelectSession}
          onDeleted={onSessionDeleted}
        />

        <DocumentList documents={documents} onRemove={onRemoveDocument} />

        <UserMenu ragMode={ragMode} onRagModeChange={onRagModeChange} onUpgradeClick={onUpgradeClick} />
      </aside>
    </>
  );
}
