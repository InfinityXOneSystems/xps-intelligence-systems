import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth);

// XPS pre-loaded taxonomy
const XPS_TAXONOMY = [
  { category: "product", name: "100% Solid Epoxy", description: "High-build flooring system with zero VOCs, maximum durability for industrial/commercial applications" },
  { category: "product", name: "Water-Based Epoxy", description: "Low-odor, easier application epoxy for residential and light commercial" },
  { category: "product", name: "Metallic Epoxy", description: "Decorative epoxy with metallic pigments creating unique 3D effects" },
  { category: "product", name: "Polyaspartic Coating", description: "Fast-cure topcoat with UV stability, ideal for fast-turnaround projects" },
  { category: "product", name: "Concrete Overlay", description: "Thin polymer-modified cement for resurfacing damaged concrete" },
  { category: "technique", name: "Diamond Grinding", description: "Surface preparation using diamond tooling to create proper profile for coatings" },
  { category: "technique", name: "Shot Blasting", description: "Abrasive surface prep method for industrial floors" },
  { category: "technique", name: "Acid Etching", description: "Chemical surface preparation for concrete floors" },
  { category: "technique", name: "Color Hardener Application", description: "Dry-shake color hardener for decorative concrete" },
  { category: "equipment", name: "Planetary Grinder", description: "Multi-head diamond grinding machine for large areas" },
  { category: "equipment", name: "Vacuum System", description: "HEPA dust containment system for grinding operations" },
  { category: "equipment", name: "Shot Blaster", description: "Steel shot machine for surface preparation" },
  { category: "chemical", name: "CSP Profile Standards", description: "Concrete surface profile standards 1-9 for coating adhesion" },
  { category: "market_segment", name: "Warehouse Flooring", description: "High-traffic industrial floors for logistics and distribution" },
  { category: "market_segment", name: "Garage Floor Coating", description: "Residential and commercial garage floor systems" },
  { category: "market_segment", name: "Commercial Showrooms", description: "Polished or coated concrete for retail and showroom environments" },
];

// Domain knowledge base for RAG context
const DOMAIN_KB = [
  { id: "kb-epoxy-types", title: "Epoxy Flooring Types & Applications", content: "100% solid epoxy is the highest performance system for industrial and commercial floors. Water-based epoxy suits residential applications with lower VOCs. Metallic epoxy creates decorative 3D effects. Polyaspartic is fast-curing for same-day return-to-service projects.", category: "product_info", tags: ["epoxy", "types", "applications"] },
  { id: "kb-pricing", title: "Florida Epoxy Contractor Pricing Signals 2024", content: "Residential garage floors: $3-8/sqft. Commercial warehouse: $2-5/sqft. Decorative metallic: $8-15/sqft. Polished concrete: $3-12/sqft. Surface preparation adds $0.50-2.00/sqft. Average project: 1,000-5,000 sqft residential, 5,000-50,000 sqft commercial.", category: "pricing", tags: ["pricing", "florida"] },
  { id: "kb-broward", title: "Broward County Market Intelligence", content: "Broward County has 40+ active epoxy contractors. Key cities: Fort Lauderdale, Coral Springs, Pembroke Pines, Hollywood, Davie. Premium residential in Weston and Parkland. Heavy industrial in Doral and Medley. New construction driving demand.", category: "market_intelligence", tags: ["broward", "fort lauderdale"] },
  { id: "kb-miami", title: "Miami-Dade County Flooring Market", content: "Miami-Dade is Florida's largest epoxy market. Strong commercial activity in Doral, Medley, Hialeah. Luxury residential in Brickell and Coral Gables. High-rise condos prefer polished concrete. Spanish-speaking capability is competitive advantage.", category: "market_intelligence", tags: ["miami", "miami-dade"] },
  { id: "kb-weaknesses", title: "Competitor Weakness Analysis & Sales Pitch", content: "Common contractor weaknesses: no warranty, outsource surface prep, use water-based sold as solid, can't handle large commercial. XPS advantages: 5-year warranty, in-house surface prep, NACE certified applicators, project management software.", category: "sales_playbook", tags: ["competitor", "weakness", "pitch"] },
  { id: "kb-scoring", title: "Lead Scoring Methodology", content: "High-value signals: new business registration, commercial construction permit, property recently sold, fleet vehicles, social media advertising, government bidding. Medium signals: 3+ year business, Google 4.0+, website with contact form.", category: "scoring", tags: ["lead scoring", "signals"] },
  { id: "kb-surface-prep", title: "Surface Preparation Standards", content: "ICRI CSP standards govern epoxy adhesion. Diamond grinding: CSP 1-4. Shot blasting: CSP 3-8. Moisture testing (ASTM F2170) required. Failing to test moisture is #1 cause of epoxy adhesion failure.", category: "technical", tags: ["surface prep", "CSP", "moisture"] },
  { id: "kb-palm-beach", title: "Palm Beach County Market Intelligence", content: "Palm Beach County features affluent residential market with high willingness to pay for premium systems. Boca Raton and Delray Beach are growth hotspots. Wellington equestrian facility demand. Pricing tolerance 15-20% higher than Broward.", category: "market_intelligence", tags: ["palm beach", "boca raton"] },
];

