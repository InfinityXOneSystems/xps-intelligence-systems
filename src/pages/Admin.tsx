import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Shield, Users, Building2, Database, Activity, Settings, Lock, Server, GitBranch, Cpu, Plus, Play, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const systemCards = [
  { title: "Users & Roles", desc: "Manage 247 users across 4 role types", icon: Users, stat: "247 active" },
  { title: "Locations", desc: "60+ XPS franchise locations configured", icon: Building2, stat: "63 locations" },
  { title: "Database", desc: "PostgreSQL cluster health and metrics", icon: Database, stat: "99.9% uptime" },
  { title: "Security", desc: "RBAC policies, audit trails, and compliance", icon: Lock, stat: "All clear" },
  { title: "AI Factory", desc: "xps-ai-factory model status and endpoints", icon: Cpu, stat: "3 models" },
  { title: "Deployments", desc: "Railway + GitHub deployment pipeline", icon: Server, stat: "v2.4.1" },
  { title: "Repositories", desc: "GitHub sync for xps-scraper, open-agent-builder", icon: GitBranch, stat: "4 repos" },
  { title: "Activity Log", desc: "System-wide audit and event logging", icon: Activity, stat: "12.4K events" },
];

type Tab = "overview" | "workflows" | "audit";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  is_active: boolean;
  run_count: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  created_at: string;
}

const AdminPage = () => {
  const [tab, setTab] = useState<Tab>("overview");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newWfName, setNewWfName] = useState("");
  const [newWfTrigger, setNewWfTrigger] = useState<"manual" | "schedule" | "webhook" | "lead_created" | "lead_updated">("manual");
  const { toast } = useToast();

  useEffect(() => {
    if (tab === "workflows") {
      api.get<{ workflows: Workflow[] }>("/agents/workflows")
        .then((d) => setWorkflows(d.workflows))
        .catch(() => {});
    }
    if (tab === "audit") {
      api.get<{ logs: AuditLog[] }>("/audit")
        .then((d) => setAuditLogs(d.logs))
        .catch(() => {});
    }
  }, [tab]);

  const handleCreateWorkflow = async () => {
    if (!newWfName) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      await api.post("/agents/workflows", {
        name: newWfName,
        trigger: newWfTrigger,
        steps: [],
        is_active: true,
      });
      setNewWfName("");
      toast({ title: "Workflow created" });
      api.get<{ workflows: Workflow[] }>("/agents/workflows").then((d) => setWorkflows(d.workflows)).catch(() => {});
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleExecuteWorkflow = async (id: string) => {
    try {
      await api.post(`/agents/workflows/${id}/execute`, {});
      toast({ title: "Workflow started" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
  <AppLayout title="Admin">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Control Plane</h2>
        <p className="text-sm text-muted-foreground">System administration, security, and infrastructure management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {(["overview", "workflows", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-xs font-medium capitalize transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "workflows" ? "Agent Builder" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemCards.map((card) => (
              <div key={card.title} className="bg-gradient-card border border-border rounded-xl p-5 hover:border-gold transition-all duration-300 cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs text-primary font-medium">{card.stat}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "workflows" && (
        <div className="space-y-4">
          {/* Create Workflow */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Workflow className="h-4 w-4" /> New Agent Workflow
            </h3>
            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Workflow name" value={newWfName} onChange={(e) => setNewWfName(e.target.value)} className="bg-card border-border max-w-xs" />
              <select
                value={newWfTrigger}
                onChange={(e) => setNewWfTrigger(e.target.value as typeof newWfTrigger)}
                className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground"
              >
                <option value="manual">Manual</option>
                <option value="schedule">Schedule</option>
                <option value="webhook">Webhook</option>
                <option value="lead_created">Lead Created</option>
                <option value="lead_updated">Lead Updated</option>
              </select>
              <Button variant="gold" onClick={handleCreateWorkflow}><Plus className="h-4 w-4 mr-1.5" />Create</Button>
            </div>
          </div>

          {/* Workflow list */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Workflows</h3>
            {workflows.length === 0 && <p className="text-sm text-muted-foreground">No workflows yet.</p>}
            <div className="space-y-3">
              {workflows.map((wf) => (
                <div key={wf.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium text-foreground">{wf.name}</div>
                    <div className="text-xs text-muted-foreground">Trigger: {wf.trigger} · Runs: {wf.run_count}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${wf.is_active ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {wf.is_active ? "Active" : "Inactive"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => handleExecuteWorkflow(wf.id)}>
                      <Play className="h-3 w-3 mr-1" />Run
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Audit Log</h3>
          {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">No audit entries.</p>}
          <div className="space-y-3">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{entry.user_email || "System"}</span>
                  <span className="text-sm text-foreground">{entry.action}</span>
                  {entry.resource_type && <span className="text-xs text-muted-foreground">({entry.resource_type})</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">{new Date(entry.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </AppLayout>
  );
};

export default AdminPage;
