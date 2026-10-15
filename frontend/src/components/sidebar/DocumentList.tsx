import type { DocumentEntry } from "../../types";
import { FileIcon, TrashIcon } from "../ui/Icons";

function documentMeta(doc: DocumentEntry): string {
  switch (doc.status) {
    case "processing":
      return "Processing…";
    case "partial":
      return `${doc.chunks} chunks (partial)`;
    case "failed":
      return doc.errorMessage ? `Failed: ${doc.errorMessage}` : "Processing failed";
    default:
      return `${doc.chunks} chunks`;
  }
}

interface DocumentListProps {
  documents: DocumentEntry[];
  onRemove: (filename: string) => void;
}

export default function DocumentList({ documents, onRemove }: DocumentListProps) {
  return (
    <>
      <div className="sidebar__section-label">Documents in this conversation</div>
      <div className="sidebar__documents">
        {documents.length === 0 && <p className="sidebar__empty">No documents yet. Upload a PDF to get started.</p>}
        {documents.map((doc) => (
          <div
            className={`document-item ${doc.status === "processing" ? "document-item--processing" : ""} ${
              doc.status === "failed" ? "document-item--failed" : ""
            }`}
            key={doc.filename}
          >
            <FileIcon />
            <div className="document-item__info">
              <span className="document-item__name" title={doc.filename}>
                {doc.filename}
              </span>
              <span className="document-item__meta" title={documentMeta(doc)}>
                {documentMeta(doc)}
              </span>
            </div>
            <button
              className="icon-button document-item__remove"
              onClick={() => onRemove(doc.filename)}
              aria-label={`Remove ${doc.filename}`}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
