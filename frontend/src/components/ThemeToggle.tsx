import { useTheme } from "../context/ThemeContext";

// Interruttore chiaro/scuro; in modalità compatta mostra solo l'icona.
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Passa al tema chiaro" : "Passa al tema scuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex cursor-pointer items-center ${compact ? "justify-center" : "w-full justify-start"}`}
      aria-label={label}
      title={label}
    >
      {compact ? (
        <span className="text-xl">{dark ? "🌙" : "☀️"}</span>
      ) : (
        <span
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
            dark ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute h-7 w-7 rounded-full bg-white shadow transition-all duration-300 ${
              dark ? "left-[2.125rem]" : "left-px"
            }`}
          />
          <span className={`absolute left-1.5 text-sm transition-opacity ${dark ? "opacity-30" : "opacity-100"}`}>☀️</span>
          <span className={`absolute right-1.5 text-sm transition-opacity ${dark ? "opacity-100" : "opacity-30"}`}>🌙</span>
        </span>
      )}
    </button>
  );
}
