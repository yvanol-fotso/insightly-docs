import { useRef } from "react";
import { CloseIcon, FileIcon, PlusIcon, SendIcon } from "../ui/Icons";

interface ComposerProps {
  value: string;
  pendingFiles: File[];
  maxFiles: number;
  busy: boolean;
  isUploading: boolean;
  canSend: boolean;
  uploadError: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemovePending: (name: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Slot for the indexing progress panel. */
  children?: React.ReactNode;
}

export default function Composer({
  value,
  pendingFiles,
  maxFiles,
  busy,
  isUploading,
  canSend,
  uploadError,
  onChange,
  onSend,
  onFilesSelected,
  onRemovePending,
  textareaRef,
  children,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="composer">
      {busy && <div className="composer__progress" />}

      {pendingFiles.length > 0 && (
        <div className="composer__attachments">
          {pendingFiles.map((file) => (
            <div className="attachment-chip" key={file.name}>
              <FileIcon size={14} />
              <span className="attachment-chip__name">{file.name}</span>
              <button
                className="attachment-chip__remove"
                onClick={() => onRemovePending(file.name)}
                aria-label={`Remove ${file.name}`}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && <div className="composer__error">{uploadError}</div>}

      {children}

      <div className="composer__input-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            onFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          className="icon-button composer__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={pendingFiles.length >= maxFiles || isUploading}
          aria-label="Attach PDFs"
          title="Attach PDFs"
        >
          <PlusIcon />
        </button>

        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder="Ask a question about your documents…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <button className="composer__send" onClick={onSend} disabled={!canSend} aria-label="Send" title="Send">
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
