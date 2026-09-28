import { useCallback, useState } from "react";
import { clearToken, getToken, login as apiLogin, setToken } from "../services/api";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(getToken());

  const login = useCallback(async (username: string, password: string) => {
    const newToken = await apiLogin(username, password);
    setToken(newToken);
    setTokenState(newToken);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return { isAuthenticated: token !== null, login, logout };
}
