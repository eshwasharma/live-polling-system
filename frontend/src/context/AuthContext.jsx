
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  apiFetch,
  clearToken,
  getToken,
  saveToken,
  getApiUrl,
} from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/api/auth/me");
      const data = await response.json();

      if (!response.ok || !data.success) {
        logout();
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error("Unable to restore login session:", error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener(
      "pulsepoll:unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "pulsepoll:unauthorized",
        handleUnauthorized
      );
    };
  }, [logout]);

  const authenticate = async (endpoint, details) => {
    const response = await fetch(getApiUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(details),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Authentication failed");
    }

    saveToken(data.token);
    setUser(data.user);

    return data;
  };

  const signup = (details) =>
    authenticate("/api/auth/signup", details);

  const login = (details) =>
    authenticate("/api/auth/login", details);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signup,
        login,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
