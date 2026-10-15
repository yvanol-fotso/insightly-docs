import { useCallback, useEffect, useRef, useState } from "react";
import { FEATURES } from "../../config/features";
import { useDismiss } from "../../hooks/useDismiss";
import type { ConversationEntry } from "../../types";
import { MoreIcon, PencilIcon, TrashIcon } from "../ui/Icons";

interface ConversationItemProps {
  conversation: ConversationEntry;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

const FALLBACK_TITLE = "New conversation";

export default function ConversationItem({ conversation, active, onSelect, onRename, onDelete }: ConversationItemProps) {
  const title = conversation.title || conversation.preview || FALLBACK_TITLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(rootRef, menuOpen, closeMenu);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== title) onRename(next);
  };

  return (
    <div
      ref={rootRef}
      className={`conversation-item ${active ? "conversation-item--active" : ""}`}
      onClick={() => !editing && onSelect()}
    >
      <div className="conversation-item__info">
        {editing ? (
          <input
            ref={inputRef}
            className="conversation-item__input"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Conversation title"
          />
        ) : (
          <span className="conversation-item__title" title={title}>
            {title}
          </span>
        )}
        <span className="conversation-item__meta">
          {new Date(conversation.last_activity).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {FEATURES.manageConversations && !editing && (
        <>
          <button
            className="icon-button conversation-item__more"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div className="conversation-item__menu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button
                role="menuitem"
                onClick={() => {
                  setDraft(title);
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                <PencilIcon /> Rename
              </button>
              <button
                role="menuitem"
                className="conversation-item__menu-danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <TrashIcon /> Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
