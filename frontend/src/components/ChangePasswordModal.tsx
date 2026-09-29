import { useState, type FormEvent } from "react";
import { changePassword } from "../services/api";

interface Props {
  onClose: () => void;
}

const MIN_LENGTH = 6;

export function ChangePasswordModal({ onClose }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_LENGTH) {
      setError(`La nuova password deve avere almeno ${MIN_LENGTH} caratteri`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il cambio password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Cambia password</h2>
        {success ? (
          <>
            <p className="mb-4 text-sm text-green-700">Password cambiata con successo</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-slate-800 px-3 py-1 text-white"
              >
                Chiudi
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mb-3 block text-sm">
              Password attuale
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded border px-2 py-1"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </label>
            <label className="mb-3 block text-sm">
              Nuova password
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded border px-2 py-1"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block text-sm">
              Conferma nuova password
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded border px-2 py-1"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
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
          </>
        )}
      </form>
    </div>
  );
}
