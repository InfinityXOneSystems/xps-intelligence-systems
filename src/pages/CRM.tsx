import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Building2, Star, MapPin } from "lucide-react";
import { api } from "@/lib/api";

interface Lead {
  id: string;
  stage: string;
  estimated_value?: number;
}

const PIPELINE_STAGES = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Closed Won"];

const CRMPage = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<{ leads: Lead[] }>("/leads")
      .then((data) => setLeads(data.leads))
      .catch(() => setLeads([]))
      .finally(() => setIsLoading(false));
  }, []);

  const totalPipeline = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const activeDeals = leads.filter((l) => !["Closed Won", "Closed Lost"].includes(l.stage)).length;

  const stageCount = (stage: string) => leads.filter((l) => l.stage === stage).length;
  const stageValue = (stage: string) => {
    const total = leads.filter((l) => l.stage === stage).reduce((s, l) => s + (l.estimated_value || 0), 0);
    return total >= 1000000 ? `$${(total / 1000000).toFixed(1)}M` : total >= 1000 ? `$${(total / 1000).toFixed(0)}K` : `$${total}`;
  };

  const metrics = [
    { label: "Total Contacts", value: isLoading ? "—" : leads.length.toLocaleString(), icon: Users },
    { label: "Companies", value: isLoading ? "—" : new Set(leads.map((l) => l.id)).size.toLocaleString(), icon: Building2 },
    { label: "Active Deals", value: isLoading ? "—" : activeDeals.toLocaleString(), icon: Star },
    { label: "Pipeline Value", value: isLoading ? "—" : totalPipeline >= 1000000 ? `$${(totalPipeline / 1000000).toFixed(1)}M` : `$${(totalPipeline / 1000).toFixed(0)}K`, icon: MapPin },
  ];

  return (
    <AppLayout title="CRM">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">CRM Dashboard</h2>
          <p className="text-sm text-muted-foreground">Customer relationship management and pipeline overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-gradient-card border border-border rounded-xl p-5">
              <m.icon className="h-4 w-4 text-primary mb-2" />
              {isLoading ? (
                <div className="h-7 w-16 bg-muted/50 rounded animate-pulse mb-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{m.value}</div>
              )}
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline Stages</h3>
          {isLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="min-w-[150px] h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage} className="min-w-[150px] bg-accent/50 border border-border rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{stage}</div>
                  <div className="text-lg font-bold text-foreground">{stageCount(stage)}</div>
                  <div className="text-xs text-primary">{stageValue(stage)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CRMPage;
