import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getUser, clearAuth, type User } from "@/lib/auth";

export interface ExtendedUser extends User {
  full_name?: string;
  phone?: string;
  photo_url?: string;
  job_title?: string;
  division?: string;
  territory?: string;
  specialty?: string;
  onboarding_complete?: boolean;
}

interface AuthContextType {
  user: ExtendedUser | null;
  signOut: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, signOut: () => {}, isLoading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const localUser = getUser();
    if (localUser) {
      setUser(localUser as ExtendedUser);
      // Fetch extended profile from API
      import("@/lib/api").then(({ api }) => {
        api.get<ExtendedUser>("/profile")
          .then((profile) => {
            const extended = { ...localUser, ...profile } as ExtendedUser;
            setUser(extended);
            localStorage.setItem("xps_user", JSON.stringify(extended));
          })
          .catch(() => {}); // Silent fail - use cached data
      });
    }
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
