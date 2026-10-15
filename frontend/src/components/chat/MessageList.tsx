import type { ChatMessage } from "../../types";

interface MessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
}

export default function MessageList({ messages, isSending }: MessageListProps) {
  return (
    <>
      {messages.map((msg, i) => (
        <div className={`message message--${msg.role}`} key={i}>
          <div className="message__bubble">{msg.content}</div>
          {msg.sources && msg.sources.length > 0 && (
            <div className="message__sources">Sources: {msg.sources.map((s) => s.filename).join(", ")}</div>
          )}
        </div>
      ))}

      {isSending && (
        <div className="message message--assistant">
          <div className="message__bubble message__bubble--typing" aria-label="Generating answer">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}
    </>
  );
}
