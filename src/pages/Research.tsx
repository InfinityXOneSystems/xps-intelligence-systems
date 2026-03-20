import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ScrapeJob {
  id: string;
  payload: { company_name?: string; url?: string };
  status: "queued" | "running" | "completed" | "failed";
  result?: { leads?: unknown[] };
  created_at: string;
}

const statusIcons: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  completed: { icon: CheckCircle2, cls: "text-green-400" },
  running: { icon: Clock, cls: "text-primary animate-pulse" },
  queued: { icon: AlertCircle, cls: "text-muted-foreground" },
  failed: { icon: AlertCircle, cls: "text-destructive" },
};

const ResearchPage = () => {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const loadJobs = () => {
    api.get<{ jobs: ScrapeJob[] }>("/scrape/jobs")
      .then((data) => setJobs(data.jobs))
      .catch(() => {});
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
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
    </div>
  </AppLayout>
  );
};
export default ResearchPage;
