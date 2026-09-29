import { useTheme } from "../context/ThemeContext";

// Colori per Recharts (che non legge le classi Tailwind), coerenti con il tema attivo.
export function useChartColors() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    grid: dark ? "#374151" : "#e5e7eb", // gray-700 / gray-200
    axis: dark ? "#9ca3af" : "#6b7280", // gray-400 / gray-500
    line: dark ? "#60a5fa" : "#2563eb", // blue-400 / blue-600
    income: dark ? "#34d399" : "#059669",
    expense: dark ? "#f87171" : "#dc2626",
    tooltip: {
      contentStyle: {
        backgroundColor: dark ? "#1f2937" : "#ffffff",
        border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
        borderRadius: 6,
        color: dark ? "#f3f4f6" : "#111827",
      },
      labelStyle: { color: dark ? "#f3f4f6" : "#111827" },
      cursor: { fill: dark ? "#ffffff10" : "#00000008", stroke: dark ? "#4b5563" : "#d1d5db" },
    },
  };
}
