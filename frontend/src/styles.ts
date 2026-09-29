// Classi Tailwind condivise, così l'aspetto resta coerente tra chiaro e scuro.

export const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 " +
  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 " +
  "dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500";

export const filterInputClass = inputClass.replace("mt-1 w-full ", "");

export const labelClass = "block text-sm text-gray-600 dark:text-gray-300";

export const btnPrimary =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60";

export const btnSecondary =
  "rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 " +
  "dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";

export const cardClass =
  "rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800";

export const modalOverlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";

export const modalPanelClass =
  "w-full rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800";

export const positiveText = "text-emerald-600 dark:text-emerald-400";
export const negativeText = "text-red-600 dark:text-red-400";
export const mutedText = "text-gray-500 dark:text-gray-400";

export const errorBox =
  "rounded-md border-l-4 border-red-400 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300";
