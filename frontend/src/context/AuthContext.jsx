// src/context/AuthContext.jsx — Contexto de autenticación JWT
import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY  = "parq_token";
const USER_KEY   = "parq_user";

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  });

  const login = useCallback((tokenData) => {
    // tokenData: { access_token, rol, nombre, cuenta_id }
    localStorage.setItem(TOKEN_KEY, tokenData.access_token);
    localStorage.setItem(USER_KEY,  JSON.stringify(tokenData));
    setToken(tokenData.access_token);
    setUser(tokenData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin   = user?.rol === "admin";
  const isUsuario = user?.rol === "usuario";
  const estaLogueado = !!token;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAdmin, isUsuario, estaLogueado }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}