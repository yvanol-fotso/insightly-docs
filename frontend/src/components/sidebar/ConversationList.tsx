import { useConversations } from "../../hooks/useConversations";
import { useToast } from "../ui/toast/useToast";
import ConversationItem from "./ConversationItem";

interface ConversationListProps {
  activeSessionId: string;
  refreshKey: number;
  onSelect: (sessionId: string) => void;
  /** Called after a conversation is deleted so the app can leave it if it was open. */
  onDeleted: (sessionId: string) => void;
}

export default function ConversationList({ activeSessionId, refreshKey, onSelect, onDeleted }: ConversationListProps) {
  const { conversations, rename, remove } = useConversations(refreshKey);
  const { showToast } = useToast();

  const handleRename = (sessionId: string, title: string) =>
    rename(sessionId, title).catch(() => showToast("Could not rename the conversation.", { variant: "error" }));

  const handleDelete = (sessionId: string) =>
    remove(sessionId)
      .then(() => onDeleted(sessionId))
      .catch(() => showToast("Could not delete the conversation.", { variant: "error" }));

  return (
    <>
      <div className="sidebar__section-label">Conversations</div>
      <div className="sidebar__documents">
        {conversations.length === 0 && <p className="sidebar__empty">No conversations yet.</p>}
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.session_id}
            conversation={conv}
            active={conv.session_id === activeSessionId}
            onSelect={() => onSelect(conv.session_id)}
            onRename={(title) => handleRename(conv.session_id, title)}
            onDelete={() => handleDelete(conv.session_id)}
          />
        ))}
      </div>
    </>
  );
}
