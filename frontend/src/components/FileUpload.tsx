import { useState } from "react";
import { uploadFiles } from "../api/ragApi";
import { FileIcon } from "./Icons";

interface Props {
  sessionId: string;
  onUploaded: (info: string) => void;
}

const MAX_FILES = 5;
const MAX_PAGES = 500;

export default function FileUpload({ sessionId, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const result = await uploadFiles(files, sessionId);
      // Processing runs in the background: the chunk count is not known yet.
      onUploaded(`${result.files.length} file(s) received, processing in the background`);
      setFiles([]);
    } catch (err) {
      console.error(err);
      onUploaded("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload">
      {loading && <div className="composer__progress" />}

      <h3 className="file-upload__title">
        Upload PDFs{" "}
        <span className="file-upload__limits">
          (max {MAX_FILES} files, {MAX_PAGES} pages in total)
        </span>
      </h3>

      <label className="file-upload__dropzone">
        <input
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, MAX_FILES))}
        />
        <FileIcon size={20} />
        <span>
          {files.length === 0
            ? "Click to choose one or more PDFs"
            : `${files.length} file(s) selected`}
        </span>
      </label>

      {files.length > 0 && (
        <ul className="file-upload__list">
          {files.map((f) => (
            <li key={f.name} className="file-upload__list-item">
              <FileIcon size={14} />
              <span className="file-upload__list-name">{f.name}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        className="file-upload__submit"
        onClick={handleUpload}
        disabled={loading || files.length === 0}
      >
        {loading ? "Uploading…" : "Upload and index"}
      </button>
    </div>
  );
}