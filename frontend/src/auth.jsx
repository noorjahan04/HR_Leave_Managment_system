import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => localStorage.clear()).finally(() => setLoading(false));
  }, []);

  const save = (data) => {
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };
  const login = async (email, password) => save((await api.post("/auth/login", { email, password })).data);
  const signup = async (form) => save((await api.post("/auth/signup", form)).data);
  const logout = () => { localStorage.clear(); setUser(null); };

  return <AuthCtx.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthCtx.Provider>;
}