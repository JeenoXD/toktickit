import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser, getMe, login as apiLogin, logout as apiLogout } from "./api.js";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, skipInitialCheck = false }: { children: ReactNode; skipInitialCheck?: boolean }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!skipInitialCheck);

  useEffect(() => {
    if (skipInitialCheck) return;
    getMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, [skipInitialCheck]);

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password);
    setUser(u);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  async function refreshUser() {
    const u = await getMe();
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}