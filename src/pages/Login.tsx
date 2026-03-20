import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import xpsLogo from "@/assets/xps-logo.png";
import { api } from "@/lib/api";
import { setUser, type User } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "login" | "signup" | "forgot";

const Login = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      toast({ title: "Coming soon", description: "Password reset is not yet available. Contact your administrator." });
      return;
    }
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const data = await api.post<{ token: string; user: User }>("/auth/register", { email, password, full_name: name });
        setUser(data.user, data.token);
        navigate("/onboarding");
      } else {
        const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
        setUser(data.user, data.token);
        navigate("/dashboard");
      }
    } catch (err) {
      toast({ title: mode === "signup" ? "Registration failed" : "Login failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="relative text-center px-12">
          <img src={xpsLogo} alt="XPS" className="h-24 w-24 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-3">XPS Intelligence</h1>
          <p className="text-muted-foreground max-w-sm">AI-Powered Sales Command Center for Xtreme Polishing Systems</p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            {[
              { v: "60+", l: "Locations" },
              { v: "200+", l: "Sales Staff" },
              { v: "50K+", l: "Leads" },
              { v: "24/7", l: "AI Support" },
            ].map((s) => (
              <div key={s.l} className="bg-card/50 border border-border rounded-lg p-3">
                <div className="text-lg font-bold text-gradient-gold">{s.v}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={xpsLogo} alt="XPS" className="h-10 w-10" />
            <span className="text-sm font-bold tracking-wider text-foreground">XPS INTELLIGENCE</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" ? "Sign in to your XPS Intelligence account" : mode === "signup" ? "Join the XPS sales platform" : "We'll send you a reset link"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="text-xs text-muted-foreground">Full Name</Label>
                <Input id="name" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-card border-border" />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@xpsxpress.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-card border-border" />
            </div>
            {mode !== "forgot" && (
              <div>
                <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                <div className="relative mt-1">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {mode === "login" && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
            )}

            <Button variant="gold" className="w-full" size="lg" type="submit" disabled={isLoading}>
              {isLoading ? (mode === "signup" ? "Creating account..." : "Signing in...") : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {mode === "login" ? (
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">Sign up</button>
              </p>
            ) : (
              <button onClick={() => setMode("login")} className="text-sm text-primary hover:underline font-medium flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
