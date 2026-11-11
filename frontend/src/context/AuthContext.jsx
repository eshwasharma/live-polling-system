
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

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `Server returned an empty response (${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned an invalid response (${response.status}). Check the API URL and backend.`
    );
  }
}

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
      const data = await readResponse(response);

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

    const data = await readResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Authentication failed");
    }

    if (!data.token) {
      throw new Error("Login succeeded but the server did not return a token.");
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
