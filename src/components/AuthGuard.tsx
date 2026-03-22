import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

export function AuthGuard({ children, requireOnboarding = false }: AuthGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (requireOnboarding && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
