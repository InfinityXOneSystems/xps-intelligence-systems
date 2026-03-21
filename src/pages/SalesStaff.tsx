import { useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Zap, Building2, MapPin, Phone, Mail, Globe, Star,
  Loader2, ChevronDown, ChevronUp, Plus, ExternalLink, Users,
  BarChart3, RefreshCw, AlertCircle, CheckCircle2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  business_name: string;
  address: string;
  phone: string;
  website: string;
  owner_name: string;
  email: string;
  est_employees: string;
  est_annual_revenue: string;
  years_in_business: string;
  google_rating: number;
  score: number;
  industry: string;
  city: string;
  state: string;
  notes: string;
  scraped_date: string;
}

interface SearchJob {
  id: string;
  label: string;
  city: string;
  state: string;
  industry: string;
  keyword: string;
  status: "pending" | "running" | "done" | "error";
  results: Lead[];
  error?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CITY_SUGGESTIONS = [
  "Port St. Lucie FL", "Pompano Beach FL", "Tampa FL", "Miami FL",
  "Orlando FL", "Jacksonville FL", "Fort Lauderdale FL", "Boca Raton FL",
  "West Palm Beach FL", "Naples FL", "Sarasota FL", "Clearwater FL",
];

const INDUSTRIES = [
  "Epoxy Flooring", "Polished Concrete", "Decorative Concrete",
  "Concrete Grinding", "Property Management", "Construction",
  "Commercial Flooring", "Industrial Flooring", "Residential Flooring",
  "Warehouse Flooring", "Garage Floor Coating", "Concrete Repair",
  "HVAC Contractor", "Masonry", "Painting Contractor",
];

const KEYWORD_SUGGESTIONS = [
  "epoxy floor", "garage floor coating", "concrete polishing",
  "decorative concrete", "floor coating contractor", "concrete resurfacing",
  "metallic epoxy", "warehouse flooring", "industrial floor coating",
  "commercial epoxy", "polyaspartic coating", "flake epoxy system",
];

const SPECIALTY_OPTIONS = ["Commercial", "Residential", "Industrial", "All"];

/** Delay before hiding autocomplete dropdown on input blur (ms) */
const AUTOCOMPLETE_BLUR_DELAY = 150;

const QUICK_CATEGORIES = [
  { label: "Epoxy Contractors", industry: "Epoxy Flooring", keyword: "epoxy floor contractor" },
  { label: "Concrete Polishing", industry: "Polished Concrete", keyword: "concrete polishing" },
  { label: "Garage Coatings", industry: "Garage Floor Coating", keyword: "garage floor coating" },
  { label: "Warehouse Floors", industry: "Warehouse Flooring", keyword: "warehouse flooring" },
  { label: "Property Mgmt", industry: "Property Management", keyword: "property management" },
  { label: "General Contractors", industry: "Construction", keyword: "general contractor" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseCityState(raw: string): { city: string; state: string } {
  const parts = raw.trim().split(/\s+/);
  const state = parts.length > 1 ? parts[parts.length - 1] : "FL";
  const city = parts.slice(0, parts.length - 1).join(" ");
  return { city, state };
}

function scoreLabel(score: number) {
  if (score >= 80) return { label: "Hot", cls: "bg-red-500/15 text-red-400" };
  if (score >= 60) return { label: "Warm", cls: "bg-orange-500/15 text-orange-400" };
  if (score >= 40) return { label: "Cool", cls: "bg-blue-500/15 text-blue-400" };
  return { label: "Cold", cls: "bg-muted text-muted-foreground" };
}

// ─── SalesStaff Page ────────────────────────────────────────────────────────

const SalesStaff = () => {
  const { toast } = useToast();

  // Search form state
  const [cityInput, setCityInput] = useState("Port St. Lucie FL");
  const [cityFocus, setCityFocus] = useState(false);
  const [industry, setIndustry] = useState("Epoxy Flooring");
  const [keyword, setKeyword] = useState("epoxy floor contractor");
  const [keywordFocus, setKeywordFocus] = useState(false);
  const [specialty, setSpecialty] = useState("All");
  const [maxResults, setMaxResults] = useState(30);

  // Parallel search jobs
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // All results flat
  const allResults = jobs.flatMap((j) => j.results);

  const jobIdRef = useRef(0);

  // Run a single search job — uses real synchronous scraper
  const runJob = useCallback(
    async (job: SearchJob): Promise<Lead[]> => {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "running" } : j))
      );
      try {
        const resp = await api.post<{ leads: Lead[]; results?: Lead[]; source?: string; error?: string }>("/scrape/search-sync", {
          city: job.city,
          state: job.state,
          industry: job.industry,
          keyword: job.keyword,
          max_results: maxResults,
        });
        // search-sync returns { leads: [...] }; fallback to results for backward compat
        const rawLeads = resp.leads ?? resp.results ?? [];
        const results: Lead[] = rawLeads.map((r, i) => ({
          ...r,
          id: r.id || `${job.id}-${i}`,
        }));
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "done", results } : j
          )
        );
        return results;
      } catch (err) {
        const msg = (err as Error).message;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "error", error: msg } : j
          )
        );
        return [];
      }
    },
    [maxResults]
  );

  // Launch single search
  const handleSingleSearch = useCallback(async () => {
    const { city, state } = parseCityState(cityInput);
    jobIdRef.current += 1;
    const id = `job-${jobIdRef.current}`;
    const job: SearchJob = {
      id,
      label: `${city}, ${state} — ${industry}`,
      city,
      state,
      industry,
      keyword,
      status: "pending",
      results: [],
    };
    setJobs((prev) => [job, ...prev]);
    setExpandedJob(id);
    setIsRunning(true);
    await runJob(job);
    setIsRunning(false);
  }, [cityInput, industry, keyword, runJob]);

  // Launch parallel search across quick categories
  const handleParallelSearch = useCallback(async () => {
    const { city, state } = parseCityState(cityInput);
    setIsRunning(true);

    const newJobs: SearchJob[] = QUICK_CATEGORIES.map((cat) => {
      jobIdRef.current += 1;
      return {
        id: `job-${jobIdRef.current}`,
        label: `${city}, ${state} — ${cat.label}`,
        city,
        state,
        industry: cat.industry,
        keyword: cat.keyword,
        status: "pending" as const,
        results: [],
      };
    });

    setJobs((prev) => [...newJobs, ...prev]);
    if (newJobs.length > 0) setExpandedJob(newJobs[0].id);

    // Run all jobs concurrently (asyncio-style parallel)
    await Promise.allSettled(newJobs.map(runJob));
    setIsRunning(false);
    toast({
      title: "Parallel search complete",
      description: `${newJobs.length} searches finished across all categories.`,
    });
  }, [cityInput, runJob, toast]);

  // Quick category click
  const handleCategoryClick = (cat: (typeof QUICK_CATEGORIES)[0]) => {
    setIndustry(cat.industry);
    setKeyword(cat.keyword);
  };

  // Export leads to API
  const handleSaveLeads = useCallback(
    async (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.results.length === 0) return;
      try {
        await api.post("/leads/bulk", { leads: job.results });
        toast({ title: "Leads saved", description: `${job.results.length} leads added to your pipeline.` });
      } catch (err) {
        toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
      }
    },
    [jobs, toast]
  );

  const statusIcon = (status: SearchJob["status"]) => {
    if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    return <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <AppLayout title="Sales Staff">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Sales Staff Scraper</h2>
            <p className="text-sm text-muted-foreground">
              Manual lead generation with parallel search — real data, zero stubs
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">
              {allResults.length} total leads
            </span>
            {allResults.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {jobs.filter((j) => j.status === "done").length}/{jobs.length} done
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Category Cards */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Quick Categories</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => handleCategoryClick(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  industry === cat.industry
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scraper Control Panel */}
        <div className="bg-gradient-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Search Controls</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* City Input with autocomplete */}
            <div className="relative">
              <label className="text-xs text-muted-foreground mb-1 block">City / Region</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Tampa FL"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onFocus={() => setCityFocus(true)}
                  onBlur={() => setTimeout(() => setCityFocus(false), AUTOCOMPLETE_BLUR_DELAY)}
                  list="city-suggestions"
                  className="pl-8 bg-card border-border text-sm"
                  aria-label="City"
                />
                <datalist id="city-suggestions">
                  {CITY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              {cityFocus && cityInput.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {CITY_SUGGESTIONS.filter((c) =>
                    c.toLowerCase().includes(cityInput.toLowerCase())
                  ).slice(0, 6).map((c) => (
                    <li
                      key={c}
                      onMouseDown={() => { setCityInput(c); setCityFocus(false); }}
                      className="px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Industry Select */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Industry"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            {/* Keyword with autocomplete */}
            <div className="relative">
              <label className="text-xs text-muted-foreground mb-1 block">Keyword</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="epoxy floor contractor"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setKeywordFocus(true)}
                  onBlur={() => setTimeout(() => setKeywordFocus(false), AUTOCOMPLETE_BLUR_DELAY)}
                  className="pl-8 bg-card border-border text-sm"
                  aria-label="Keyword"
                />
              </div>
              {keywordFocus && (
                <ul className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {KEYWORD_SUGGESTIONS.filter((k) =>
                    k.toLowerCase().includes(keyword.toLowerCase())
                  ).slice(0, 6).map((k) => (
                    <li
                      key={k}
                      onMouseDown={() => { setKeyword(k); setKeywordFocus(false); }}
                      className="px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer"
                    >
                      {k}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Specialty */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Specialty</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Specialty"
              >
                {SPECIALTY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Max results slider */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Max Results:</label>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="flex-1 max-w-xs accent-primary"
              aria-label="Max results"
            />
            <span className="text-xs font-medium text-foreground w-8 text-right">{maxResults}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap pt-1">
            <Button
              variant="gold"
              onClick={handleSingleSearch}
              disabled={isRunning || !cityInput || !keyword}
              className="gap-2"
              aria-label="Launch single search"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Launch Search
            </Button>
            <Button
              variant="outline"
              onClick={handleParallelSearch}
              disabled={isRunning || !cityInput}
              className="gap-2"
              aria-label="Run parallel search across all categories"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Parallel Search (All Categories)
            </Button>
          </div>
        </div>

        {/* Search Jobs & Results */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Search Results</h3>
              <Badge variant="secondary" className="text-xs">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</Badge>
            </div>

            {jobs.map((job) => (
              <div key={job.id} className="bg-gradient-card border border-border rounded-xl overflow-hidden">
                {/* Job header */}
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  aria-expanded={expandedJob === job.id}
                  aria-label={`Toggle results for ${job.label}`}
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(job.status)}
                    <span className="text-sm font-medium text-foreground">{job.label}</span>
                    {job.status === "done" && (
                      <span className="text-xs text-muted-foreground">
                        {job.results.length} leads found
                      </span>
                    )}
                    {job.status === "error" && (
                      <span className="text-xs text-destructive">{job.error}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === "done" && job.results.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); handleSaveLeads(job.id); }}
                        aria-label={`Save leads from ${job.label}`}
                      >
                        <Plus className="h-3 w-3" /> Save Leads
                      </Button>
                    )}
                    {expandedJob === job.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Results table */}
                {expandedJob === job.id && job.results.length > 0 && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" aria-label={`Results for ${job.label}`}>
                        <thead>
                          <tr className="bg-muted/30">
                            {["Company", "Location", "Contact", "Score", "Rating", "Actions"].map((h) => (
                              <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {job.results.map((lead) => {
                            const { label: slabel, cls } = scoreLabel(lead.score);
                            return (
                              <tr
                                key={lead.id}
                                className="border-t border-border/50 hover:bg-accent/30 transition-colors"
                              >
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                      <Building2 className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-foreground text-xs">{lead.business_name}</div>
                                      <div className="text-[10px] text-muted-foreground">{lead.industry}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {lead.city}, {lead.state}
                                  </div>
                                  {lead.address && (
                                    <div className="text-[10px] text-muted-foreground/70 mt-0.5 max-w-[140px] truncate">
                                      {lead.address}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {lead.phone && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" /> {lead.phone}
                                    </div>
                                  )}
                                  {lead.email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                      <Mail className="h-3 w-3" /> {lead.email}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
                                    {slabel} {lead.score}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {lead.google_rating > 0 ? (
                                    <div className="flex items-center gap-1 text-xs text-yellow-400">
                                      <Star className="h-3 w-3 fill-yellow-400" />
                                      {lead.google_rating.toFixed(1)}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1">
                                    {lead.website && (
                                      <a
                                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                        aria-label={`Open ${lead.business_name} website`}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Empty state for done job */}
                {expandedJob === job.id && job.status === "done" && job.results.length === 0 && (
                  <div className="border-t border-border px-5 py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No results found. Try a different keyword or city.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {jobs.length === 0 && (
          <div className="bg-gradient-card border border-border rounded-xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Search className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground mb-1">Ready to find leads</div>
              <div className="text-sm text-muted-foreground max-w-sm">
                Configure your search above and click <strong>Launch Search</strong> for a targeted search,
                or <strong>Parallel Search</strong> to query all categories at once.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={handleSingleSearch} disabled={isRunning}>
                <Search className="h-3.5 w-3.5 mr-1.5" /> Quick Start
              </Button>
              <Button variant="outline" size="sm" onClick={handleParallelSearch} disabled={isRunning}>
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Parallel All
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SalesStaff;
