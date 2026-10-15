import { useEffect, useRef, useState } from "react";
import { askQuestion, uploadFiles } from "../../api/ragApi";
import type { IndexingJob } from "../../api/ragApi";
import type { ChatMessage, DocumentEntry, RagMode } from "../../types";
import { useToast } from "../ui/toast/useToast";
import ChatEmptyState from "./ChatEmptyState";
import Composer from "./Composer";
import IndexingProgress from "./IndexingProgress";
import MessageList from "./MessageList";

interface ChatBoxProps {
  sessionId: string;
  ragMode: RagMode;
  initialMessages?: ChatMessage[];
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
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showIndexingProgress, setShowIndexingProgress] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((f) => f.type === "application/pdf");
    if (incoming.length === 0) return;

    const combined = [...pendingFiles, ...incoming].slice(0, MAX_FILES);
    setPendingFiles(combined);
    setUploadError(null);
    setIsUploading(true);

    try {
      const result = await uploadFiles(combined, sessionId);

      // Processing runs in the background: show each document as "processing",
      // then update it when its job completes.
      onDocumentsIndexed(result.files.map((f) => ({ filename: f.filename, chunks: 0, status: "processing" as const })));
      setShowIndexingProgress(true);
      showToast(`${result.files.length} document(s) received. Processing…`, { variant: "info" });
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
      onDocumentUpdated(job.filename, { chunks: 0, status: "failed", errorMessage: job.error_message ?? undefined });
      showToast(`Failed to process ${job.filename}${job.error_message ? ": " + job.error_message : ""}`, {
        variant: "error",
      });
      return;
    }

    const status = job.status === "completed_with_errors" ? "partial" : "ready";
    onDocumentUpdated(job.filename, { chunks: job.total_chunks, status, errorMessage: undefined });

    if (status === "partial") {
      showToast(`${job.filename}: partially indexed (see details)`, { variant: "warning" });
    } else {
      showToast(`${job.filename}: indexing complete`, { variant: "success" });
    }
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

  return (
    <div className="chat">
      <div className="chat__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <ChatEmptyState
            maxFiles={MAX_FILES}
            maxPages={MAX_PAGES}
            suggestions={SUGGESTIONS}
            onSuggestion={handleSuggestion}
          />
        )}
        <MessageList messages={messages} isSending={isSending} />
      </div>

      <Composer
        value={input}
        pendingFiles={pendingFiles}
        maxFiles={MAX_FILES}
        busy={isUploading || isSending}
        isUploading={isUploading}
        canSend={input.trim().length > 0 && !isSending && !isUploading}
        uploadError={uploadError}
        onChange={setInput}
        onSend={handleSend}
        onFilesSelected={handleFilesSelected}
        onRemovePending={(name) => setPendingFiles((prev) => prev.filter((f) => f.name !== name))}
        textareaRef={textareaRef}
      >
        {showIndexingProgress && (
          <IndexingProgress
            sessionId={sessionId}
            onDocumentJobSettled={handleDocumentJobSettled}
            onAllCompleted={() => setTimeout(() => setShowIndexingProgress(false), 4000)}
          />
        )}
      </Composer>
    </div>
  );
}
