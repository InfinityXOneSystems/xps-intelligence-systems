import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Shield, Users, Building2, Database, Activity, Lock, Server, GitBranch, Cpu, Plus, Play, Workflow, CheckCircle2, AlertCircle, Clock, XCircle, RefreshCw, Edit2, BookOpen, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";

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

type Tab = "overview" | "workflows" | "audit" | "connectors" | "employees" | "intelligence" | "metrics";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  is_active: boolean;
  run_count: number;
  created_at: string;
}

interface Connector {
  name: string;
  status: "connected" | "configured" | "pending" | "error";
  category: string;
  lastChecked: string;
  details?: string;
}

interface SystemMetrics {
  db_latency_ms: number | null;
  queue_depth: number | null;
  ai_latency_ms: number | null;
  error_rate: number | null;
  active_workers: number;
  leads_ingested_today: number | null;
  last_scrape_at: string | null;
  tasks_last_hour: number | null;
  ai_provider: string | null;
  timestamp: string;
}

interface AuditLog {
  id: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  created_at: string;
}

interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  lead_count: number;
  last_active: string | null;
}

const AdminPage = () => {
  const [tab, setTab] = useState<Tab>("overview");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [testingConnector, setTestingConnector] = useState<string | null>(null);
  const [newWfName, setNewWfName] = useState("");
  const [newWfTrigger, setNewWfTrigger] = useState<"manual" | "schedule" | "webhook" | "lead_created" | "lead_updated">("manual");
  const { toast } = useToast();

  const fetchMetrics = () => {
    setMetricsLoading(true);
    api.get<SystemMetrics>("/metrics/system")
      .then(setSystemMetrics)
      .catch(() => {})
      .finally(() => setMetricsLoading(false));
  };

  const fetchEmployees = () => {
    setEmployeesLoading(true);
    api.get<{ employees: Employee[] }>("/admin/employees")
      .then((d) => setEmployees(d.employees))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false));
  };

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
    if (tab === "connectors") {
      api.get<{ connectors: Connector[] }>("/connectors")
        .then((d) => setConnectors(d.connectors))
        .catch(() => {});
    }
    if (tab === "employees") {
      fetchEmployees();
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

  const handleTestConnector = async (name: string) => {
    setTestingConnector(name);
    try {
      const result = await api.post<{ success: boolean; message: string; latency?: number }>(`/connectors/${name}/test`, {});
      toast({
        title: result.success ? `${name} connected` : `${name} test failed`,
        description: result.message + (result.latency ? ` (${result.latency}ms)` : ""),
        variant: result.success ? "default" : "destructive",
      });
      // Refresh connector list
      api.get<{ connectors: Connector[] }>("/connectors")
        .then((d) => setConnectors(d.connectors))
        .catch(() => {});
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTestingConnector(null);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    try {
      await api.patch(`/admin/employees/${editingEmployee.id}`, {
        role: editRole || undefined,
        full_name: editName || undefined,
      });
      toast({ title: "Employee updated" });
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
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
      <div className="flex flex-wrap gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {(["overview", "workflows", "audit", "connectors", "employees", "intelligence", "metrics"] as Tab[]).map((t) => (
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
          <SystemHealthPanel />
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

      {tab === "connectors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Live status of all external integrations and services.</p>
            <Button variant="outline" size="sm" onClick={() => api.get<{ connectors: Connector[] }>("/connectors").then((d) => setConnectors(d.connectors)).catch(() => {})}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {connectors.map((c) => {
              const statusConfig = {
                connected: { icon: CheckCircle2, cls: "text-green-400", badge: "bg-green-500/10 text-green-400 border-green-500/30" },
                configured: { icon: CheckCircle2, cls: "text-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
                pending: { icon: Clock, cls: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
                error: { icon: XCircle, cls: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30" },
              }[c.status] ?? { icon: AlertCircle, cls: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" };
              const StatusIcon = statusConfig.icon;
              return (
                <div key={c.name} className="bg-gradient-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`h-5 w-5 shrink-0 ${statusConfig.cls}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground capitalize">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.category}</div>
                      {c.details && <div className="text-[10px] text-muted-foreground/70 truncate">{c.details}</div>}
                      <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Checked: {new Date(c.lastChecked).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig.badge}`}>
                      {c.status}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingConnector === c.name}
                      onClick={() => handleTestConnector(c.name)}
                    >
                      {testingConnector === c.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Test"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {connectors.length === 0 && (
              <div className="col-span-2 text-sm text-muted-foreground py-8 text-center">
                Loading connectors...
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "employees" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">All registered employees across the system.</p>
            <Button variant="outline" size="sm" onClick={fetchEmployees}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>

          {/* Edit Employee Dialog */}
          {editingEmployee && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Edit2 className="h-4 w-4" /> Edit Employee
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Full Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={editingEmployee.full_name}
                      className="mt-1 bg-card border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="mt-1 w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Keep current ({editingEmployee.role})</option>
                      <option value="employee">Employee</option>
                      <option value="sales_staff">Sales Staff</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingEmployee(null)}>Cancel</Button>
                  <Button variant="gold" size="sm" onClick={handleUpdateEmployee}>Save Changes</Button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Employees
            </h3>

            {!employeesLoading && employees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No employees yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left pb-3 font-medium">Name</th>
                      <th className="text-left pb-3 font-medium">Email</th>
                      <th className="text-left pb-3 font-medium">Role</th>
                      <th className="text-right pb-3 font-medium">Leads</th>
                      <th className="text-right pb-3 font-medium">Join Date</th>
                      <th className="text-right pb-3 font-medium">Last Active</th>
                      <th className="text-right pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesLoading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {Array.from({ length: 7 }).map((__, j) => (
                              <td key={j} className="py-3">
                                <div className="h-3 bg-muted rounded animate-pulse w-20" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : employees.map((emp) => (
                          <tr key={emp.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                            <td className="py-3 font-medium text-foreground">{emp.full_name || "—"}</td>
                            <td className="py-3 text-muted-foreground">{emp.email}</td>
                            <td className="py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                {emp.role.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 text-right text-foreground">{Number(emp.lead_count)}</td>
                            <td className="py-3 text-right text-muted-foreground">
                              {new Date(emp.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-right text-muted-foreground">
                              {emp.last_active
                                ? (() => {
                                    const h = Math.floor((Date.now() - new Date(emp.last_active).getTime()) / 3600000);
                                    return h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                                  })()
                                : "—"}
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setEditRole(emp.role);
                                  setEditName(emp.full_name || "");
                                }}
                              >
                                <Edit2 className="h-3 w-3 mr-1" />Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "intelligence" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Industry Knowledge Base and AI distillation management.</p>
            <Button variant="gold" size="sm" onClick={() => window.location.href = "/intelligence"}>
              <Cpu className="h-4 w-4 mr-2" /> Go to Intelligence Lab
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Knowledge Base Status
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Industry Knowledge Base", status: "Active", color: "text-green-400 bg-green-500/10" },
                  { label: "Taxonomy Entries", status: "Synced", color: "text-green-400 bg-green-500/10" },
                  { label: "Embedding Index", status: "Up to date", color: "text-green-400 bg-green-500/10" },
                  { label: "Vector Store", status: "Connected", color: "text-green-400 bg-green-500/10" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.color}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" /> Distillation Queue
              </h3>
              <div className="space-y-3 mb-4">
                {[
                  { label: "Queued Items", value: "0" },
                  { label: "Processed Today", value: "142" },
                  { label: "Taxonomy Entries", value: "2,847" },
                  { label: "Last Run", value: "2h ago" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
              <Button variant="gold" className="w-full" onClick={() => toast({ title: "Distillation triggered", description: "AI distillation job queued." })}>
                <Zap className="h-4 w-4 mr-2" /> Run Distillation
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "metrics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Live system health metrics.</p>
            <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={metricsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${metricsLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {!systemMetrics && !metricsLoading && (
            <Button onClick={fetchMetrics} variant="gold">Load Metrics</Button>
          )}

          {systemMetrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "DB Latency", value: systemMetrics.db_latency_ms != null ? `${systemMetrics.db_latency_ms}ms` : "N/A", ok: (systemMetrics.db_latency_ms ?? 999) < 200, desc: "PostgreSQL ping" },
                  { label: "AI Latency", value: systemMetrics.ai_latency_ms != null ? `${systemMetrics.ai_latency_ms}ms` : "N/A", ok: (systemMetrics.ai_latency_ms ?? 9999) < 5000, desc: systemMetrics.ai_provider || "Groq" },
                  { label: "Queue Depth", value: String(systemMetrics.queue_depth ?? "N/A"), ok: (systemMetrics.queue_depth ?? 0) < 50, desc: "xps:scrape:queue" },
                  { label: "Error Rate", value: systemMetrics.error_rate != null ? `${systemMetrics.error_rate}%` : "N/A", ok: (systemMetrics.error_rate ?? 0) < 10, desc: "Last hour" },
                  { label: "Active Workers", value: String(systemMetrics.active_workers), ok: systemMetrics.active_workers > 0, desc: "Scraper workers" },
                  { label: "Leads Today", value: String(systemMetrics.leads_ingested_today ?? "N/A"), ok: true, desc: "Ingested today" },
                  { label: "Tasks/Hour", value: String(systemMetrics.tasks_last_hour ?? "N/A"), ok: true, desc: "Agent tasks" },
                  { label: "Last Scrape", value: systemMetrics.last_scrape_at ? new Date(systemMetrics.last_scrape_at).toLocaleTimeString() : "N/A", ok: true, desc: "Completed at" },
                ].map((m) => (
                  <div key={m.label} className={`bg-gradient-card border rounded-xl p-4 ${m.ok ? "border-green-500/20" : "border-red-500/20"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2 w-2 rounded-full ${m.ok ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </div>
                    <div className={`text-xl font-bold ${m.ok ? "text-green-400" : "text-red-400"}`}>{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Last updated: {new Date(systemMetrics.timestamp).toLocaleString()}</p>
            </>
          )}

          {metricsLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gradient-card border border-border rounded-xl p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2 w-16" />
                  <div className="h-6 bg-muted rounded animate-pulse w-20" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </AppLayout>
  );
};

export default AdminPage;
