import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../hooks/useAuth";
import { btnPrimary, cardClass, errorBox, inputClass, labelClass, mutedText } from "../styles";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Credenziali non valide");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <form onSubmit={handleSubmit} className={`w-full max-w-sm p-6 ${cardClass}`}>
        <h1 className="mb-1 text-xl font-bold">💰 Finance Tracker</h1>
        <p className={`mb-4 text-sm ${mutedText}`}>Accedi per continuare</p>
        {error && <p className={`mb-3 ${errorBox}`}>{error}</p>}
        <label className={`mb-3 ${labelClass}`}>
          Utente
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className={`mb-4 ${labelClass}`}>
          Password
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className={`w-full ${btnPrimary}`}>
          Accedi
        </button>
      </form>
    </div>
  );
}
