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
      onUploaded(`${result.files.length} fichier(s) indexé(s) (${result.totalStored} chunks au total)`);
      setFiles([]);
    } catch (err) {
      console.error(err);
      onUploaded("Erreur lors de l'upload");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload">
      {loading && <div className="composer__progress" />}

      <h3 className="file-upload__title">
        Uploader des PDF <span className="file-upload__limits">(max {MAX_FILES}, {MAX_PAGES} pages cumulées)</span>
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
            ? "Cliquez pour choisir un ou plusieurs PDF"
            : `${files.length} fichier(s) sélectionné(s)`}
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
        {loading ? "Indexation en cours..." : "Uploader et indexer"}
      </button>
    </div>
  );
}