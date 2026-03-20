/**
 * XPS Intelligence Engine Service
 *
 * Orchestrates competitive intelligence, pricing analysis,
 * demand detection, and lead score refinement.
 */

// ─── Shared AI helper ─────────────────────────────────────────────────────────

async function callGroq(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are an XPS Intelligence AI analyst specializing in business intelligence, market analysis, and sales optimization. Return structured JSON when asked.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callOllama(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Ollama unavailable");
  const data = await response.json() as { response: string };
  return data.response;
}

async function callAI(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    return await callGroq(prompt, systemPrompt);
  } catch (err) {
    console.warn("[IntelligenceEngine] Groq failed, trying Ollama:", (err as Error).message);
    return callOllama(prompt);
  }
}

// ─── CompetitorTracker ────────────────────────────────────────────────────────

export interface CompetitorAnalysis {
  url: string;
  companyName: string;
  services: string[];
  pricing: string[];
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  threatLevel: "low" | "medium" | "high";
  scrapedAt: string;
  rawContent?: string;
}

export class CompetitorTracker {
  async scrapeAndAnalyze(competitorUrl: string): Promise<CompetitorAnalysis> {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    let content = "";

    if (firecrawlKey) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { "Authorization": `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: competitorUrl,
            formats: ["markdown"],
            timeout: 20000,
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          const data = await res.json() as { success: boolean; markdown?: string };
          if (data.success && data.markdown) {
            content = data.markdown.slice(0, 8000);
          }
        }
      } catch (err) {
        console.warn("[CompetitorTracker] Firecrawl failed:", (err as Error).message);
      }
    }

    // Fallback to direct fetch
    if (!content) {
      try {
        const res = await fetch(competitorUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; XPS-Intelligence/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await res.text();
        content = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      } catch {
        content = `Unable to scrape ${competitorUrl}`;
      }
    }

    const prompt = `Analyze this competitor website content for a flooring/epoxy coating company.

URL: ${competitorUrl}
Content:
${content}

Return a JSON object with these fields:
{
  "companyName": "company name",
  "services": ["list of services offered"],
  "pricing": ["any pricing information found"],
  "strengths": ["key strengths"],
  "weaknesses": ["potential weaknesses"],
  "marketPosition": "brief description of their market position",
  "threatLevel": "low|medium|high"
}

Base threat level on: service breadth, online presence, pricing competitiveness, geographic overlap.`;

    let analysis: Omit<CompetitorAnalysis, "url" | "scrapedAt" | "rawContent">;
    try {
      const aiResponse = await callAI(prompt);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");
      analysis = JSON.parse(jsonMatch[0]) as typeof analysis;
    } catch {
      analysis = {
        companyName: new URL(competitorUrl).hostname.replace("www.", ""),
        services: [],
        pricing: [],
        strengths: ["Unable to analyze"],
        weaknesses: [],
        marketPosition: "Unknown",
        threatLevel: "medium",
      };
    }

    return {
      ...analysis,
      url: competitorUrl,
      scrapedAt: new Date().toISOString(),
      rawContent: content.slice(0, 500),
    };
  }
}

// ─── PricingAnalyzer ──────────────────────────────────────────────────────────

export interface PricingInsight {
  marketLow: number;
  marketHigh: number;
  recommendedPrice: number;
  currency: "USD";
  unit: string;
  confidence: "low" | "medium" | "high";
  rationale: string;
  competitivePosition: "below_market" | "at_market" | "above_market" | "premium";
  scrapedPricing: string[];
}

export class PricingAnalyzer {
  async analyze(scrapedContent: string, serviceType: string): Promise<PricingInsight> {
    const prompt = `Analyze pricing data for ${serviceType} flooring/epoxy services.

Scraped content:
${scrapedContent.slice(0, 3000)}

Extract and analyze pricing. Return JSON:
{
  "marketLow": <number per sqft USD>,
  "marketHigh": <number per sqft USD>,
  "recommendedPrice": <number per sqft USD>,
  "unit": "per sqft",
  "confidence": "low|medium|high",
  "rationale": "explanation",
  "competitivePosition": "below_market|at_market|above_market|premium",
  "scrapedPricing": ["raw pricing strings found"]
}

If no pricing found, use Florida market defaults: residential $4-8/sqft, commercial $3-6/sqft.`;

    try {
      const aiResponse = await callAI(prompt);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const result = JSON.parse(jsonMatch[0]) as Omit<PricingInsight, "currency">;
      return { ...result, currency: "USD" };
    } catch {
      return {
        marketLow: 3,
        marketHigh: 8,
        recommendedPrice: 5.5,
        currency: "USD",
        unit: "per sqft",
        confidence: "low",
        rationale: "Default Florida market pricing — no pricing data extracted.",
        competitivePosition: "at_market",
        scrapedPricing: [],
      };
    }
  }
}

// ─── DemandDetector ───────────────────────────────────────────────────────────

export interface DemandSignal {
  signal: string;
  category: "high_intent" | "market_growth" | "trigger_event" | "competitive";
  strength: "weak" | "moderate" | "strong";
  description: string;
  actionable: boolean;
}

export interface DemandReport {
  generatedAt: string;
  marketArea: string;
  overallDemandScore: number;
  signals: DemandSignal[];
  recommendedActions: string[];
  topOpportunities: string[];
}

export class DemandDetector {
  detect(leads: Array<{ company_name?: string; vertical?: string; score?: number; location?: string; notes?: string }>): DemandReport {
    const signals: DemandSignal[] = [];
    const marketArea = leads[0]?.location?.split(",")[0] || "Unknown Market";

    // High-score concentration
    const highScoreLeads = leads.filter((l) => (l.score ?? 0) > 75);
    if (highScoreLeads.length >= 5) {
      signals.push({
        signal: `${highScoreLeads.length} high-score leads identified`,
        category: "high_intent",
        strength: "strong",
        description: "Multiple qualified prospects indicate active market demand.",
        actionable: true,
      });
    }

    // Industry clustering
    const verticals: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.vertical) {
        verticals[lead.vertical] = (verticals[lead.vertical] ?? 0) + 1;
      }
    }
    const topVertical = Object.entries(verticals).sort((a, b) => b[1] - a[1])[0];
    if (topVertical && topVertical[1] >= 3) {
      signals.push({
        signal: `${topVertical[0]}: ${topVertical[1]} prospects`,
        category: "market_growth",
        strength: "moderate",
        description: `${topVertical[0]} segment showing concentration of prospects.`,
        actionable: true,
      });
    }

    // New business keywords in notes
    const newBusinessCount = leads.filter((l) =>
      (l.notes || "").toLowerCase().includes("new") ||
      (l.company_name || "").toLowerCase().includes("2024") ||
      (l.company_name || "").toLowerCase().includes("2025")
    ).length;
    if (newBusinessCount > 0) {
      signals.push({
        signal: `${newBusinessCount} potential new businesses`,
        category: "trigger_event",
        strength: "moderate",
        description: "New businesses are prime targets for flooring/coating solutions.",
        actionable: true,
      });
    }

    const overallDemandScore = Math.min(100, 40 + signals.length * 15 + highScoreLeads.length * 2);

    return {
      generatedAt: new Date().toISOString(),
      marketArea,
      overallDemandScore,
      signals,
      recommendedActions: [
        signals.length > 0 ? "Launch targeted outreach to high-score leads immediately." : "Expand search criteria to find more prospects.",
        `Focus on ${topVertical?.[0] || "primary industry"} segment for best conversion rate.`,
        "Schedule follow-up calls within 48 hours of initial contact.",
      ],
      topOpportunities: highScoreLeads.slice(0, 5).map((l) => l.company_name || "Unknown"),
    };
  }
}

// ─── LeadScoreRefinement ──────────────────────────────────────────────────────

export interface RefinedScore {
  leadId: string;
  originalScore: number;
  refinedScore: number;
  delta: number;
  factors: Array<{ factor: string; weight: number; value: number }>;
  rationale: string;
}

export class LeadScoreRefinement {
  async refine(lead: {
    id: string;
    company_name?: string;
    phone?: string;
    email?: string;
    website?: string;
    vertical?: string;
    location?: string;
    score?: number;
    notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RefinedScore> {
    const original = lead.score ?? 50;
    const factors: Array<{ factor: string; weight: number; value: number }> = [];

    // Contact info scoring
    if (lead.phone) factors.push({ factor: "has_phone", weight: 10, value: 1 });
    if (lead.email) factors.push({ factor: "has_email", weight: 15, value: 1 });
    if (lead.website) factors.push({ factor: "has_website", weight: 8, value: 1 });

    // Industry alignment
    const highValueVerticals = ["epoxy", "concrete", "flooring", "property management", "warehouse", "commercial"];
    const isHighValue = highValueVerticals.some((v) =>
      (lead.vertical || "").toLowerCase().includes(v) ||
      (lead.company_name || "").toLowerCase().includes(v)
    );
    if (isHighValue) factors.push({ factor: "high_value_vertical", weight: 12, value: 1 });

    // Google rating from metadata
    const rating = (lead.metadata as Record<string, unknown> | undefined)?.google_rating;
    if (rating && Number(rating) >= 4) factors.push({ factor: "high_google_rating", weight: 10, value: 1 });

    // Notes sentiment
    const notes = (lead.notes || "").toLowerCase();
    if (notes.includes("interested") || notes.includes("callback")) {
      factors.push({ factor: "positive_notes", weight: 15, value: 1 });
    }

    const bonusPoints = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
    const refinedScore = Math.min(100, original + bonusPoints);

    let rationale = `Base score ${original}`;
    if (factors.length > 0) {
      rationale += `, boosted by: ${factors.map((f) => f.factor).join(", ")}`;
    }

    return {
      leadId: lead.id,
      originalScore: original,
      refinedScore,
      delta: refinedScore - original,
      factors,
      rationale,
    };
  }
}

// ─── IntelligenceEngine (orchestrator) ───────────────────────────────────────

export class IntelligenceEngine {
  readonly competitors = new CompetitorTracker();
  readonly pricing = new PricingAnalyzer();
  readonly demand = new DemandDetector();
  readonly scoring = new LeadScoreRefinement();

  async analyzeCompetitor(url: string): Promise<CompetitorAnalysis> {
    return this.competitors.scrapeAndAnalyze(url);
  }

  async refineLead(lead: Parameters<LeadScoreRefinement["refine"]>[0]): Promise<RefinedScore> {
    return this.scoring.refine(lead);
  }

  getDemandReport(leads: Parameters<DemandDetector["detect"]>[0]): DemandReport {
    return this.demand.detect(leads);
  }
}

export default IntelligenceEngine;
