import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Building2, MapPin, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  vertical?: string;
  location?: string;
  score?: number;
  stage: string;
  estimated_value?: number;
}

const stageBadge = (stage: string) => {
  const colors: Record<string, string> = {
    Prospecting: "bg-muted text-muted-foreground",
    Qualified: "bg-blue-500/10 text-blue-400",
    Proposal: "bg-primary/10 text-primary",
    Negotiation: "bg-orange-500/10 text-orange-400",
  };
  return colors[stage] || "bg-muted text-muted-foreground";
};

const formatValue = (v?: number) => v ? `$${v.toLocaleString()}` : "—";

const LeadsPage = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<{ leads: Lead[] }>("/leads")
      .then((data) => setLeads(data.leads))
      .catch(() => setLeads([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = leads.filter((l) =>
    !search || l.company_name.toLowerCase().includes(search.toLowerCase()) ||
    l.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.vertical?.toLowerCase().includes(search.toLowerCase())
  );

  return (
  <AppLayout title="Leads">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lead Intelligence</h2>
          <p className="text-sm text-muted-foreground">{isLoading ? "Loading..." : `${filtered.length} leads`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="h-3.5 w-3.5 mr-1.5" />Filter</Button>
          <Button variant="gold" size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Lead</Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search leads by company, contact, or vertical..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="bg-gradient-card border border-border rounded-xl p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-gradient-card border border-border rounded-xl p-10 flex flex-col items-center gap-4 text-center">
          <FlaskConical className="h-10 w-10 text-muted-foreground" />
          <div>
            <div className="text-base font-semibold text-foreground mb-1">No leads found</div>
            <div className="text-sm text-muted-foreground">Use the Scraper to find leads.</div>
          </div>
          <Button variant="gold" size="sm" asChild>
            <Link to="/research">Go to Research</Link>
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-gradient-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Company", "Contact", "Vertical", "Location", "Score", "Stage", "Value"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-foreground">{lead.company_name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{lead.contact_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{lead.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{lead.vertical || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />{lead.location || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-primary">{lead.score ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${stageBadge(lead.stage)}`}>{lead.stage}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatValue(lead.estimated_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </AppLayout>
  );
};

export default LeadsPage;
