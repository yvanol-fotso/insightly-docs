import { useEffect, useRef, useState } from "react";
import { askQuestion, uploadFiles } from "../api/ragApi";
import { CloseIcon, FileIcon, PlusIcon, SendIcon } from "./Icons";
import type { DocumentEntry } from "./Sidebar";
import IndexingProgress from "./IndexingProgress";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { filename: string; score: number }[];
}

type RagMode = "naive" | "graph";

interface ChatBoxProps {
  sessionId: string;
  ragMode: RagMode;
  initialMessages?: Message[];
  onDocumentsIndexed: (documents: DocumentEntry[]) => void;
  onMessageSent?: () => void;
}

const MAX_FILES = 5;
const MAX_PAGES = 500;

export default function ChatBox({
  sessionId,
  ragMode,
  initialMessages = [],
  onDocumentsIndexed,
  onMessageSent,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showIndexingProgress, setShowIndexingProgress] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((f) => f.type === "application/pdf");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (incoming.length === 0) return;

    const combined = [...pendingFiles, ...incoming].slice(0, MAX_FILES);
    setPendingFiles(combined);
    setUploadError(null);
    setIsUploading(true);

    try {
      const result = await uploadFiles(combined, sessionId);
      onDocumentsIndexed(
        result.files.map((f) => ({
          filename: f.filename,
          chunks: f.totalChunks,
        }))
      );

      if (result.graphIngestion) {
        setShowIndexingProgress(true);
      }

      setPendingFiles([]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "L'indexation des documents a echoue.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const removePendingFile = (name: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isSending || isUploading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSending(true);

    try {
      const result = await askQuestion(question, sessionId, ragMode);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer, sources: result.sources }]);
      onMessageSent?.();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Une erreur est survenue pendant la generation de la reponse.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const canSend = input.trim().length > 0 && !isSending && !isUploading;

  return (
    <div className="chat">
      <div className="chat__mode-badge">
        {ragMode === "graph" ? "🕸️ Mode Graphe activé" : "🔍 Mode recherche standard"}
      </div>

      <div className="chat__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat__empty-state">
            <h2>Vos documents, enfin faciles à interroger</h2>
            <p>
              Ajoutez jusqu'à {MAX_FILES} PDF ({MAX_PAGES} pages cumulées max), et Insightly Docs répond à vos
              questions en citant précisément les passages concernés.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div className={`message message--${msg.role}`} key={i}>
            <div className="message__bubble">{msg.content}</div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="message__sources">
                Sources : {msg.sources.map((s) => s.filename).join(", ")}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="message message--assistant">
            <div className="message__bubble message__bubble--typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        {(isUploading || isSending) && <div className="composer__progress" />}

        {pendingFiles.length > 0 && (
          <div className="composer__attachments">
            {pendingFiles.map((file) => (
              <div className="attachment-chip" key={file.name}>
                <FileIcon size={14} />
                <span className="attachment-chip__name">{file.name}</span>
                <button
                  className="attachment-chip__remove"
                  onClick={() => removePendingFile(file.name)}
                  aria-label={`Retirer ${file.name}`}
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && <div className="composer__error">{uploadError}</div>}

        {showIndexingProgress && (
          <IndexingProgress
            sessionId={sessionId}
            onAllCompleted={() => {
              setTimeout(() => setShowIndexingProgress(false), 4000);
            }}
          />
        )}

        <div className="composer__input-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <button
            className="icon-button composer__attach"
            onClick={handleAttachClick}
            disabled={pendingFiles.length >= MAX_FILES || isUploading}
            aria-label="Joindre des PDF"
            title="Joindre des PDF"
          >
            <PlusIcon />
          </button>

          <textarea
            ref={textareaRef}
            className="composer__textarea"
            placeholder="Posez votre question..."
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          <button
            className="composer__send"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Envoyer"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}