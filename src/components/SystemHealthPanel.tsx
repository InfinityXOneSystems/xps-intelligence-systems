import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticResult {
  component: string;
  status: "ok" | "degraded" | "error";
  latency?: number;
  detail?: string;
}

interface DiagnoseResponse {
  status: "healthy" | "degraded" | "unhealthy";
  diagnostics: DiagnosticResult[];
  timestamp: string;
}

interface HealResponse {
  healed: boolean;
  actions: Array<{ component: string; action: string; success: boolean; detail?: string }>;
  timestamp: string;
}

const statusConfig = {
  ok: { icon: CheckCircle2, cls: "text-green-400", label: "Healthy", badge: "bg-green-500/10 text-green-400 border-green-500/30" },
  degraded: { icon: AlertTriangle, cls: "text-yellow-400", label: "Degraded", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  error: { icon: XCircle, cls: "text-destructive", label: "Error", badge: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function SystemHealthPanel() {
  const [data, setData] = useState<DiagnoseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const diagnose = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await api.get<DiagnoseResponse>("/health/diagnose");
      setData(result);
      setLastUpdated(new Date());
    } catch {
      // Silently fail on background polls
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    diagnose();
    const interval = setInterval(() => diagnose(true), 30000);
    return () => clearInterval(interval);
  }, [diagnose]);

  const handleHealAll = async () => {
    setIsHealing(true);
    try {
      const result = await api.post<HealResponse>("/health/heal", {});
      toast({
        title: result.healed ? "All systems healed" : "Partial heal completed",
        description: `${result.actions.filter((a) => a.success).length}/${result.actions.length} components recovered`,
        variant: result.healed ? "default" : "destructive",
      });
      await diagnose();
    } catch (err) {
      toast({ title: "Heal failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsHealing(false);
    }
  };

  const handleHealComponent = async (_component: string) => {
    // The heal endpoint attempts recovery for all degraded components
    setIsHealing(true);
    try {
      const result = await api.post<HealResponse>("/health/heal", {});
      const recovered = result.actions.filter((a) => a.success).length;
      toast({
        title: result.healed ? "Systems healed" : "Partial recovery",
        description: `${recovered}/${result.actions.length} components recovered`,
        variant: result.healed ? "default" : "destructive",
      });
      await diagnose();
    } catch (err) {
      toast({ title: "Heal failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsHealing(false);
    }
  };

  const hasDegradedOrError = data?.diagnostics.some((d) => d.status !== "ok");

  return (
    <div className="bg-gradient-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">System Health</h3>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground">Last checked: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDegradedOrError && (
            <Button variant="gold" size="sm" onClick={handleHealAll} disabled={isHealing}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {isHealing ? "Healing..." : "Heal All"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => diagnose()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!data && isLoading && (
        <p className="text-sm text-muted-foreground py-4 text-center">Diagnosing system...</p>
      )}

      {data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.diagnostics.map((item) => {
            const cfg = statusConfig[item.status];
            const StatusIcon = cfg.icon;
            const isDegraded = item.status !== "ok";
            return (
              <div key={item.component} className={`rounded-lg border p-3 ${isDegraded ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between mb-2">
                  <StatusIcon className={`h-4 w-4 ${cfg.cls}`} />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-xs font-semibold text-foreground mb-0.5">{item.component}</div>
                {item.latency !== undefined && (
                  <div className="text-[10px] text-muted-foreground">{item.latency}ms</div>
                )}
                {item.detail && (
                  <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{item.detail}</div>
                )}
                {isDegraded && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 h-6 text-[10px]"
                    onClick={() => handleHealComponent(item.component)}
                    disabled={isHealing}
                  >
                    <Zap className="h-3 w-3 mr-1" /> Heal
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
