import { useState, type FormEvent } from "react";
import type { TransactionInput } from "../services/api";
import { btnPrimary, btnSecondary, inputClass, labelClass, modalOverlayClass, modalPanelClass } from "../styles";
import type { Transaction } from "../types";

interface Props {
  categorySuggestions: string[];
  initial?: Transaction;
  onSubmit: (data: TransactionInput) => Promise<void>;
  onClose: () => void;
}

export function TransactionFormModal({ categorySuggestions, initial, onSubmit, onClose }: Props) {
  const [isIncome, setIsIncome] = useState(initial ? Number(initial.amount) >= 0 : true);
  const [magnitude, setMagnitude] = useState(
    initial ? Math.abs(Number(initial.amount)).toString() : "",
  );
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const value = Number(magnitude);
      await onSubmit({
        amount: isIncome ? value : -value,
        date,
        note: note || null,
        category: category || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={modalOverlayClass}>
      <form onSubmit={handleSubmit} className={`max-w-md ${modalPanelClass}`}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {initial ? "Modifica transazione" : "Nuova transazione"}
        </h2>

        <div className="mb-3 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setIsIncome(true)}
            className={`flex-1 rounded-md border py-1.5 transition ${
              isIncome ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Entrata
          </button>
          <button
            type="button"
            onClick={() => setIsIncome(false)}
            className={`flex-1 rounded-md border py-1.5 transition ${
              !isIncome ? "border-red-600 bg-red-600 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Uscita
          </button>
        </div>

        <label className={`mb-3 ${labelClass}`}>
          Importo
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            required
          />
        </label>

        <label className={`mb-3 ${labelClass}`}>
          Data
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label className={`mb-3 ${labelClass}`}>
          Nota
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className={`mb-4 ${labelClass}`}>
          Categoria
          <input
            list="category-suggestions"
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={btnPrimary}
          >
            Salva
          </button>
        </div>
      </form>
    </div>
  );
}