// Simple keyword-based relevance scoring for RAG
function scoreRelevance(query: string, doc: { title: string; content: string; tags?: string[] }): number {
  const queryTokens = new Set(query.toLowerCase().split(/\W+/).filter((t) => t.length > 3));
  const docText = `${doc.title} ${doc.content} ${(doc.tags || []).join(" ")}`.toLowerCase();
  const docTokens = docText.split(/\W+/).filter((t) => t.length > 3);
  let matches = 0;
  for (const token of docTokens) {
    if (queryTokens.has(token)) matches++;
  }
  return matches / Math.max(queryTokens.size, 1);
}

function retrieveContext(query: string, topK = 5): typeof DOMAIN_KB {
  const scored = DOMAIN_KB.map((doc) => ({ ...doc, _score: scoreRelevance(query, doc) }));
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, topK);
}

// Call Groq LLM for RAG
async function callGroqRag(query: string, context: typeof DOMAIN_KB): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const contextBlocks = context
    .map((d, i) => `[${i + 1}] ${d.title}\n${d.content}`)
    .join("\n\n");

  const systemPrompt = `You are the XPS Intelligence AI assistant specializing in epoxy flooring and decorative concrete.
Company: XPS Intelligence Systems | Territory: Florida + 200-mile radius
Products: 100% Solid Epoxy, Metallic Epoxy, Polyaspartic, Polished Concrete
Strengths: 5-year warranty, in-house surface prep, NACE certified applicators

CONTEXT:
${contextBlocks}

Answer concisely and actionably. Recommend XPS products/approach where relevant.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: query }],
      max_tokens: 1024,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

intelligenceRouter.get("/taxonomy", async (req, res) => {
  try {
    const db = getDb();
    const dbResult = await db.query("SELECT * FROM xps_taxonomy ORDER BY category, name").catch(() => ({ rows: [] }));
    const dbItems = (dbResult as { rows: unknown[] }).rows;

    const allItems = [...XPS_TAXONOMY, ...dbItems];
    const grouped: Record<string, typeof XPS_TAXONOMY> = {};
    for (const item of allItems) {
      const cat = (item as { category: string }).category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item as typeof XPS_TAXONOMY[0]);
    }

    res.json({ taxonomy: grouped, total: allItems.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.get("/kb", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM xps_knowledge_base ORDER BY relevance_score DESC, created_at DESC LIMIT 50"
    ).catch(() => ({ rows: [] }));
    res.json({ articles: (result as { rows: unknown[] }).rows, total: (result as { rows: unknown[] }).rows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const KBArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

intelligenceRouter.post("/kb", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const data = KBArticleSchema.parse(req.body);
    const db = getDb();
    const result = await db.query(
      `INSERT INTO xps_knowledge_base (title, content, category, tags, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.title, data.content, data.category, data.tags || [], data.source, req.user!.id]
    );
    res.status(201).json({ article: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.get("/distillation", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM xps_distillation_queue ORDER BY created_at DESC LIMIT 20"
    ).catch(() => ({ rows: [] }));
    res.json({ queue: (result as { rows: unknown[] }).rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.post("/distillation", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const { source_url, source_type, content } = req.body as { source_url?: string; source_type?: string; content?: string };
    const db = getDb();
    const id = randomUUID();
    await db.query(
      `INSERT INTO xps_distillation_queue (id, source_url, source_type, content) VALUES ($1,$2,$3,$4)`,
      [id, source_url, source_type || "manual", content]
    );
    res.status(201).json({ id, status: "queued" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =========================================================================
// RAG – Semantic search and Q&A endpoint
// POST /api/intelligence/rag
// =========================================================================
const RagQuerySchema = z.object({
  query:                z.string().min(1).max(1000),
  top_k:                z.number().int().min(1).max(10).optional().default(5),
  save_to_distillation: z.boolean().optional().default(false),
});

intelligenceRouter.post("/rag", async (req, res) => {
  try {
    const { query, top_k, save_to_distillation } = RagQuerySchema.parse(req.body);

    // Retrieve relevant context from domain KB
    const context = retrieveContext(query, top_k);

    // Also try to get relevant leads from DB via full-text search
    const db = getDb();
    const leadsResult = await db.query(
      `SELECT company_name, city, state, vertical, score, notes
       FROM leads
       WHERE deleted_at IS NULL
         AND to_tsvector('english', company_name || ' ' || COALESCE(notes, '') || ' ' || COALESCE(vertical, ''))
           @@ plainto_tsquery('english', $1)
       ORDER BY score DESC LIMIT 3`,
      [query]
    ).catch(() => ({ rows: [] }));

    const leadContext = (leadsResult as { rows: unknown[] }).rows
      .map((l: unknown) => {
        const lead = l as { company_name: string; city: string; state: string; vertical?: string; score?: number; notes?: string };
        return {
          id:       randomUUID(),
          title:    lead.company_name,
          content:  `Company: ${lead.company_name}. Location: ${lead.city}, ${lead.state}. Vertical: ${lead.vertical || "unknown"}. Score: ${lead.score || 0}. ${lead.notes || ""}`,
          category: "lead",
          tags:     [lead.city, lead.vertical || "flooring"].filter(Boolean) as string[],
        };
      });

    const allContext = [...context, ...leadContext];
    const contextDocs = allContext.map((d) => ({
      title:    d.title,
      category: d.category,
      excerpt:  d.content.substring(0, 120),
    }));

    let answer: string;
    let method: string;

    try {
      answer = await callGroqRag(query, allContext);
      method = "groq_rag";
    } catch (llmErr) {
      // Fallback: return best matching context excerpt
      answer = context.length > 0
        ? `Based on domain knowledge: ${context[0].content.substring(0, 400)}`
        : "No relevant context found for this query. Please ask about epoxy flooring, pricing, or Florida market intelligence.";
      method = "keyword_fallback";
      console.warn(`[RAG] LLM unavailable, using fallback: ${(llmErr as Error).message}`);
    }

    // Optionally save best LLM responses to distillation queue
    if (save_to_distillation && answer && method === "groq_rag") {
      await db.query(
        `INSERT INTO xps_distillation_queue (id, source_type, content) VALUES ($1, $2, $3)`,
        [randomUUID(), "rag_response", JSON.stringify({ query, answer, context_docs: contextDocs })]
      ).catch((e: Error) => console.warn("[RAG] Distillation queue write failed:", e.message));
    }

    res.json({
      query,
      answer,
      method,
      context_docs:  contextDocs,
      context_count: allContext.length,
      generated_at:  new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

// =========================================================================
// Company Intelligence – generate full profile for a lead
// POST /api/intelligence/company
// =========================================================================
const CompanyIntelSchema = z.object({
  company_name:  z.string().min(1),
  city:          z.string().optional(),
  state:         z.string().optional().default("FL"),
  vertical:      z.string().optional(),
  score:         z.number().int().min(0).max(100).optional(),
  website:       z.string().optional(),
  google_rating: z.number().optional(),
  notes:         z.string().optional(),
});

intelligenceRouter.post("/company", async (req, res) => {
  try {
    const data = CompanyIntelSchema.parse(req.body);
    const vertical = (data.vertical || "default").toLowerCase();

    const PRICING: Record<string, { low: number; mid: number; high: number; avg_sqft: number }> = {
      warehouse:   { low: 2.00, mid: 3.50, high: 5.00, avg_sqft: 15000 },
      garage:      { low: 3.00, mid: 5.50, high: 8.00, avg_sqft: 600 },
      commercial:  { low: 2.50, mid: 4.00, high: 7.00, avg_sqft: 5000 },
      industrial:  { low: 1.75, mid: 3.00, high: 5.00, avg_sqft: 25000 },
      residential: { low: 3.50, mid: 6.00, high: 10.00, avg_sqft: 800 },
      decorative:  { low: 6.00, mid: 9.00, high: 15.00, avg_sqft: 1200 },
      polished:    { low: 3.00, mid: 6.00, high: 12.00, avg_sqft: 3000 },
      default:     { low: 2.50, mid: 4.50, high: 8.00, avg_sqft: 2500 },
    };

    const normalizedVertical = Object.keys(PRICING).find((v) => vertical.includes(v)) || "default";
    const pricing            = PRICING[normalizedVertical];
    const score              = data.score || 50;
    const scoreMultiplier    = score >= 80 ? 1.5 : score >= 60 ? 1.2 : 1.0;
    const singleProject      = Math.round(pricing.mid * pricing.avg_sqft * scoreMultiplier);
    const annualMultiplier   = ["warehouse", "commercial", "industrial"].includes(normalizedVertical) ? 3 : 2;

    const opportunity = {
      single_project:   singleProject,
      annual_potential: Math.round(singleProject * annualMultiplier),
      pricing_range:    `$${pricing.low}-${pricing.high}/sqft`,
      avg_sqft:         pricing.avg_sqft,
      confidence:       score >= 70 ? "high" : score >= 45 ? "medium" : "low",
    };

    const weaknesses = [
      "No clear workmanship warranty beyond manufacturer specs",
      score < 60 ? "Budget pricing signals potential quality shortcuts" : "Limited commercial project capacity",
      !data.website ? "No web presence – low digital maturity" : "Limited online reputation management",
      "Likely outsources surface preparation – increases adhesion failure risk",
    ];

    let intelligence: Record<string, unknown>;

    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY not set");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [{
            role: "system",
            content: "You are a B2B sales intelligence analyst for XPS Intelligence (epoxy/decorative concrete). Return only valid JSON with: summary, recommended_pitch, sales_strategy (object: approach, first_step, follow_up, close_tactic).",
          }, {
            role: "user",
            content: `Company: ${data.company_name}, Location: ${data.city || "FL"} ${data.state}, Vertical: ${data.vertical || "flooring"}, Score: ${score}/100, Website: ${data.website || "none"}, Google: ${data.google_rating || "unknown"}. Return JSON only.`,
          }],
          max_tokens: 512,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
      const llmData = await response.json() as { choices: Array<{ message: { content: string } }> };
      const parsed = JSON.parse(llmData.choices[0].message.content) as Record<string, unknown>;

      intelligence = {
        ...parsed,
        company_name:    data.company_name,
        location:        `${data.city || "FL"}, ${data.state}`,
        score,
        vertical:        normalizedVertical,
        weaknesses,
        opportunity,
        pricing_signals: {
          market_range:    opportunity.pricing_range,
          est_project_val: `$${singleProject.toLocaleString()}`,
          tier:            score >= 75 ? "premium" : score >= 55 ? "mid-market" : "budget",
        },
        method:          "llm",
        generated_at:    new Date().toISOString(),
      };
    } catch {
      // Rule-based fallback
      const pitchMap: Record<string, string> = {
        warehouse:   "Lead with industrial-grade 100% solid epoxy systems. Show cost-per-year-of-service comparison vs. cheaper alternatives and forklift traffic test data.",
        commercial:  "Emphasize commercial project track record, certified applicators, and PM software ensuring zero scheduling surprises. Offer ROI calculator.",
        garage:      "Show metallic epoxy samples. Focus on 5-year warranty and same-day completion with polyaspartic topcoat. Offer financing.",
        decorative:  "Bring sample boards. Position XPS as the premium choice. Target interior designers and architects as referral sources.",
        default:     "Lead with warranty advantage, certified applicators, and free moisture testing. Request a site visit to build a custom proposal.",
      };

      intelligence = {
        company_name:    data.company_name,
        location:        `${data.city || "FL"}, ${data.state}`,
        score,
        vertical:        normalizedVertical,
        summary:         `${data.company_name} is a ${normalizedVertical} flooring contractor in ${data.city || "Florida"} with a lead score of ${score}/100.${data.website ? ` Web: ${data.website}.` : " No website detected."} ${data.google_rating ? `Google: ${data.google_rating}/5.` : ""}`,
        services:        [`${normalizedVertical.charAt(0).toUpperCase() + normalizedVertical.slice(1)} flooring`, "Surface preparation", "Floor coating", score >= 70 ? "Commercial projects" : "Residential projects"],
        weaknesses,
        pricing_signals: {
          market_range:    opportunity.pricing_range,
          est_project_val: `$${singleProject.toLocaleString()}`,
          tier:            score >= 75 ? "premium" : score >= 55 ? "mid-market" : "budget",
        },
        recommended_pitch: pitchMap[normalizedVertical] || pitchMap.default,
        sales_strategy: {
          approach:    score >= 75 ? "consultative" : "value-based",
          first_step:  data.website ? "Review website, then call with personalized insight" : "Cold outreach highlighting digital gap",
          follow_up:   "3-day email with project portfolio + ROI case study",
          close_tactic: ["warehouse", "industrial"].includes(normalizedVertical) ? "Site visit + moisture test offer" : "Free sample board consultation",
        },
        opportunity,
        method:          "rule_based",
        generated_at:    new Date().toISOString(),
      };
    }

    // Store to distillation queue for reuse
    const db = getDb();
    await db.query(
      `INSERT INTO xps_distillation_queue (id, source_type, content) VALUES ($1, $2, $3)`,
      [randomUUID(), "company_intelligence", JSON.stringify(intelligence)]
    ).catch((e: Error) => console.warn("[INTEL] Distillation queue write failed:", e.message));

    res.json(intelligence);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/intelligence/analyze-competitor ───────────────────────────────

const CompetitorSchema = z.object({
  competitor_url: z.string().url(),
});

intelligenceRouter.post("/analyze-competitor", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const { competitor_url } = CompetitorSchema.parse(req.body);
    const user = req.user!;
    const db = getDb();

    // Scrape competitor content
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    let content = "";

    if (firecrawlKey) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { "Authorization": `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: competitor_url, formats: ["markdown"], timeout: 20000 }),
          signal: AbortSignal.timeout(25000),
        });
        if (fcRes.ok) {
          const fcData = await fcRes.json() as { success: boolean; markdown?: string };
          if (fcData.success && fcData.markdown) content = fcData.markdown.slice(0, 6000);
        }
      } catch (err) {
        console.warn("[Intelligence] Firecrawl scrape failed:", (err as Error).message);
      }
    }

    if (!content) {
      try {
        const r = await fetch(competitor_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; XPS-Intelligence/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        const html = await r.text();
        content = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
      } catch {
        content = `Could not scrape ${competitor_url}`;
      }
    }

    const prompt = `Analyze this competitor website for an epoxy flooring company.
URL: ${competitor_url}
Content: ${content}

Return JSON:
{
  "companyName": "name",
  "services": ["service1"],
  "pricing": ["pricing info"],
  "strengths": ["strength1"],
  "weaknesses": ["weakness1"],
  "marketPosition": "description",
  "threatLevel": "low|medium|high",
  "recommendations": ["how to compete with this company"]
}`;

    const aiResult = await callGroqRag(prompt, []);
    let analysis: Record<string, unknown>;
    try {
      const match = aiResult.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) as Record<string, unknown> : { raw: aiResult };
    } catch {
      analysis = { raw: aiResult };
    }

    // Store intelligence report
    const reportId = randomUUID();
    await db.query(
      `INSERT INTO intelligence_reports (id, type, subject, data, created_by) VALUES ($1,'competitor',$2,$3,$4)`,
      [reportId, competitor_url, JSON.stringify({ ...analysis, scrapedAt: new Date().toISOString() }), user.id]
    ).catch(() => {});

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "intelligence.analyze_competitor", "intelligence_report", reportId, JSON.stringify({ url: competitor_url })]
    ).catch(() => {});

    res.json({ report_id: reportId, competitor_url, analysis });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/intelligence/score-lead ────────────────────────────────────────

const ScoreLeadSchema = z.object({
  lead_id: z.string().uuid(),
});

intelligenceRouter.post("/score-lead", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const { lead_id } = ScoreLeadSchema.parse(req.body);
    const db = getDb();
    const user = req.user!;

    const leadResult = await db.query(
      `SELECT id, company_name, email, phone, website, vertical, location, score, notes, metadata
       FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [lead_id]
    );
    if (!leadResult.rows[0]) return res.status(404).json({ error: "Lead not found" });

    const lead = leadResult.rows[0] as Record<string, unknown>;
    const original = Number(lead.score ?? 50);

    // Multi-factor scoring
    const factors: Array<{ factor: string; weight: number; value: number }> = [];
    if (lead.phone) factors.push({ factor: "has_phone", weight: 10, value: 1 });
    if (lead.email) factors.push({ factor: "has_email", weight: 15, value: 1 });
    if (lead.website) factors.push({ factor: "has_website", weight: 8, value: 1 });

    const highValueVerticals = ["epoxy", "concrete", "flooring", "property management", "warehouse"];
    if (highValueVerticals.some((v) => (lead.vertical as string || "").toLowerCase().includes(v))) {
      factors.push({ factor: "high_value_vertical", weight: 12, value: 1 });
    }

    const metadata = (lead.metadata as Record<string, unknown> | null) || {};
    if (metadata.google_rating && Number(metadata.google_rating) >= 4) {
      factors.push({ factor: "high_google_rating", weight: 10, value: 1 });
    }

    const bonus = factors.reduce((s, f) => s + f.weight * f.value, 0);
    const newScore = Math.min(100, original + bonus);

    await db.query("UPDATE leads SET score = $1, updated_at = NOW() WHERE id = $2", [newScore, lead_id]);

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "intelligence.score_lead", "lead", lead_id, JSON.stringify({ original, new_score: newScore, factors })]
    ).catch(() => {});

    res.json({
      lead_id,
      original_score: original,
      new_score: newScore,
      delta: newScore - original,
      factors,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /api/intelligence/demand-report ──────────────────────────────────────

intelligenceRouter.get("/demand-report", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const db = getDb();

    const leadsResult = await db.query(
      `SELECT company_name, vertical, score, location, notes
       FROM leads WHERE deleted_at IS NULL ORDER BY score DESC NULLS LAST LIMIT 100`
    );
    const leads = leadsResult.rows as Array<Record<string, unknown>>;

    // Vertical breakdown
    const verticals: Record<string, number> = {};
    const locations: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.vertical) verticals[lead.vertical as string] = (verticals[lead.vertical as string] ?? 0) + 1;
      const loc = (lead.location as string || "").split(",")[0]?.trim();
      if (loc) locations[loc] = (locations[loc] ?? 0) + 1;
    }

    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((s, l) => s + Number(l.score ?? 50), 0) / leads.length)
      : 0;
    const highScore = leads.filter((l) => Number(l.score ?? 0) > 75).length;

    const signals = [];
    if (highScore >= 5) signals.push({ signal: `${highScore} high-value leads`, category: "high_intent", strength: "strong" });

    const topVertical = Object.entries(verticals).sort((a, b) => b[1] - a[1])[0];
    if (topVertical) signals.push({ signal: `${topVertical[0]}: ${topVertical[1]} prospects`, category: "market_growth", strength: "moderate" });

    res.json({
      generated_at: new Date().toISOString(),
      total_leads: leads.length,
      avg_score: avgScore,
      high_intent_leads: highScore,
      vertical_breakdown: verticals,
      location_breakdown: locations,
      demand_signals: signals,
      top_opportunities: leads.slice(0, 5).map((l) => ({
        company: l.company_name,
        score: l.score,
        location: l.location,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
