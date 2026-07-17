interface ThemeToggleProps {
  theme: "dark" | "light";
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      className="icon-button theme-toggle"
      onClick={onToggle}
      aria-label="Changer de theme"
      title="Changer de theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}