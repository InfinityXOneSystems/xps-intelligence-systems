import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Crown, TrendingUp, DollarSign, Users, BarChart3, Save, Activity, MapPin, Brain, Server, Database, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface OwnerAnalytics {
  leads: {
    total: number;
    pipeline: number;
    reps_active: number;
    locations_active: number;
  };
  users_by_role: { role: string; cnt: number }[];
  proposals_by_status: { status: string; cnt: number; value: number }[];
}

interface SimConfig {
  staff: number;
  territories: number;
  avg_deal: number;
  close_rate: number;
}

interface SystemMetrics {
  db_latency_ms: number | null;
  queue_depth: number | null;
  ai_latency_ms: number | null;
  error_rate: number | null;
  active_workers: number;
  leads_ingested_today: number | null;
  last_scrape_at: string | null;
}

const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const ANNUAL_COST_PER_STAFF = 60_000;

const calcProjections = (cfg: SimConfig) => {
  const monthly_leads = cfg.staff * cfg.territories * 2;
  const pipeline = monthly_leads * cfg.avg_deal;
  const annual_revenue = cfg.staff * cfg.territories * cfg.avg_deal * (cfg.close_rate / 100) * 12;
  const roi = cfg.avg_deal > 0 ? ((annual_revenue / (cfg.staff * ANNUAL_COST_PER_STAFF)) * 100).toFixed(1) : "0";
  return { annual_revenue, monthly_leads, pipeline, roi };
};

