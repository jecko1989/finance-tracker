import { useState, type FormEvent } from "react";

interface Props {
  title: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

export function ProjectFormModal({ title, initialName = "", onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(name);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <label className="mb-4 block text-sm">
          Nome progetto
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
