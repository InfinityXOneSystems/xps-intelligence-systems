import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, Clock, CheckCircle2, AlertCircle, Search, List } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ScrapeJob {
  id: string;
  payload: { company_name?: string; url?: string };
  status: "queued" | "running" | "completed" | "failed";
  result?: { leads?: unknown[] };
  created_at: string;
}

interface SeedResult {
  company_name: string;
  location: string;
  vertical: string;
  website?: string;
  score: number;
}

const statusIcons: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  completed: { icon: CheckCircle2, cls: "text-green-400" },
  running: { icon: Clock, cls: "text-primary animate-pulse" },
  queued: { icon: AlertCircle, cls: "text-muted-foreground" },
  failed: { icon: AlertCircle, cls: "text-destructive" },
};

const CITIES = [
  "Port St. Lucie, FL",
  "Pompano Beach, FL",
];

const CATEGORIES = [
  "epoxy contractors",
  "property management companies",
  "concrete companies",
  "decorative concrete companies",
  "new registered businesses FL",
];

type ResearchTab = "company" | "seed-list";

const ResearchPage = () => {
  const [activeTab, setActiveTab] = useState<ResearchTab>("company");

  // Company Research state
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed List state
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [seedResults, setSeedResults] = useState<SeedResult[]>([]);
  const [isSeedSubmitting, setIsSeedSubmitting] = useState(false);

  const { toast } = useToast();

  const loadJobs = () => {
    api.get<{ jobs: ScrapeJob[] }>("/scrape/jobs")
      .then((data) => setJobs(data.jobs))
      .catch(() => {});
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(() => {
      // Read current jobs directly from state ref to avoid side effects inside setter
      loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartResearch = async () => {
    if (!companyName && !websiteUrl) {
      toast({ title: "Input required", description: "Enter a company name or website URL.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post<{ taskId: string }>("/scrape/start", {
        company_name: companyName || undefined,
        url: websiteUrl || undefined,
        mode: "auto",
      });
      toast({ title: "Research started", description: "Job queued successfully." });
      setCompanyName("");
      setWebsiteUrl("");
      loadJobs();
    } catch (err) {
      toast({ title: "Failed to start research", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSeedList = async () => {
    if (selectedCategories.length === 0) {
      toast({ title: "Select at least one category", variant: "destructive" });
      return;
    }
    setIsSeedSubmitting(true);
    setSeedResults([]);
    try {
      const data = await api.post<{ results: SeedResult[]; count: number }>("/scrape/seed-list", {
        city: selectedCity,
        categories: selectedCategories,
      });
      setSeedResults(data.results);
      toast({ title: `Found ${data.count} companies`, description: `in ${selectedCity}` });
    } catch (err) {
      toast({ title: "Seed list failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSeedSubmitting(false);
    }
  };

  const getLeadCount = (job: ScrapeJob) => job.result?.leads?.length ?? 0;
  const getTimeLabel = (job: ScrapeJob) => {
    if (job.status === "running") return "Running...";
    if (job.status === "queued") return "Queued";
    return new Date(job.created_at).toLocaleTimeString();
  };

  return (
  <AppLayout title="Research Lab">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Research Lab</h2>
          <p className="text-sm text-muted-foreground">Manual web research and company intelligence discovery</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === "company" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Search className="h-3.5 w-3.5" /> Company Research
        </button>
        <button
          onClick={() => setActiveTab("seed-list")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === "seed-list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <List className="h-3.5 w-3.5" /> Seed List Scraper
        </button>
      </div>

      {activeTab === "company" && (
        <>
          {/* New Research */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">New Research Job</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-card border-border" />
              <Input placeholder="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="bg-card border-border" />
              <Input placeholder="Geography (city, state)" className="bg-card border-border" />
              <Button variant="gold" onClick={handleStartResearch} disabled={isSubmitting}>
                <FlaskConical className="h-4 w-4 mr-1.5" />{isSubmitting ? "Starting..." : "Start Research"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">Research uses publicly available web data only. All results are from public sources.</p>
          </div>

          {/* Jobs */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Research Jobs</h3>
            <div className="space-y-3">
              {jobs.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No research jobs yet. Start one above.</p>
              )}
              {jobs.map((job) => {
                const st = statusIcons[job.status] || statusIcons.queued;
                return (
                  <div key={job.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <st.icon className={`h-4 w-4 ${st.cls}`} />
                      <div>
                        <div className="text-sm font-medium text-foreground">{job.payload?.company_name || job.payload?.url || job.id}</div>
                        <div className="text-xs text-muted-foreground">{job.payload?.url || ""}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-foreground">{getLeadCount(job)} leads</div>
                      <div className="text-xs text-muted-foreground">{getTimeLabel(job)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === "seed-list" && (
        <div className="space-y-5">
          {/* Seed List Form */}
          <div className="bg-gradient-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Seed List Scraper</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">City / Region</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground w-full max-w-xs"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Categories (select one or more)</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedCategories.includes(cat)
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-card border-border text-muted-foreground hover:border-gold hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="gold" onClick={handleSeedList} disabled={isSeedSubmitting}>
                <FlaskConical className="h-4 w-4 mr-1.5" />
                {isSeedSubmitting ? "Searching..." : "Find Companies"}
              </Button>
            </div>
          </div>

          {/* Seed Results Table */}
          {(seedResults.length > 0 || isSeedSubmitting) && (
            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Results {seedResults.length > 0 && <span className="text-muted-foreground font-normal">({seedResults.length} companies)</span>}
              </h3>
              {isSeedSubmitting ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Searching...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4">Company</th>
                        <th className="text-left py-2 pr-4">Category</th>
                        <th className="text-left py-2 pr-4">Location</th>
                        <th className="text-right py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seedResults.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium text-foreground">{r.company_name}</div>
                            {r.website && <div className="text-[10px] text-muted-foreground">{r.website}</div>}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{r.vertical}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{r.location}</td>
                          <td className="py-2.5 text-right">
                            <span className={`font-semibold ${r.score >= 85 ? "text-green-400" : r.score >= 70 ? "text-primary" : "text-muted-foreground"}`}>
                              {r.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </AppLayout>
  );
};
export default ResearchPage;
