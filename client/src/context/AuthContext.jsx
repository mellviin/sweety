import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const startupToken = useRef(getStoredToken());
  const authVersion = useRef(0);
  const restoreRequest = useRef(null);
  const [token, setToken] = useState(startupToken.current);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(async () => {
    const currentToken = getStoredToken();
    authVersion.current += 1;
    try {
      if (currentToken) {
        await api.post("/auth/logout", {}, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      }
    } finally {
      clearStoredToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      authVersion.current += 1;
      setLoading(false);
      setToken(null);
      setUser(null);
      setSessionExpired(Boolean(event.detail?.sessionExpired));
      if (event.detail?.sessionExpired) {
        navigate("/login", {
          replace: true,
          state: { sessionExpired: true },
        });
      }
    };

    window.addEventListener("sweety:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("sweety:unauthorized", handleUnauthorized);
    };
  }, [navigate]);

  useEffect(() => {
    const tokenAtStartup = startupToken.current;
    if (!tokenAtStartup) {
      setLoading(false);
      return undefined;
    }

    const versionAtStart = authVersion.current;
    restoreRequest.current ??= Promise.resolve(api.get("/auth/me"));
    let ignore = false;

    restoreRequest.current
      .then((response) => {
        if (
          !ignore
          && authVersion.current === versionAtStart
          && getStoredToken() === tokenAtStartup
        ) {
          setUser(response.data.user);
        }
      })
      .catch(() => {
        if (
          !ignore
          && authVersion.current === versionAtStart
          && getStoredToken() === tokenAtStartup
        ) {
          logout();
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [logout]);

  const acceptCredentials = useCallback((result) => {
    authVersion.current += 1;
    setSessionExpired(false);
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

  const changePassword = useCallback(async (passwords) => {
    const response = await api.post("/auth/change-password", passwords);
    storeToken(response.data.token);
    setToken(response.data.token);
    return response.data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      sessionExpired,
      login,
      register,
      logout,
      changePassword,
    }),
    [user, token, loading, sessionExpired, login, register, logout, changePassword],
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
