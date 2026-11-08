import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener("sweety:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("sweety:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        if (active) {
          setUser(response.data.user);
        }
      } catch {
        if (active) {
          logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [logout, token]);

  const acceptCredentials = useCallback((result) => {
    storeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setLoading(false);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    acceptCredentials(response.data);
    return response.data.user;
  }, [acceptCredentials]);

  const register = useCallback(async (details) => {
    const response = await api.post("/auth/register", details);
    acceptCredentials(response.data);
    return response.data.user;
  }, [acceptCredentials]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
