import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getUser, clearAuth, type User } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  signOut: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, signOut: () => {}, isLoading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    setIsLoading(false);
  }, []);

  const signOut = () => {
    clearAuth();
    setUser(null);
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ user, signOut, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
