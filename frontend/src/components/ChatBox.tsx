import { useEffect, useRef, useState } from "react";
import { askQuestion, uploadFiles } from "../api/ragApi";
import type { IndexingJob } from "../api/ragApi";
import { CloseIcon, FileIcon, PlusIcon, SendIcon } from "./Icons";
import type { DocumentEntry } from "./Sidebar";
import IndexingProgress from "./IndexingProgress";
import { useToast } from "./Toast";
import { Network, Search } from "lucide-react";

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
  onDocumentUpdated: (filename: string, update: Partial<DocumentEntry>) => void;
  onMessageSent?: () => void;
}

const MAX_FILES = 5;
const MAX_PAGES = 500;

const SUGGESTIONS = [
  "Summarize the key points of this document",
  "List the important dates, figures and deadlines",
  "What risks or obligations are mentioned?",
];

export default function ChatBox({
  sessionId,
  ragMode,
  initialMessages = [],
  onDocumentsIndexed,
  onDocumentUpdated,
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
  const { showToast } = useToast();
  const isFirstRender = useRef(true);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Show a toast when the RAG mode changes (but not on the very first render).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (ragMode === "graph") {
      showToast("Graph mode enabled", { variant: "info", icon: <Network size={18} /> });
    } else {
      showToast("Standard search enabled", { variant: "info", icon: <Search size={18} /> });
    }
  }, [ragMode, showToast]);

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

      // Processing runs in the background: show the document as "processing",
      // then update it when its job completes.
      const placeholders: DocumentEntry[] = result.files.map((f) => ({
        filename: f.filename,
        chunks: 0,
        status: "processing",
      }));
      onDocumentsIndexed(placeholders);

      setShowIndexingProgress(true);

      showToast(`${result.files.length} document(s) received. Processing…`, {
        variant: "info",
      });

      setPendingFiles([]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "The upload failed.";
      setUploadError(message);
      showToast(message, { variant: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  // Update the document in the sidebar when a "document" job settles.
  const handleDocumentJobSettled = (job: IndexingJob) => {
    if (job.status === "failed") {
      onDocumentUpdated(job.filename, {
        chunks: 0,
        status: "failed",
        errorMessage: job.error_message ?? undefined,
      });
      showToast(
        `Failed to process ${job.filename}${job.error_message ? ": " + job.error_message : ""}`,
        { variant: "error" }
      );
      return;
    }

    const status = job.status === "completed_with_errors" ? "partial" : "ready";
    onDocumentUpdated(job.filename, {
      chunks: job.total_chunks,
      status,
      errorMessage: undefined,
    });

    if (status === "partial") {
      showToast(`${job.filename}: partially indexed (see details)`, { variant: "warning" });
    } else {
      showToast(`${job.filename}: indexing complete`, { variant: "success" });
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
      const message = err instanceof Error ? err.message : "Something went wrong while generating the answer.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      showToast(message, { variant: "error" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
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
      <div className="chat__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat__empty-state">
            <h2>Get answers from your documents</h2>
            <p>
              Upload up to {MAX_FILES} PDFs ({MAX_PAGES} pages in total) and ask questions in plain language.
              Every answer is grounded in your files and cites the documents it came from.
            </p>

            <div className="chat__suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat__suggestion" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div className={`message message--${msg.role}`} key={i}>
            <div className="message__bubble">{msg.content}</div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="message__sources">
                Sources: {msg.sources.map((s) => s.filename).join(", ")}
              </div>
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
                  aria-label={`Remove ${file.name}`}
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
            onDocumentJobSettled={handleDocumentJobSettled}
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
            aria-label="Attach PDFs"
            title="Attach PDFs"
          >
            <PlusIcon />
          </button>

          <textarea
            ref={textareaRef}
            className="composer__textarea"
            placeholder="Ask a question about your documents…"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          <button
            className="composer__send"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send"
            title="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}