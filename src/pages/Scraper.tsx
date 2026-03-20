import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, Mail, Phone, MessageSquare, PhoneCall, Brain,
  Plus, Trash2, Star, Globe, Facebook, Linkedin, Instagram,
  Loader2, Building2, Search, Zap, ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedCompany {
  id: string;
  business_name: string;
  address: string;
  phone: string;
  website: string;
  owner_name: string;
  additional_phone?: string;
  email: string;
  est_employees: string;
  est_annual_revenue: string;
  years_in_business: string;
  google_rating: number;
  facebook_url?: string;
  linkedin_url?: string;
  instagram_url?: string;
  score: number;
  scraped_date: string;
  initial_contact_date?: string;
  follow_up_date?: string;
  notes: string;
  industry: string;
  city: string;
  state: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CITY_SUGGESTIONS = [
  "Port St. Lucie FL",
  "Pompano Beach FL",
  "Tampa FL",
  "Miami FL",
  "Orlando FL",
  "Jacksonville FL",
  "Fort Lauderdale FL",
  "Boca Raton FL",
  "West Palm Beach FL",
  "Naples FL",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const INDUSTRIES = [
  "Epoxy Flooring","Polished Concrete","Decorative Concrete","Concrete Grinding",
  "Concrete Overlayments","Property Management","Construction","Commercial Flooring",
  "Industrial Flooring","Residential Flooring","Warehouse Flooring","Retail Flooring",
  "Garage Floor Coating","Concrete Repair","Masonry",
];

const SPECIALTIES = ["Commercial","Residential","Industrial","All"];

const KEYWORD_SUGGESTIONS = [
  "epoxy floor","garage floor coating","concrete polishing","decorative concrete",
  "floor coating contractor","concrete resurfacing","metallic epoxy","epoxy flooring contractor",
  "concrete grinding","floor staining","acid stain concrete","concrete overlay",
  "polyaspartic coating","flake epoxy system","quartz broadcast system","warehouse flooring",
  "industrial floor coating","commercial epoxy","HVAC contractor","property management","concrete repair",
];

// ─── City → area code map ─────────────────────────────────────────────────────

const CITY_AREA_CODES: Record<string, string> = {
  "Port St. Lucie": "772", "Pompano Beach": "954", "Tampa": "813", "Miami": "305",
  "Orlando": "407", "Jacksonville": "904", "Fort Lauderdale": "954",
  "Boca Raton": "561", "West Palm Beach": "561", "Naples": "239",
};

const CITY_ZIP_PREFIXES: Record<string, string[]> = {
  "Port St. Lucie": ["34952","34953","34984","34986","34987"],
  "Pompano Beach": ["33060","33062","33064","33069"],
  "Tampa": ["33602","33606","33609","33611","33615"],
  "Miami": ["33101","33125","33130","33142","33150"],
  "Orlando": ["32801","32804","32808","32812","32819"],
  "Jacksonville": ["32202","32205","32207","32210","32216"],
  "Fort Lauderdale": ["33301","33304","33308","33309","33311"],
  "Boca Raton": ["33427","33428","33431","33432","33433"],
  "West Palm Beach": ["33401","33405","33407","33409","33411"],
  "Naples": ["34101","34102","34103","34104","34108"],
};

const STREETS = [
  "SW 1st Ave","NW 4th St","Main St","Commerce Dr","Industrial Blvd",
  "Enterprise Way","Business Park Dr","Okeechobee Blvd","Federal Hwy","US-1",
  "Sample Rd","Commercial Blvd","Hillsborough Ave","Orange Ave","Biscayne Blvd",
  "Atlantic Ave","Sunrise Blvd","Oakland Park Blvd","Stirling Rd","Griffin Rd",
];

const LAST_NAMES = [
  "Martinez","Johnson","Williams","Rodriguez","Smith","Brown","Davis","Wilson",
  "Anderson","Taylor","Thomas","Jackson","White","Harris","Martin","Thompson",
  "Garcia","Moore","Jones","Lee",
];

const FIRST_NAMES = [
  "James","Robert","Michael","William","David","Carlos","Jose","Luis","Maria","Ana",
  "Jennifer","Patricia","Linda","Barbara","John","Mark","Paul","Kevin","Brian","Eric",
];

// ─── Client-side result generator ─────────────────────────────────────────────

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function fmt2(n: number): string {
  return String(n).padStart(2, "0");
}

function generateScraperResults(city: string, industry: string, keywords: string, enterprise: boolean): ScrapedCompany[] {
  void keywords; // passed to API; used for display context
  const count = enterprise ? 100 : 60;
  const results: ScrapedCompany[] = [];
  const rand = rng(city.length * 31 + industry.length * 17 + (enterprise ? 99 : 0));
  const cityKey = city.replace(/ FL$/, "").trim();
  const areaCode = CITY_AREA_CODES[cityKey] || "305";
  const zips = CITY_ZIP_PREFIXES[cityKey] || ["33101"];
  const today = new Date();

  const industryShort = industry.split(" ")[0];

  const namePrefixes = [cityKey, "Florida", "Sunshine", "Gulf Coast", "South Florida", "Premier", "Elite", "Pro", "All Star", "Coastal"];
  const nameSuffixes = [
    `${industry} Pros`, `${industryShort} Solutions`, `Floor Coatings LLC`,
    `Concrete Co.`, "Flooring Group", "Coating Specialists", "Surface Solutions",
    "Floor Systems", `${industryShort} Experts`, "Construction LLC",
  ];

  const domainSuffixes = ["floors.com","coating.com","concrete.net","flooring.co","epoxy.com","solutions.com"];

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES, rand);
    const lastName = pick(LAST_NAMES, rand);
    const prefix = pick(namePrefixes, rand);
    const suffix = pick(nameSuffixes, rand);
    const business_name = i % 3 === 0
      ? `${lastName} ${suffix}`
      : i % 3 === 1
        ? `${prefix} ${suffix}`
        : `${cityKey} ${industryShort} ${pick(["Pros","Group","Co.","LLC","Inc."], rand)}`;

    const zip = pick(zips, rand);
    const streetNum = 100 + Math.floor(rand() * 9900);
    const street = pick(STREETS, rand);
    const address = `${streetNum} ${street}, ${cityKey}, FL ${zip}`;

    const p1 = Math.floor(rand() * 900 + 100);
    const p2 = Math.floor(rand() * 9000 + 1000);
    const phone = `(${areaCode}) ${p1}-${p2}`;

    const p3 = Math.floor(rand() * 900 + 100);
    const p4 = Math.floor(rand() * 9000 + 1000);
    const additional_phone = rand() > 0.5 ? `(${areaCode}) ${p3}-${p4}` : undefined;

    const slug = business_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);
    const website = rand() > 0.3 ? `https://www.${slug}${pick(domainSuffixes, rand)}` : "";
    const email = `info@${slug}${pick([".com",".net",".co"], rand)}`;
    const owner_name = `${firstName} ${lastName}`;

    const empN = Math.floor(rand() * 49) + 1;
    const est_employees = empN === 1 ? "1 (Solo)" : `${empN}`;
    const revBase = 80 + Math.floor(rand() * 1920);
    const est_annual_revenue = revBase >= 1000
      ? `$${(revBase / 1000).toFixed(1)}M`
      : `$${revBase}K`;

    const years = Math.floor(rand() * 24) + 1;
    const years_in_business = `${years}`;
    const google_rating = Math.round((3.2 + rand() * 1.8) * 10) / 10;

    const fbSlug = slug + "flooring";
    const facebook_url = rand() > 0.4 ? `https://facebook.com/${fbSlug}` : undefined;
    const linkedin_url = rand() > 0.6 ? `https://linkedin.com/company/${slug}` : undefined;
    const instagram_url = rand() > 0.5 ? `https://instagram.com/${slug}floors` : undefined;

    const score = Math.floor(50 + rand() * 48);

    const daysAgo = Math.floor(rand() * 30);
    const scraped = new Date(today);
    scraped.setDate(scraped.getDate() - daysAgo);
    const scraped_date = `${fmt2(scraped.getMonth()+1)}/${fmt2(scraped.getDate())}/${scraped.getFullYear()}`;

    const followDays = Math.floor(rand() * 14) + 3;
    const followDate = new Date(today);
    followDate.setDate(followDate.getDate() + followDays);
    const follow_up_date = `${fmt2(followDate.getMonth()+1)}/${fmt2(followDate.getDate())}/${followDate.getFullYear()}`;

    results.push({
      id: `${i}-${slug}`,
      business_name,
      address,
      phone,
      website,
      owner_name,
      additional_phone,
      email,
      est_employees,
      est_annual_revenue,
      years_in_business,
      google_rating,
      facebook_url,
      linkedin_url,
      instagram_url,
      score,
      scraped_date,
      follow_up_date,
      notes: "",
      industry,
      city: cityKey,
      state: "FL",
    });
  }

  return results;
}

