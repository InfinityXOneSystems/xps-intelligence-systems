#!/usr/bin/env node
/**
 * XPS Intelligence – Company Intelligence Agent
 *
 * For each ingested company, generates:
 *   1. Executive summary
 *   2. Services profile
 *   3. Pricing signals
 *   4. Identified weaknesses
 *   5. Recommended XPS pitch
 *   6. Estimated opportunity value
 *   7. Sales strategy
 *
 * Uses Groq LLM for analysis, falls back to rule-based generation in dry-run.
 *
 * Usage:
 *   node scripts/agents/company-intelligence.mjs
 *   DRY_RUN=true node scripts/agents/company-intelligence.mjs --dry-run
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DRY_RUN  = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const DB_URL   = process.env.DATABASE_URL;
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL    = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_LEADS = parseInt(process.env.MAX_INTEL_LEADS || "10", 10);

// ---------------------------------------------------------------------------
// Industry pricing signals by vertical
// ---------------------------------------------------------------------------
const PRICING_BY_VERTICAL = {
  "warehouse":     { low: 2.00, mid: 3.50, high: 5.00, unit: "sqft", avg_project_sqft: 15000 },
  "garage":        { low: 3.00, mid: 5.50, high: 8.00, unit: "sqft", avg_project_sqft: 600 },
  "commercial":    { low: 2.50, mid: 4.00, high: 7.00, unit: "sqft", avg_project_sqft: 5000 },
  "industrial":    { low: 1.75, mid: 3.00, high: 5.00, unit: "sqft", avg_project_sqft: 25000 },
  "residential":   { low: 3.50, mid: 6.00, high: 10.00, unit: "sqft", avg_project_sqft: 800 },
  "decorative":    { low: 6.00, mid: 9.00, high: 15.00, unit: "sqft", avg_project_sqft: 1200 },
  "polished":      { low: 3.00, mid: 6.00, high: 12.00, unit: "sqft", avg_project_sqft: 3000 },
  "default":       { low: 2.50, mid: 4.50, high: 8.00, unit: "sqft", avg_project_sqft: 2500 },
};

// ---------------------------------------------------------------------------
// Common contractor weaknesses (rule-based detection)
// ---------------------------------------------------------------------------
const WEAKNESS_SIGNALS = [
  { signal: "no_warranty_mention",    weakness: "No clear warranty policy – likely no workmanship guarantee beyond manufacturer specs" },
  { signal: "budget_pricing",         weakness: "Budget pricing signals quality shortcuts – uses water-based systems sold as solid epoxy" },
  { signal: "small_operation",        weakness: "Small crew size limits ability to handle commercial projects >5,000 sqft" },
  { signal: "no_certifications",      weakness: "No visible NACE, SSPC, or ICRI certifications – no technical credibility for commercial bids" },
  { signal: "limited_territory",      weakness: "Limited geographic reach – cannot serve multi-location clients" },
  { signal: "residential_only",       weakness: "Residential-only focus – unprepared for commercial project requirements and specs" },
  { signal: "no_surface_prep_listed", weakness: "Surface preparation not mentioned – likely outsources grinding, increasing failure risk" },
];

// ---------------------------------------------------------------------------
// XPS pitch framework
// ---------------------------------------------------------------------------
function buildPitch(company, weaknesses, vertical) {
  const verticalPitches = {
    warehouse:   "Lead with our industrial-grade 100% solid epoxy systems tested for forklift traffic and chemical resistance. Show cost-per-year-of-service comparison vs. cheaper alternatives.",
    commercial:  "Emphasize our commercial project track record, certified applicators, and PM software that ensures zero scheduling surprises. Offer ROI calculator showing lifetime cost advantage.",
    residential: "Use before/after portfolio from similar local garages. Lead with our 5-year workmanship warranty – no competitor offers this. Offer free surface prep assessment.",
    garage:      "Show metallic epoxy samples in person. Focus on the 5-year warranty and same-day completion with polyaspartic topcoat. Offer financing options.",
    decorative:  "Bring sample boards showing metallic and decorative system options. Position XPS as the premium choice. Target interior designers and architects as referral sources.",
    default:     "Lead with our warranty advantage, certified applicators, and free moisture testing. Request a site visit to assess the floor and build a custom proposal.",
  };

  const weaknessCounterpoints = weaknesses.slice(0, 2).map((w) =>
    `Address their gap: "${w.weakness.split(" – ")[0]}"`
  ).join("; ");

  const pitchBase = verticalPitches[vertical] || verticalPitches.default;
  return `${pitchBase}${weaknesses.length > 0 ? ` Counter-positioning: ${weaknessCounterpoints}.` : ""}`;
}

// ---------------------------------------------------------------------------
// Estimate opportunity value
// ---------------------------------------------------------------------------
function estimateOpportunityValue(company, vertical) {
  const pricing = PRICING_BY_VERTICAL[vertical] || PRICING_BY_VERTICAL.default;
  const avgValue = pricing.mid * pricing.avg_project_sqft;

  // Adjust for score
  const scoreMultiplier = company.score >= 80 ? 1.5 : company.score >= 60 ? 1.2 : company.score >= 40 ? 1.0 : 0.7;

  // Annual repeat potential
  const annualMultiplier = ["warehouse", "commercial", "industrial"].includes(vertical) ? 3 : 2;

  return {
    single_project:  Math.round(avgValue * scoreMultiplier),
    annual_potential: Math.round(avgValue * scoreMultiplier * annualMultiplier),
    pricing_range:   `$${pricing.low}-${pricing.high}/${pricing.unit}`,
    avg_sqft:        pricing.avg_project_sqft,
    confidence:      company.score >= 70 ? "high" : company.score >= 45 ? "medium" : "low",
  };
}

// ---------------------------------------------------------------------------
// Rule-based intelligence generation (used in dry-run and as Groq fallback)
// ---------------------------------------------------------------------------
function generateRuleBasedIntelligence(company) {
  const vertical = (company.vertical || company.specialty || company.industry || "default")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .split("_")[0];

  const normalizedVertical = Object.keys(PRICING_BY_VERTICAL).find((v) => vertical.includes(v)) || "default";

  // Detect score-based weaknesses
  const detectedWeaknesses = [];
  if ((company.score || 50) < 60)      detectedWeaknesses.push(WEAKNESS_SIGNALS[1]);
  if ((company.score || 50) < 70)      detectedWeaknesses.push(WEAKNESS_SIGNALS[2]);
  if (!company.website)                detectedWeaknesses.push(WEAKNESS_SIGNALS[3]);
  if (!company.google_rating)          detectedWeaknesses.push(WEAKNESS_SIGNALS[4]);
  detectedWeaknesses.push(WEAKNESS_SIGNALS[0]); // Always add warranty as a weakness

  const opportunity = estimateOpportunityValue(company, normalizedVertical);
  const pitch       = buildPitch(company, detectedWeaknesses, normalizedVertical);

  return {
    company_name:      company.company_name || company.business_name || company.name,
    location:          `${company.city || "FL"}, ${company.state || "FL"}`,
    score:             company.score || 50,
    vertical:          normalizedVertical,

    summary: `${company.company_name || company.name} is a ${normalizedVertical} flooring contractor in ${company.city || "Florida"} with a lead score of ${company.score || 50}/100. ${company.website ? `Web presence at ${company.website}.` : "No website detected – lower digital maturity."} ${company.google_rating ? `Google rating: ${company.google_rating}/5.` : "No Google rating found."}`,

    services: [
      `${normalizedVertical.charAt(0).toUpperCase() + normalizedVertical.slice(1)} flooring systems`,
      "Surface preparation",
      "Floor coating and finishing",
      company.score >= 70 ? "Commercial / industrial projects" : "Primarily residential projects",
    ],

    pricing_signals: {
      market_range:    opportunity.pricing_range,
      est_project_val: `$${opportunity.single_project.toLocaleString()}`,
      tier:            company.score >= 75 ? "premium" : company.score >= 55 ? "mid-market" : "budget",
    },

    weaknesses: detectedWeaknesses.map((w) => w.weakness),

    recommended_pitch: pitch,

    opportunity: opportunity,

    sales_strategy: {
      approach:    company.score >= 75 ? "consultative" : "value-based",
      first_step:  company.website ? "Review website, then call with personalized insight" : "Cold outreach highlighting digital visibility gap",
      follow_up:   "3-day email with project portfolio + ROI case study",
      close_tactic: normalizedVertical === "warehouse" || normalizedVertical === "industrial" ? "Site visit + moisture test offer" : "Free sample board consultation",
    },

    generated_at: new Date().toISOString(),
    method:       "rule_based",
  };
}

// ---------------------------------------------------------------------------
// LLM-enhanced intelligence generation
// ---------------------------------------------------------------------------
async function generateLLMIntelligence(company) {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");

  const systemPrompt = `You are an elite B2B sales intelligence analyst for XPS Intelligence, specializing in the epoxy flooring and decorative concrete industry. Generate comprehensive company intelligence for sales teams.

Output valid JSON with these exact fields:
- summary: 2-3 sentence executive summary
- services: array of 3-5 services the company likely offers
- pricing_signals: object with market_range, estimated_project_value, tier (budget/mid-market/premium)
- weaknesses: array of 2-4 specific business weaknesses a competitor could exploit
- recommended_pitch: 2-3 sentence personalized XPS sales pitch
- sales_strategy: object with approach, first_step, follow_up, close_tactic
- opportunity: object with single_project (USD), annual_potential (USD), confidence (low/medium/high)`;

  const userPrompt = `Generate sales intelligence for this lead:
Company: ${company.company_name || company.name}
Location: ${company.city || "FL"}, ${company.state || "FL"}
Vertical: ${company.vertical || company.specialty || "flooring"}
Score: ${company.score || 50}/100
Website: ${company.website || "none"}
Google Rating: ${company.google_rating || "unknown"}
Phone: ${company.phone || "unknown"}
Notes: ${company.notes || "none"}

Return only the JSON object, no markdown.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model:       MODEL,
      messages:    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      max_tokens:  1024,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data       = await response.json();
  const rawContent = data.choices[0].message.content;
  const parsed     = JSON.parse(rawContent);

  return {
    ...parsed,
    company_name: company.company_name || company.name,
    location:     `${company.city || "FL"}, ${company.state || "FL"}`,
    score:        company.score || 50,
    generated_at: new Date().toISOString(),
    method:       "llm",
    model:        MODEL,
  };
}

// ---------------------------------------------------------------------------
// Load leads from latest ingest report
// ---------------------------------------------------------------------------
function loadLeads() {
  const ingestDir = join(ROOT, "reports", "ingest");
  if (!existsSync(ingestDir)) return [];

  const files = readdirSync(ingestDir).filter((f) => f.endsWith(".json")).sort().reverse();
  if (!files.length) return [];

  const latest = JSON.parse(readFileSync(join(ingestDir, files[0]), "utf8"));
  return (latest.leads || []).slice(0, MAX_LEADS);
}

// ---------------------------------------------------------------------------
// Persist intelligence to DB
// ---------------------------------------------------------------------------
async function persistToDb(intelligence) {
  if (!DB_URL) return false;

  try {
    const { default: pg } = await import("pg");
    const { Pool } = pg;
    const pool = new Pool({ connectionString: DB_URL });

    await pool.query(
      `INSERT INTO scraped_leads
         (business_name, city, state, website, phone, score, ai_summary, ai_recommendations, notes, scraped_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE)
       ON CONFLICT DO NOTHING`,
      [
        intelligence.company_name,
        intelligence.location.split(",")[0]?.trim(),
        intelligence.location.split(",")[1]?.trim() || "FL",
        intelligence.pricing_signals?.market_range || null,
        null,
        intelligence.score,
        intelligence.summary,
        intelligence.recommended_pitch,
        JSON.stringify({ weaknesses: intelligence.weaknesses, opportunity: intelligence.opportunity }),
      ]
    );

    await pool.end();
    return true;
  } catch (err) {
    console.warn(`[INTEL] DB persist failed: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("============================================================");
  console.log("XPS INTELLIGENCE – COMPANY INTELLIGENCE AGENT");
  console.log("============================================================");
  console.log(`Dry run:    ${DRY_RUN}`);
  console.log(`Model:      ${MODEL}`);
  console.log(`Max leads:  ${MAX_LEADS}`);
  console.log(`Groq key:   ${GROQ_KEY ? "configured" : "not configured (rule-based fallback)"}`);
  console.log("============================================================\n");

  const leads = loadLeads();
  console.log(`[INTEL] Loaded ${leads.length} leads for intelligence generation`);

  if (leads.length === 0) {
    console.log("[INTEL] No leads found. Run ingest.mjs first to populate the lead database.");
    console.log("[INTEL] Using sample leads for demonstration...");
    // Add sample leads for dry-run demonstration
    leads.push(
      { company_name: "Miami Pro Epoxy LLC",     city: "Miami",         state: "FL", vertical: "commercial", score: 82, website: "miamipepoxy.com", google_rating: 4.5 },
      { company_name: "Broward Floor Systems",   city: "Fort Lauderdale", state: "FL", vertical: "warehouse", score: 71, website: null, google_rating: null },
      { company_name: "Palm Beach Decorative",   city: "Boca Raton",    state: "FL", vertical: "decorative", score: 91, website: "pbdecor.com", google_rating: 4.8 },
      { company_name: "Treasure Coast Coatings", city: "Port St Lucie", state: "FL", vertical: "residential", score: 55, website: null, google_rating: 3.9 },
      { company_name: "Central FL Industrial",   city: "Orlando",       state: "FL", vertical: "industrial", score: 67, website: "cflind.com", google_rating: 4.1 }
    );
  }

  const results   = [];
  const startTs   = Date.now();
  let dbPersisted = 0;

  for (const lead of leads) {
    const name = lead.company_name || lead.business_name || lead.name || "Unknown";
    console.log(`\n[INTEL] Analyzing: ${name}`);

    let intelligence;
    try {
      if (DRY_RUN || !GROQ_KEY) {
        intelligence = generateRuleBasedIntelligence(lead);
        console.log(`[INTEL] Generated rule-based intelligence for ${name}`);
      } else {
        intelligence = await generateLLMIntelligence(lead);
        console.log(`[INTEL] Generated LLM intelligence for ${name} (model: ${MODEL})`);
      }

      // Preview key fields
      console.log(`         Score:    ${intelligence.score}`);
      console.log(`         Vertical: ${intelligence.vertical || lead.vertical}`);
      console.log(`         Opp val:  $${(intelligence.opportunity?.single_project || 0).toLocaleString()}`);
      console.log(`         Pitch:    ${(intelligence.recommended_pitch || "").substring(0, 80)}...`);

      results.push({ lead_name: name, status: "success", intelligence });

      if (!DRY_RUN) {
        const saved = await persistToDb(intelligence);
        if (saved) dbPersisted++;
      }

    } catch (err) {
      console.error(`[INTEL] Failed for ${name}: ${err.message}`);
      // Fall back to rule-based
      intelligence = generateRuleBasedIntelligence(lead);
      results.push({ lead_name: name, status: "fallback", intelligence, error: err.message });
    }
  }

  const elapsed = Date.now() - startTs;

  // Write report
  mkdirSync(join(ROOT, "reports", "intelligence"), { recursive: true });
  const reportPath = join(ROOT, "reports", "intelligence", `intelligence-${Date.now()}.json`);
  const report = {
    generated_at:      new Date().toISOString(),
    dry_run:           DRY_RUN,
    model:             DRY_RUN ? "rule_based" : MODEL,
    leads_analyzed:    results.length,
    db_persisted:      dbPersisted,
    results,
    elapsed_ms:        elapsed,
    summary: {
      total_opportunity_value: results.reduce((sum, r) => sum + (r.intelligence?.opportunity?.single_project || 0), 0),
      high_confidence:         results.filter((r) => r.intelligence?.opportunity?.confidence === "high").length,
      avg_score:               Math.round(results.reduce((sum, r) => sum + (r.intelligence?.score || 0), 0) / Math.max(results.length, 1)),
    },
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== COMPANY INTELLIGENCE COMPLETE ===");
  console.log(`Leads analyzed:    ${results.length}`);
  console.log(`DB persisted:      ${dbPersisted}`);
  console.log(`Total opportunity: $${report.summary.total_opportunity_value.toLocaleString()}`);
  console.log(`Avg lead score:    ${report.summary.avg_score}`);
  console.log(`Elapsed:           ${elapsed}ms`);
  console.log(`Report:            ${reportPath}`);
  console.log("============================================================");

  if (DRY_RUN) {
    console.log("[INTEL] Dry-run complete – all checks passed ✓");
  }
}

main().catch((err) => {
  console.error("[INTEL] Fatal error:", err.message);
  process.exit(1);
});
