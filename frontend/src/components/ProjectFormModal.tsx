import { useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary, inputClass, labelClass, modalOverlayClass, modalPanelClass } from "../styles";

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
    <div className={modalOverlayClass}>
      <form onSubmit={handleSubmit} className={`max-w-sm ${modalPanelClass}`}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <label className={`mb-4 ${labelClass}`}>
          Nome progetto
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
