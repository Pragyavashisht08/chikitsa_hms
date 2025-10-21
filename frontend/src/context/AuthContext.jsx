import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";


const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  useEffect(() => { user ? localStorage.setItem("user", JSON.stringify(user)) : localStorage.removeItem("user"); }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };
  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };
  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  return <AuthCtx.Provider value={{ user, setUser, login, signup, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
