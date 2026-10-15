interface ChatEmptyStateProps {
  maxFiles: number;
  maxPages: number;
  suggestions: string[];
  onSuggestion: (text: string) => void;
}

export default function ChatEmptyState({ maxFiles, maxPages, suggestions, onSuggestion }: ChatEmptyStateProps) {
  return (
    <div className="chat__empty-state">
      <h2>Get answers from your documents</h2>
      <p>
        Upload up to {maxFiles} PDFs ({maxPages} pages in total) and ask questions in plain language. Every answer is
        grounded in your files and cites the documents it came from.
      </p>

      <div className="chat__suggestions">
        {suggestions.map((s) => (
          <button key={s} className="chat__suggestion" onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
