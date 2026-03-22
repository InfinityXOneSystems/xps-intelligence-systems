import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, TrendingUp, DollarSign, Target, Clock, Activity, AlertTriangle, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  lead_count: number;
  pipeline_value: number;
  last_active: string | null;
}

interface TeamStats {
  total_leads: number;
  pipeline_value: number;
  active_reps: number;
}

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

const fmt = (n: number | string | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const stageColors: Record<string, string> = {
  "Prospecting": "bg-blue-500",
  "Qualified": "bg-yellow-500",
  "Proposal": "bg-orange-500",
  "Negotiation": "bg-purple-500",
  "Closed Won": "bg-green-500",
  "Closed Lost": "bg-red-500",
};

const Manager = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [staleLeads, setStaleLeads] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<{ team: TeamMember[] }>("/manager/team"),
      api.get<{ stats: TeamStats }>("/manager/stats"),
      api.get<{ pipeline: PipelineStage[] }>("/analytics/pipeline").catch(() => ({ pipeline: [] as PipelineStage[] })),
      api.get<{ count: number }>("/leads?stale=true&limit=1").catch(() => ({ count: 0 })),
    ])
      .then(([teamData, statsData, pipelineData, staleData]) => {
        setTeam(teamData.team);
        setStats(statsData.stats);
        setPipeline((pipelineData as { pipeline: PipelineStage[] }).pipeline || []);
        setStaleLeads((staleData as { count?: number }).count || 0);
      })
      .catch((err) => toast({ title: "Failed to load team data", description: (err as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const totalLeads = pipeline.reduce((s, p) => s + p.count, 0);
  const closedWon = pipeline.find((p) => p.stage === "Closed Won");
  const totalClosed = pipeline.filter((p) => p.stage.startsWith("Closed")).reduce((s, p) => s + p.count, 0);
  const conversionRate = totalClosed > 0 && closedWon
    ? Math.round((closedWon.count / totalClosed) * 100)
    : 0;

  const kpis = [
    { label: "Total Team Leads", value: stats?.total_leads ?? "—", icon: Target, color: "text-primary" },
    { label: "Team Pipeline Value", value: fmt(stats?.pipeline_value ?? null), icon: DollarSign, color: "text-gold" },
    { label: "Active Team Members", value: stats?.active_reps ?? "—", icon: Users, color: "text-blue-400" },
    { label: "Close Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "text-green-400" },
  ];

  return (
    <AppLayout title="Manager Dashboard">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Manager Dashboard</h2>
            <p className="text-sm text-muted-foreground">Team performance and employee results</p>
          </div>
          {staleLeads > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
              <span className="text-xs text-yellow-400 font-medium">{staleLeads} stale leads (5+ days no activity)</span>
            </div>
          )}
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

        {/* Pipeline Health */}
        {pipeline.length > 0 && (
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Pipeline Health
            </h3>
            <div className="space-y-3">
              {pipeline.map((stage) => {
                const pct = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
                const barColor = stageColors[stage.stage] || "bg-primary";
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground shrink-0 truncate">{stage.stage}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-16 text-right text-xs text-foreground shrink-0">{stage.count} ({pct}%)</div>
                    {stage.value > 0 && (
                      <div className="w-20 text-right text-xs text-gold shrink-0">{fmt(stage.value)}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Conversion rate (Won / Closed):</span>
              <span className="text-xs font-semibold text-green-400">{conversionRate}%</span>
            </div>
          </div>
        )}

        {/* Employee Performance Table */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" /> Employee Performance
          </h3>

          {!loading && team.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No team members yet. Add employees in Admin.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-3 font-medium">Name</th>
                    <th className="text-left pb-3 font-medium">Role</th>
                    <th className="text-right pb-3 font-medium">Leads</th>
                    <th className="text-right pb-3 font-medium">Pipeline Value</th>
                    <th className="text-right pb-3 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Array.from({ length: 5 }).map((__, j) => (
                            <td key={j} className="py-3">
                              <div className="h-3 bg-muted rounded animate-pulse w-20" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : team.map((member) => {
                        const isStale = member.last_active
                          ? (Date.now() - new Date(member.last_active).getTime()) > 5 * 24 * 3600 * 1000
                          : false;
                        return (
                          <tr key={member.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                            <td className="py-3">
                              <div className="font-medium text-foreground flex items-center gap-2">
                                {member.full_name || member.email}
                                {isStale && (
                                  <AlertTriangle className="h-3 w-3 text-yellow-400" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </td>
                            <td className="py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                {member.role.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 text-right text-foreground">{Number(member.lead_count)}</td>
                            <td className="py-3 text-right text-gold font-medium">{fmt(member.pipeline_value)}</td>
                            <td className={`py-3 text-right ${isStale ? "text-yellow-400" : "text-muted-foreground"}`}>
                              <span className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtDate(member.last_active)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Team Activity Feed */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Team Activity Feed
          </h3>
          {team.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {team.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(member.full_name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-foreground">{member.full_name || member.email}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(member.lead_count)} leads · {fmt(member.pipeline_value)} pipeline
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Manager;
