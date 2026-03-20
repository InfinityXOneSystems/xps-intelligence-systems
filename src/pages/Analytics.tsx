import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarChart3, Users, DollarSign, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "@/lib/api";

interface AnalyticsSummary {
  total_leads: number;
  pipeline_value: number;
  proposals_sent: number;
  close_rate: number;
  monthly_revenue: { month: string; value: number }[];
  pipeline_stages: { name: string; value: number }[];
}

const TERRITORY_COLORS = [
  "hsl(43, 56%, 54%)",
  "hsl(43, 60%, 65%)",
  "hsl(0, 0%, 55%)",
  "hsl(0, 0%, 40%)",
  "hsl(0, 0%, 30%)",
];

const AnalyticsPage = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<AnalyticsSummary>("/analytics/summary")
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, []);

  const outreachMetrics = [
    { label: "Total Leads", value: summary ? summary.total_leads.toLocaleString() : "0", icon: Users },
    { label: "Pipeline Value", value: summary ? `$${(summary.pipeline_value / 1000).toFixed(0)}K` : "$0", icon: DollarSign },
    { label: "Proposals Sent", value: summary ? summary.proposals_sent.toString() : "0", icon: BarChart3 },
    { label: "Close Rate", value: summary ? `${summary.close_rate}%` : "0%", icon: Target },
  ];

  const monthlyRevenue = summary?.monthly_revenue ?? [];
  const pipelineStages = (summary?.pipeline_stages ?? []).map((s, i) => ({
    ...s,
    color: TERRITORY_COLORS[i % TERRITORY_COLORS.length],
  }));

  return (
    <AppLayout title="Analytics">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics Center</h2>
          <p className="text-sm text-muted-foreground">Executive overview of sales performance and pipeline metrics</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {outreachMetrics.map((m) => (
            <div key={m.label} className="bg-gradient-card border border-border rounded-xl p-5">
              <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
              {isLoading ? (
                <div className="h-7 w-20 bg-muted/50 rounded animate-pulse mt-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{m.value}</div>
              )}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Revenue */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Monthly Revenue</h3>
            <p className="text-xs text-muted-foreground mb-4">Revenue from accepted proposals</p>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
              </div>
            ) : monthlyRevenue.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No revenue data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 9%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(43, 56%, 54%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pipeline Stage Distribution */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Pipeline Stage Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">Lead counts by pipeline stage</p>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
              </div>
            ) : pipelineStages.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No pipeline data yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pipelineStages} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pipelineStages.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(0, 0%, 9%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pipelineStages.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="text-foreground font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Empty state for overall */}
        {!isLoading && !summary && (
          <div className="bg-gradient-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
            No data yet. Start by running a scraper or adding leads.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AnalyticsPage;
