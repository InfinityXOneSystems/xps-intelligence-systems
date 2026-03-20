import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, FileText, Target, ArrowUpRight,
  BarChart3, DollarSign, Phone, Mail, Calendar, Brain
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface AnalyticsSummary {
  total_leads: number;
  pipeline_value: number;
  proposals_sent: number;
  close_rate: number;
  monthly_revenue: { month: string; value: number }[];
  pipeline_stages: { name: string; value: number }[];
  recent_leads: { company_name: string; vertical: string; score: number; stage: string; estimated_value: number }[];
  recent_activities: { type: string; subject: string; created_at: string }[];
}

const STAGE_COLORS = [
  "hsl(43, 56%, 54%)",
  "hsl(43, 60%, 65%)",
  "hsl(0, 0%, 55%)",
  "hsl(0, 0%, 40%)",
  "hsl(142, 50%, 45%)",
];

const activityIcon = (type: string) => {
  switch (type) {
    case "call": return Phone;
    case "email": return Mail;
    case "proposal": return FileText;
    case "meeting": return Calendar;
    default: return Brain;
  }
};

const formatRelative = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return "Yesterday";
};

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<AnalyticsSummary>("/analytics/summary")
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, []);

  const kpis = [
    { label: "Active Leads", value: summary ? summary.total_leads.toLocaleString() : "0", icon: Users },
    { label: "Pipeline Value", value: summary ? `$${(summary.pipeline_value / 1000).toFixed(0)}K` : "$0", icon: DollarSign },
    { label: "Proposals Sent", value: summary ? summary.proposals_sent.toString() : "0", icon: FileText },
    { label: "Close Rate", value: summary ? `${summary.close_rate}%` : "0%", icon: Target },
  ];

  const revenueData = summary?.monthly_revenue ?? [];
  const pipelineData = (summary?.pipeline_stages ?? []).map((s, i) => ({
    ...s,
    color: STAGE_COLORS[i % STAGE_COLORS.length],
  }));
  const recentLeads = summary?.recent_leads ?? [];
  const activities = summary?.recent_activities ?? [];

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greeting = user?.email ? `${timeGreeting}, ${user.full_name || user.email.split("@")[0]}` : timeGreeting;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{greeting}</h2>
          <p className="text-sm text-muted-foreground">Here's your sales intelligence briefing for today.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-gradient-card border border-border rounded-xl p-5 hover:border-gold transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <kpi.icon className="h-4 w-4 text-primary" />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {isLoading ? (
                <div className="h-7 w-20 bg-muted/50 rounded animate-pulse mb-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-gradient-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Revenue Pipeline</h3>
                <p className="text-xs text-muted-foreground">Monthly pipeline value trend</p>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="h-60 flex items-center justify-center">
                <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
              </div>
            ) : revenueData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                No revenue data yet. Start by running a scraper or adding leads.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(43, 56%, 54%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(43, 56%, 54%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 9%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(43, 56%, 54%)" fill="url(#goldGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pipeline Pie */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Pipeline Stages</h3>
            <p className="text-xs text-muted-foreground mb-4">Lead distribution by stage</p>
            {isLoading ? (
              <div className="h-44 flex items-center justify-center">
                <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
              </div>
            ) : pipelineData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground text-center">
                No stage data yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pipelineData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recent Leads */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Top Leads</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />)}
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No leads yet. Start by running a scraper or adding leads.
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.company_name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{lead.company_name}</div>
                      <div className="text-xs text-muted-foreground">{lead.vertical} · {lead.stage}</div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold text-foreground">{lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : "—"}</div>
                      <div className="text-xs text-primary">Score: {lead.score ?? "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />)}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No activity yet. Start by running a scraper or adding leads.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((a, i) => {
                  const Icon = activityIcon(a.type);
                  return (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-foreground">{a.subject}</div>
                        <div className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