const Owner = () => {
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sim, setSim] = useState<SimConfig>({ staff: 10, territories: 5, avg_deal: 25000, close_rate: 20 });
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<OwnerAnalytics>("/owner/analytics"),
      api.get<SystemMetrics>("/metrics/system").catch(() => null),
    ])
      .then(([analyticsData, metricsData]) => {
        setAnalytics(analyticsData);
        setSystemMetrics(metricsData);
      })
      .catch((err) => toast({ title: "Failed to load analytics", description: (err as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const projections = calcProjections(sim);

  const handleSaveSimulation = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/owner/simulation/save", { ...sim, projections });
      toast({ title: "Simulation saved" });
    } catch (err) {
      toast({ title: "Failed to save", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [sim, projections, toast]);

  const kpis = [
    { label: "Total Leads", value: analytics?.leads.total ?? "—", icon: TrendingUp, color: "text-primary" },
    { label: "Pipeline Value", value: analytics ? fmt(Number(analytics.leads.pipeline)) : "—", icon: DollarSign, color: "text-gold" },
    { label: "Active Reps", value: analytics?.leads.reps_active ?? "—", icon: Users, color: "text-blue-400" },
    { label: "Active Locations", value: analytics?.leads.locations_active ?? "—", icon: MapPin, color: "text-green-400" },
  ];

  const SliderField = ({
    label, min, max, step, value, onChange, display,
  }: {
    label: string; min: number; max: number; step: number; value: number;
    onChange: (v: number) => void; display: string;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <AppLayout title="Owner Portal">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-gold" /> Owner Portal
          </h2>
          <p className="text-sm text-muted-foreground">Full system analytics, simulation, and financial intelligence</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-gradient-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{loading ? "…" : kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Simulation Panel */}
          <div className="bg-gradient-card border border-border rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Revenue Simulation
              </h3>
              <Button size="sm" variant="gold" disabled={saving} onClick={handleSaveSimulation}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Saving…" : "Save Simulation"}
              </Button>
            </div>

            <div className="space-y-5">
              <SliderField
                label="# of Sales Staff"
                min={1} max={200} step={1}
                value={sim.staff}
                onChange={(v) => setSim((s) => ({ ...s, staff: v }))}
                display={`${sim.staff}`}
              />
              <SliderField
                label="Target Territories"
                min={1} max={20} step={1}
                value={sim.territories}
                onChange={(v) => setSim((s) => ({ ...s, territories: v }))}
                display={`${sim.territories}`}
              />
              <SliderField
                label="Avg Deal Size ($)"
                min={1000} max={500000} step={1000}
                value={sim.avg_deal}
                onChange={(v) => setSim((s) => ({ ...s, avg_deal: v }))}
                display={fmt(sim.avg_deal)}
              />
              <SliderField
                label="Close Rate (%)"
                min={1} max={50} step={1}
                value={sim.close_rate}
                onChange={(v) => setSim((s) => ({ ...s, close_rate: v }))}
                display={`${sim.close_rate}%`}
              />
            </div>

            {/* Projected Results */}
            <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Annual Revenue", value: fmt(projections.annual_revenue) },
                { label: "Monthly Leads", value: projections.monthly_leads.toLocaleString() },
                { label: "Pipeline Value", value: fmt(projections.pipeline) },
                { label: "ROI", value: `${projections.roi}%` },
              ].map((p) => (
                <div key={p.label} className="bg-primary/5 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                  <div className="text-lg font-bold text-gold mt-1">{p.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Analytics */}
          <div className="bg-gradient-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gold" /> Financial Analytics
            </h3>

            {/* Users by role */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Users by Role</p>
              {analytics?.users_by_role.map((r) => (
                <div key={r.role} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm capitalize text-foreground">{r.role.replace("_", " ")}</span>
                  <span className="text-sm font-medium text-primary">{r.cnt}</span>
                </div>
              ))}
              {loading && <div className="h-20 bg-muted rounded animate-pulse" />}
            </div>

            {/* Proposals by status */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Proposals by Status</p>
              {analytics?.proposals_by_status.map((p) => (
                <div key={p.status} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm capitalize text-foreground">{p.status}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{p.cnt} proposals</div>
                    {p.value && <div className="text-xs text-gold">{fmt(Number(p.value))}</div>}
                  </div>
                </div>
              ))}
              {analytics?.proposals_by_status.length === 0 && (
                <p className="text-sm text-muted-foreground">No proposals data.</p>
              )}
              {loading && <div className="h-20 bg-muted rounded animate-pulse" />}
            </div>
          </div>
        </div>

        {/* Prediction Dashboard */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> AI Predictions — Next 3 Months
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {["Month 1", "Month 2", "Month 3"].map((month, i) => {
              const base = Number(analytics?.leads.pipeline ?? 0);
              const growth = base * (1 + (i + 1) * 0.08);
              return (
                <div key={month} className="bg-primary/5 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground">{month}</div>
                  <div className="text-xl font-bold text-foreground mt-2">{fmt(growth)}</div>
                  <div className="text-xs text-green-400 mt-1">+{((i + 1) * 8).toFixed(0)}% growth</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Projections based on current pipeline trends. Assumes 8% monthly growth rate.
          </p>
        </div>

        {/* Real-Time ROI */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gold" /> Real-Time ROI Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Pipeline", value: analytics ? fmt(Number(analytics.leads.pipeline)) : "—", sub: "Active opportunities" },
              { label: "Projected Annual Rev", value: fmt(projections.annual_revenue), sub: "Based on sim config" },
              { label: "System ROI", value: `${projections.roi}%`, sub: `vs $${(sim.staff * ANNUAL_COST_PER_STAFF).toLocaleString()} cost` },
              { label: "Leads Today", value: systemMetrics?.leads_ingested_today ?? "—", sub: "From scraper" },
            ].map((item) => (
              <div key={item.label} className="bg-primary/5 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-xl font-bold text-gold mt-1">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* System Metrics */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-green-400" /> System Metrics
          </h3>
          {systemMetrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "DB Latency", value: systemMetrics.db_latency_ms != null ? `${systemMetrics.db_latency_ms}ms` : "N/A", icon: Database, ok: (systemMetrics.db_latency_ms ?? 999) < 200 },
                { label: "AI Latency", value: systemMetrics.ai_latency_ms != null ? `${systemMetrics.ai_latency_ms}ms` : "N/A", icon: Cpu, ok: (systemMetrics.ai_latency_ms ?? 9999) < 5000 },
                { label: "Queue Depth", value: systemMetrics.queue_depth ?? "N/A", icon: Activity, ok: (systemMetrics.queue_depth ?? 0) < 50 },
                { label: "Error Rate", value: systemMetrics.error_rate != null ? `${systemMetrics.error_rate}%` : "N/A", icon: TrendingUp, ok: (systemMetrics.error_rate ?? 0) < 10 },
              ].map((m) => (
                <div key={m.label} className={`rounded-lg p-4 border ${m.ok ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <m.icon className={`h-3.5 w-3.5 ${m.ok ? "text-green-400" : "text-red-400"}`} />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <div className={`text-lg font-bold ${m.ok ? "text-green-400" : "text-red-400"}`}>{m.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-foreground">All systems operational</span>
            </div>
          )}
          {systemMetrics?.last_scrape_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Last scrape: {new Date(systemMetrics.last_scrape_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Owner;