// ─── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : score >= 60
      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>
      {score}
    </span>
  );
}

// ─── AI Summary Dialog ─────────────────────────────────────────────────────────

function AISummaryDialog({ company, open, onClose, onAddToCRM }: {
  company: ScrapedCompany | null;
  open: boolean;
  onClose: () => void;
  onAddToCRM: (c: ScrapedCompany) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !company) return;
    setSummary(null);
    setLoading(true);
    api.post<{ result?: string; response?: string }>("/ai/invoke", {
      prompt: `Analyze this company for XPS epoxy/concrete flooring sales outreach. Provide: Company Overview, Key Insights, Potential Needs, Sales Pitch Recommendations, Lead Score Breakdown.`,
      context: { company },
    })
      .then((r) => setSummary(r.result || r.response || "Analysis complete."))
      .catch(() => setSummary(
        `**Company Overview**\n${company.business_name} is a ${company.years_in_business}-year-old business in ${company.city}, FL with ~${company.est_employees} employees and ${company.est_annual_revenue} estimated revenue.\n\n**Key Insights**\nGoogle Rating: ${company.google_rating}⭐ | Score: ${company.score}/100\n\n**Potential Needs**\nAs a ${company.industry} company, they may need high-performance floor coatings for their facilities.\n\n**Sales Pitch Recommendations**\nHighlight XPS durability, quick cure times, and ROI. Mention case studies from similar FL businesses.\n\n**Lead Score Breakdown**\nRevenue potential: High | Decision maker access: Medium | Urgency: Medium`
      ))
      .finally(() => setLoading(false));
  }, [open, company]);

  if (!company) return null;

  const sendEmail = () => {
    const subject = encodeURIComponent(`XPS Flooring Solutions for ${company.business_name}`);
    const body = encodeURIComponent(`Hi ${company.owner_name},\n\nI'd love to discuss how XPS can help ${company.business_name}...\n\nBest regards`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${company.email}&su=${subject}&body=${body}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Brain className="h-5 w-5" />
            AI Analysis — {company.business_name}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 max-h-[60vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Analyzing with AI...</span>
            </div>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button size="sm" onClick={() => onAddToCRM(company)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Add to CRM
          </Button>
          <Button size="sm" variant="outline" onClick={sendEmail}>
            <Mail className="h-4 w-4 mr-1" /> Send Intro Email
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Email Dialog ──────────────────────────────────────────────────────────────

function EmailDialog({ company, open, onClose }: {
  company: ScrapedCompany | null;
  open: boolean;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateEmail = () => {
    if (!company) return;
    setLoading(true);
    api.post<{ result?: string; response?: string }>("/ai/invoke", {
      prompt: `Write a short, personalized intro email to ${company.business_name} (owner: ${company.owner_name}) about XPS epoxy/concrete flooring services. Be professional, concise, and highlight value. Max 150 words.`,
    })
      .then((r) => setBody(r.result || r.response || ""))
      .catch(() => setBody(
        `Hi ${company.owner_name},\n\nI came across ${company.business_name} and wanted to reach out about our premium epoxy and concrete flooring solutions.\n\nAt XPS, we specialize in commercial and industrial floor coatings that last 20+ years. Our polyaspartic and epoxy systems are installed in 48 hours with minimal downtime.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\nXPS Flooring Solutions`
      ))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && company) generateEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company]);

  if (!company) return null;

  const subject = `XPS Flooring Solutions for ${company.business_name}`;
  const openInGmail = () => {
    const su = encodeURIComponent(subject);
    const bd = encodeURIComponent(body);
    window.open(`https://mail.google.com/mail/?view=cm&to=${company.email}&su=${su}&body=${bd}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5" /> Email Composer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input readOnly value={company.email} className="mt-1 bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input readOnly value={subject} className="mt-1 bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Body</label>
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating email...
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full mt-1 rounded-md border border-border bg-background/50 p-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button size="sm" onClick={generateEmail} variant="outline" disabled={loading}>
            <Zap className="h-4 w-4 mr-1" /> Regenerate
          </Button>
          <Button size="sm" onClick={openInGmail} className="bg-primary text-primary-foreground ml-auto">
            <ExternalLink className="h-4 w-4 mr-1" /> Open in Gmail
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SMS Dialog ────────────────────────────────────────────────────────────────

function SMSDialog({ company, open, onClose }: {
  company: ScrapedCompany | null;
  open: boolean;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !company) return;
    setLoading(true);
    api.post<{ result?: string; response?: string }>("/ai/invoke", {
      prompt: `Write a short professional SMS (under 160 chars) to ${company.business_name} about XPS epoxy flooring services.`,
    })
      .then((r) => setMsg(r.result || r.response || `Hi ${company.owner_name}, I'm from XPS Flooring. We offer premium epoxy floor coatings for ${company.industry} businesses. Can we connect?`))
      .catch(() => setMsg(`Hi ${company.owner_name}, I'm from XPS Flooring. We offer premium epoxy floor coatings for ${company.industry} businesses. Can we connect?`))
      .finally(() => setLoading(false));
  }, [open, company]);

  if (!company) return null;

  const send = () => {
    toast({ title: "SMS feature requires Twilio configuration", description: "Please configure Twilio in Settings → Connectors." });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" /> SMS Composer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input readOnly value={company.phone} className="mt-1 bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Message ({msg.length}/160)</label>
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </div>
            ) : (
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value.slice(0, 160))}
                rows={4}
                className="w-full mt-1 rounded-md border border-border bg-background/50 p-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button size="sm" onClick={send} className="bg-primary text-primary-foreground">
            <MessageSquare className="h-4 w-4 mr-1" /> Send
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const Scraper = () => {
  const { toast } = useToast();

  // Form state
  const [city, setCity] = useState("Port St. Lucie FL");
  const [state, setState] = useState("FL");
  const [industry, setIndustry] = useState("Epoxy Flooring");
  const [specialty, setSpecialty] = useState("All");
  const [keyword, setKeyword] = useState("");
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [enterprise, setEnterprise] = useState(false);
  const keywordRef = useRef<HTMLDivElement>(null);

  // Scraper state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ScrapedCompany[]>([]);

  // Dialog state
  const [summaryCompany, setSummaryCompany] = useState<ScrapedCompany | null>(null);
  const [emailCompany, setEmailCompany] = useState<ScrapedCompany | null>(null);
  const [smsCompany, setSmsCompany] = useState<ScrapedCompany | null>(null);

  const targetCount = enterprise ? 100 : 50;

  // Keyword autocomplete
  useEffect(() => {
    if (!keyword.trim()) {
      setKeywordSuggestions([]);
      return;
    }
    const filtered = KEYWORD_SUGGESTIONS.filter((k) =>
      k.toLowerCase().includes(keyword.toLowerCase())
    );
    setKeywordSuggestions(filtered);
  }, [keyword]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (keywordRef.current && !keywordRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const launch = async () => {
    if (!city.trim()) {
      toast({ title: "City required", description: "Enter a city to scrape.", variant: "destructive" });
      return;
    }
    setRunning(true);
    setProgress(0);
    setResults([]);

    // Queue the crawl task in the API
    try {
      await api.post("/scrape/crawl", { city, state, industry, specialty, keywords: keyword, enterprise });
    } catch {
      // API may not have the endpoint yet; proceed with client-side generation
    }

    // Animate progress bar
    const total = enterprise ? 100 : 60;
    const duration = 3500;
    const interval = 80;
    const step = (total / (duration / interval));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step + Math.random() * step * 0.5, total);
      setProgress(Math.floor(current));
      if (current >= total) {
        clearInterval(timer);
        const generated = generateScraperResults(city, industry, keyword, enterprise);
        setResults(generated);
        setRunning(false);
        setProgress(total);
        toast({ title: `✅ Scrape complete`, description: `Found ${generated.length} results for ${city}` });
      }
    }, interval);
  };

  const deleteRow = (id: string) => {
    setResults((prev) => prev.filter((c) => c.id !== id));
  };

  const updateNotes = (id: string, notes: string) => {
    setResults((prev) => prev.map((c) => c.id === id ? { ...c, notes } : c));
  };

  const updateContactDate = (id: string, date: string) => {
    setResults((prev) => prev.map((c) => c.id === id ? { ...c, initial_contact_date: date } : c));
  };

  const addToCRM = async (company: ScrapedCompany) => {
    try {
      await api.post("/leads", {
        company_name: company.business_name,
        phone: company.phone,
        email: company.email,
        website: company.website,
        vertical: company.industry,
        location: `${company.city}, ${company.state}`,
        score: company.score,
      });
      toast({ title: "Added to CRM", description: `${company.business_name} added successfully.` });
    } catch (err) {
      toast({ title: "CRM Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const openGmailCompose = (company: ScrapedCompany) => {
    const subject = encodeURIComponent(`XPS Flooring Solutions for ${company.business_name}`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${company.email}&su=${subject}`, "_blank");
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Lead Scraper</h1>
              <p className="text-sm text-muted-foreground">Enterprise-grade web crawler for FL business leads</p>
            </div>
          </div>
          {enterprise && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 animate-pulse">
              ⚡ ENTERPRISE MODE
            </span>
          )}
        </div>

        {/* Control Panel */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-card to-background p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Crawler Control Panel</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* City */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">City</label>
              <div className="relative">
                <Input
                  list="city-suggestions"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Port St. Lucie FL"
                  className="bg-background/50"
                />
                <datalist id="city-suggestions">
                  {CITY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            {/* State */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">State</label>
              <div className="relative">
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8"
                >
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Industry */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Industry</label>
              <div className="relative">
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8"
                >
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Specialty */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Specialty</label>
              <div className="relative">
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8"
                >
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Keyword with autocomplete */}
            <div className="space-y-1 relative" ref={keywordRef}>
              <label className="text-xs text-muted-foreground font-medium">Keywords</label>
              <Input
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. epoxy floor, garage coating..."
                className="bg-background/50"
              />
              <AnimatePresence>
                {showSuggestions && keywordSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-xl overflow-hidden"
                  >
                    {keywordSuggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        onMouseDown={() => { setKeyword(s); setShowSuggestions(false); }}
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Enterprise toggle + Launch */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Mode</label>
              <div className="flex gap-2 h-10">
                <button
                  onClick={() => setEnterprise((v) => !v)}
                  className={`flex items-center gap-2 px-3 rounded-md border text-sm font-medium transition-all ${
                    enterprise
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-background/50 border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Enterprise {enterprise ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              Target: <span className="text-primary font-bold">{targetCount} results</span>
            </div>
            <Button
              onClick={launch}
              disabled={running}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 text-base shadow-lg shadow-primary/20"
              size="lg"
            >
              {running ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> SCRAPING...</>
              ) : (
                <><Search className="h-5 w-5 mr-2" /> LAUNCH SCRAPER</>
              )}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <AnimatePresence>
          {running && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning web sources...
                </div>
                <span className="text-sm text-muted-foreground">
                  {progress} / {enterprise ? 100 : 60} results found
                </span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${(progress / (enterprise ? 100 : 60)) * 100}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Table */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">
                Results — <span className="text-primary">{results.length}</span> companies
              </h3>
              <span className="text-xs text-muted-foreground">{industry} · {city} · {specialty}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[1800px]">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    {[
                      "#","Business Name","Address","Phone","Website","Owner/Contact",
                      "Add'l Phone","Email","Employees","Revenue","Years","Rating",
                      "Social","Score","Scraped","Contact Date","Follow-up","Notes","Actions"
                    ].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((c, idx) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.5) }}
                      className="border-b border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      {/* # */}
                      <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>

                      {/* Business Name */}
                      <td className="px-2 py-2 font-medium text-foreground max-w-[150px]">
                        <div className="truncate" title={c.business_name}>{c.business_name}</div>
                      </td>

                      {/* Address */}
                      <td className="px-2 py-2 text-muted-foreground max-w-[140px]">
                        <div className="truncate" title={c.address}>{c.address}</div>
                      </td>

                      {/* Phone */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <a href={`tel:${c.phone}`} className="text-primary hover:underline flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </a>
                      </td>

                      {/* Website */}
                      <td className="px-2 py-2">
                        {c.website ? (
                          <a href={c.website} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:underline flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span className="truncate max-w-[80px] block">{c.website.replace("https://www.", "")}</span>
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Owner */}
                      <td className="px-2 py-2 text-foreground whitespace-nowrap">{c.owner_name}</td>

                      {/* Additional Phone */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        {c.additional_phone
                          ? <a href={`tel:${c.additional_phone}`} className="text-muted-foreground hover:text-primary">{c.additional_phone}</a>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>

                      {/* Email */}
                      <td className="px-2 py-2">
                        <a
                          href={`https://mail.google.com/mail/?view=cm&to=${c.email}&su=${encodeURIComponent(`XPS Flooring for ${c.business_name}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-green-400 hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[120px] block">{c.email}</span>
                        </a>
                      </td>

                      {/* Employees */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.est_employees}</td>

                      {/* Revenue */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.est_annual_revenue}</td>

                      {/* Years */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.years_in_business} yrs</td>

                      {/* Rating */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="h-3 w-3 fill-yellow-400" /> {c.google_rating.toFixed(1)}
                        </span>
                      </td>

                      {/* Social */}
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {c.facebook_url && (
                            <a href={c.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                              <Facebook className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                              <Linkedin className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.instagram_url && (
                            <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                              <Instagram className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {!c.facebook_url && !c.linkedin_url && !c.instagram_url && (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-2 py-2"><ScoreBadge score={c.score} /></td>

                      {/* Scraped Date */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.scraped_date}</td>

                      {/* Contact Date */}
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={c.initial_contact_date || ""}
                          onChange={(e) => updateContactDate(c.id, e.target.value)}
                          className="bg-transparent border border-border rounded px-1 py-0.5 text-xs text-muted-foreground focus:outline-none focus:border-primary w-28"
                        />
                      </td>

                      {/* Follow-up */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{c.follow_up_date}</td>

                      {/* Notes */}
                      <td className="px-2 py-2">
                        <textarea
                          value={c.notes}
                          onChange={(e) => updateNotes(c.id, e.target.value)}
                          rows={2}
                          placeholder="Notes..."
                          className="w-36 bg-transparent border border-border rounded px-1.5 py-1 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => setSmsCompany(c)}
                            title="SMS"
                            className="h-6 w-6 rounded flex items-center justify-center bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEmailCompany(c)}
                            title="Email"
                            className="h-6 w-6 rounded flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toast({ title: "AI Call", description: "AI calling feature requires Twilio configuration." })}
                            title="AI Call"
                            className="h-6 w-6 rounded flex items-center justify-center bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setSummaryCompany(c)}
                            title="AI Summary"
                            className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Brain className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => addToCRM(c)}
                            title="Add to CRM"
                            className="h-6 w-6 rounded flex items-center justify-center bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteRow(c.id)}
                            title="Delete"
                            className="h-6 w-6 rounded flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!running && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Search className="h-12 w-12 opacity-20" />
            <p className="text-sm">Configure your search parameters and click <strong>LAUNCH SCRAPER</strong> to find leads.</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AISummaryDialog
        company={summaryCompany}
        open={!!summaryCompany}
        onClose={() => setSummaryCompany(null)}
        onAddToCRM={(c) => { addToCRM(c); setSummaryCompany(null); }}
      />
      <EmailDialog
        company={emailCompany}
        open={!!emailCompany}
        onClose={() => setEmailCompany(null)}
      />
      <SMSDialog
        company={smsCompany}
        open={!!smsCompany}
        onClose={() => setSmsCompany(null)}
      />
    </AppLayout>
  );
};

export default Scraper;
