import { useState, type FormEvent } from "react";
import { changePassword } from "../services/api";
import { btnPrimary, btnSecondary, errorBox, inputClass, labelClass, modalOverlayClass, modalPanelClass } from "../styles";

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
    <div className={modalOverlayClass}>
      <form onSubmit={handleSubmit} className={`max-w-sm ${modalPanelClass}`}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Cambia password</h2>
        {success ? (
          <>
            <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">Password cambiata con successo</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className={btnPrimary}
              >
                Chiudi
              </button>
            </div>
          </>
        ) : (
          <>
            <label className={`mb-3 ${labelClass}`}>
              Password attuale
              <input
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </label>
            <label className={`mb-3 ${labelClass}`}>
              Nuova password
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label className={`mb-4 ${labelClass}`}>
              Conferma nuova password
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className={`mb-3 ${errorBox}`}>{error}</p>}
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
          </>
        )}
      </form>
    </div>
  );
}
