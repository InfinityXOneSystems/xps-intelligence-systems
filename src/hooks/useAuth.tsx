import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

export interface ExtendedUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  job_title?: string;
  division?: string;
  territory?: string;
  specialty?: string[];
  onboarding_complete?: boolean;
}

interface AuthContextType {
  user: ExtendedUser | null;
  session: Session | null;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  signOut: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (supabaseUser: SupabaseUser) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    if (profile) {
      setUser({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name ?? undefined,
        phone: profile.phone ?? undefined,
        avatar_url: profile.avatar_url ?? undefined,
        job_title: profile.job_title ?? undefined,
        division: profile.division ?? undefined,
        territory: profile.territory ?? undefined,
        specialty: profile.specialty ?? undefined,
        onboarding_complete: profile.onboarding_complete ?? false,
      });
    } else {
      // Fallback if profile hasn't been created yet
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        role: "employee",
        full_name: supabaseUser.user_metadata?.full_name,
        onboarding_complete: false,
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(newSession.user), 0);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchProfile(existingSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
