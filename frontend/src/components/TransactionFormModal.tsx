import { useState, type FormEvent } from "react";
import type { TransactionInput } from "../services/api";
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="w-96 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          {initial ? "Modifica transazione" : "Nuova transazione"}
        </h2>

        <div className="mb-3 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setIsIncome(true)}
            className={`flex-1 rounded border py-1 ${isIncome ? "bg-emerald-600 text-white" : ""}`}
          >
            Entrata
          </button>
          <button
            type="button"
            onClick={() => setIsIncome(false)}
            className={`flex-1 rounded border py-1 ${!isIncome ? "bg-red-600 text-white" : ""}`}
          >
            Uscita
          </button>
        </div>

        <label className="mb-3 block text-sm">
          Importo
          <input
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded border px-2 py-1"
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            required
          />
        </label>

        <label className="mb-3 block text-sm">
          Data
          <input
            type="date"
            className="mt-1 w-full rounded border px-2 py-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label className="mb-3 block text-sm">
          Nota
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="mb-4 block text-sm">
          Categoria
          <input
            list="category-suggestions"
            className="mt-1 w-full rounded border px-2 py-1"
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
          <button type="button" onClick={onClose} className="rounded px-3 py-1 text-slate-600">
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </form>
    </div>
  );
}
