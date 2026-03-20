export interface ScrapeTask {
  taskId: string;
  userId: string;
  url?: string;
  company_name?: string;
  query?: string;
  mode?: "firecrawl" | "steel" | "auto";
}

export interface ScrapedLead {
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  vertical?: string;
  location?: string;
  score?: number;
  raw_data?: Record<string, unknown>;
}

export interface ScrapeResult {
  company?: string;
  url?: string;
  content?: string;
  leads?: ScrapedLead[];
  metadata?: Record<string, unknown>;
}

async function scrapeWithFirecrawl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown", "extract"],
      extract: {
        prompt: "Extract company name, contact names, emails, phone numbers, location, business type/vertical, and any relevant business intelligence.",
        schema: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            contact_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            vertical: { type: "string" },
            description: { type: "string" },
          }
        }
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl error: ${response.statusText}`);
  }

  const result = await response.json() as {
    success: boolean;
    error?: string;
    markdown?: string;
    extract?: Record<string, unknown>;
  };

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error || "unknown error"}`);
  }

  const extracted = result.extract || {};
  const lead: ScrapedLead = {
    company_name: (extracted.company_name as string) || new URL(url).hostname,
    contact_name: extracted.contact_name as string | undefined,
    email: extracted.email as string | undefined,
    phone: extracted.phone as string | undefined,
    website: url,
    location: extracted.location as string | undefined,
    vertical: extracted.vertical as string | undefined,
    score: 70,
    raw_data: extracted,
  };

  return {
    company: lead.company_name,
    url,
    content: result.markdown || "",
    leads: [lead],
    metadata: { source: "firecrawl", scraped_at: new Date().toISOString() },
  };
}

async function scrapeWithSteel(url: string): Promise<ScrapeResult> {
  const steelApiKey = process.env.STEEL_API_KEY;
  if (!steelApiKey) {
    // Fall back to direct fetch if Steel not configured
    const response = await fetch(url, {
      headers: { "User-Agent": "XPS-Intelligence-Bot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const company_name = new URL(url).hostname.replace("www.", "");
    return {
      company: company_name,
      url,
      content: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000),
      leads: [{ company_name, website: url, score: 50 }],
      metadata: { source: "direct_fetch", scraped_at: new Date().toISOString() },
    };
  }

  // Steel Browser session
  const sessionRes = await fetch("https://api.steel.dev/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Steel-Api-Key": steelApiKey },
    body: JSON.stringify({ use_proxy: true, solve_captcha: true }),
  });
  const session = await sessionRes.json() as { id: string };

  try {
    const scrapeRes = await fetch(`https://api.steel.dev/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Steel-Api-Key": steelApiKey },
      body: JSON.stringify({ url, session_id: session.id, format: "markdown" }),
    });
    const data = await scrapeRes.json() as { content?: string; metadata?: Record<string, unknown> };
    const company_name = new URL(url).hostname.replace("www.", "");
    return {
      company: company_name,
      url,
      content: data.content || "",
      leads: [{ company_name, website: url, score: 65 }],
      metadata: { source: "steel", ...(data.metadata || {}), scraped_at: new Date().toISOString() },
    };
  } finally {
    await fetch(`https://api.steel.dev/v1/sessions/${session.id}/release`, {
      method: "POST",
      headers: { "Steel-Api-Key": steelApiKey },
    });
  }
}

export async function runScrapeTask(task: ScrapeTask): Promise<ScrapeResult> {
  const url = task.url || (task.company_name ? `https://www.${task.company_name.toLowerCase().replace(/\s+/g, "")}.com` : null);

  if (!url && !task.query) {
    throw new Error("Either url, company_name, or query is required");
  }

  if (task.mode === "steel") {
    return scrapeWithSteel(url!);
  }

  if (task.mode === "firecrawl" || process.env.FIRECRAWL_API_KEY) {
    try {
      return await scrapeWithFirecrawl(url!);
    } catch (err) {
      console.warn("[Scraper] Firecrawl failed, falling back to Steel:", (err as Error).message);
      return scrapeWithSteel(url!);
    }
  }

  return scrapeWithSteel(url!);
}
