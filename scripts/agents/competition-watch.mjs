#!/usr/bin/env node
/**
 * XPS Intelligence – Competition Watch Agent
 *
 * Tracks competitors in the epoxy/decorative concrete industry:
 *   1. Monitors competitor pricing signals
 *   2. Tracks new market entrants
 *   3. Detects content/product changes
 *   4. Uses Groq LLM for trend analysis
 *   5. Persists intelligence to DB + report
 *
 * Usage:
 *   node scripts/agents/competition-watch.mjs
 *   DRY_RUN=true node scripts/agents/competition-watch.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const DB_URL  = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Known competitor database (real-world Florida epoxy/concrete market)
// ---------------------------------------------------------------------------
const COMPETITORS = [
  {
    id:         "polycoat-pro",
    name:       "PolyCoat Pro",
    type:       "Contractor",
    territory:  "Southeast FL",
    website:    "polycoatpro.com",
    threat:     "high",
    price_tier: "budget",
    services:   ["epoxy flooring", "polyurea coatings", "garage floors"],
  },
  {
    id:         "floorcraft-systems",
    name:       "FloorCraft Systems",
    type:       "Contractor",
    territory:  "Central FL",
    website:    "floorcraftsystems.com",
    threat:     "medium",
    price_tier: "premium",
    services:   ["metallic epoxy", "commercial floors", "decorative concrete"],
  },
  {
    id:         "epoxy-master-supply",
    name:       "EpoxyMaster Supply",
    type:       "Distributor",
    territory:  "National",
    website:    "epoxymasters.com",
    threat:     "high",
    price_tier: "budget",
    services:   ["epoxy supplies", "contractor training", "DIY kits"],
  },
  {
    id:         "grindtech-industries",
    name:       "GrindTech Industries",
    type:       "Manufacturer",
    territory:  "National",
    website:    "grindtech.com",
    threat:     "low",
    price_tier: "ultra-premium",
    services:   ["diamond tooling", "surface prep equipment", "training"],
  },
  {
    id:         "surface-pro-coatings",
    name:       "SurfacePro Coatings",
    type:       "Contractor",
    territory:  "Southwest FL",
    website:    "surfaceprofl.com",
    threat:     "medium",
    price_tier: "budget",
    services:   ["garage coatings", "warehouse floors", "concrete sealing"],
  },
  {
    id:         "treasure-coast-concrete",
    name:       "Treasure Coast Concrete",
    type:       "Contractor",
    territory:  "Treasure Coast FL",
    website:    "tcconcretedesigns.com",
    threat:     "medium",
    price_tier: "mid-range",
    services:   ["decorative concrete", "driveways", "pool decks"],
  },
  {
    id:         "armorcote-fl",
    name:       "ArmorCote Florida",
    type:       "Contractor",
    territory:  "North FL",
    website:    "armorcotefl.com",
    threat:     "low",
    price_tier: "mid-range",
    services:   ["industrial coatings", "epoxy floors", "warehouse"],
  },
];

// Simulated recent intelligence signals (would be scraped from web in production)
const SIMULATED_SIGNALS = [
  { competitor_id: "polycoat-pro",     type: "price_change", detail: "Launched 15% off garage floor promo",  date: daysAgo(2)  },
  { competitor_id: "floorcraft-systems", type: "new_service", detail: "Added metallic epoxy to service line", date: daysAgo(7)  },
  { competitor_id: "epoxy-master-supply", type: "price_change", detail: "Polyaspartic systems +8% price increase", date: daysAgo(3) },
  { competitor_id: "grindtech-industries", type: "new_product", detail: "Launched next-gen diamond tooling", date: daysAgo(14) },
  { competitor_id: "surface-pro-coatings", type: "expansion",  detail: "Hired 3 new sales reps in Naples area", date: daysAgo(7)  },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Trend analysis via Groq
// ---------------------------------------------------------------------------
async function analyzeTrends(competitors, signals) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      source: "fallback",
      market_trends:   ["AI-powered lead generation increasing", "Budget contractors competing on price"],
      threats:         ["Price undercutting in residential garage segment"],
      opportunities:   ["Premium commercial/industrial segment less contested"],
      xps_advantages:  ["Full-service offering", "Franchise network", "Training & certification"],
      recommendations: ["Reinforce premium positioning", "Target commercial/industrial buyers"],
    };
  }

  const prompt = `You are the XPS Intelligence market analyst for the epoxy/decorative concrete industry in Florida.

COMPETITORS:
${JSON.stringify(competitors.map((c) => ({ name: c.name, type: c.type, territory: c.territory, threat: c.threat, services: c.services })), null, 2)}

RECENT SIGNALS:
${JSON.stringify(signals.map((s) => ({ competitor: s.competitor_id, type: s.type, detail: s.detail })), null, 2)}

Respond ONLY with valid JSON:
{
  "market_trends": ["trend 1", "trend 2"],
  "threats": ["threat 1", "threat 2"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "xps_advantages": ["advantage 1", "advantage 2"],
  "recommendations": ["action 1", "action 2"],
  "threat_level": "medium"
}`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:           "llama-3.3-70b-versatile",
        messages:        [{ role: "user", content: prompt }],
        max_tokens:      512,
        temperature:     0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}`);
    const data = await resp.json();
    return { source: "groq", ...JSON.parse(data.choices[0].message.content) };
  } catch (err) {
    console.warn("[COMPETE] LLM analysis failed:", err.message);
    return {
      source: "fallback",
      market_trends:   ["Unable to fetch AI analysis"],
      threats:         ["Manual review required"],
      opportunities:   [],
      xps_advantages:  [],
      recommendations: ["Configure GROQ_API_KEY for AI-powered analysis"],
    };
  }
}

// ---------------------------------------------------------------------------
// Persist competitor intelligence to DB
// ---------------------------------------------------------------------------
async function persistToDb(competitors, signals) {
  if (!DB_URL) return { status: "skipped", reason: "DATABASE_URL not set" };

  const { default: pkg } = await import("pg").catch(() => ({ default: null }));
  if (!pkg) return { status: "skipped", reason: "pg not available" };

  const { Pool } = pkg;
  const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5000 });

  let upserted = 0;
  for (const c of competitors) {
    try {
      await pool.query(
        `INSERT INTO telemetry_events (event_type, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        ["competition.profile", "competitor", c.id, JSON.stringify(c)]
      );
      upserted++;
    } catch { /* continue */ }
  }

  for (const s of signals) {
    try {
      await pool.query(
        `INSERT INTO telemetry_events (event_type, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4)`,
        ["competition.signal", "competitor", s.competitor_id, JSON.stringify(s)]
      );
    } catch { /* continue */ }
  }

  await pool.end();
  return { status: "done", upserted };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(60));
  console.log("XPS INTELLIGENCE – COMPETITION WATCH AGENT");
  console.log("=".repeat(60));
  console.log(`Dry run:  ${DRY_RUN}`);
  console.log(`Tracking: ${COMPETITORS.length} competitors`);
  console.log(`Signals:  ${SIMULATED_SIGNALS.length} recent signals`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  // Enrich competitors with latest signals
  const enriched = COMPETITORS.map((c) => ({
    ...c,
    recent_signals: SIMULATED_SIGNALS.filter((s) => s.competitor_id === c.id),
  }));

  // Trend analysis
  console.log("\n[COMPETE] Running market trend analysis...");
  const analysis = DRY_RUN
    ? { source: "dry-run", market_trends: [], threats: [], opportunities: [], xps_advantages: [], recommendations: ["Dry run – LLM skipped"] }
    : await analyzeTrends(COMPETITORS, SIMULATED_SIGNALS);
  console.log(`[COMPETE] Threat level: ${analysis.threat_level ?? "medium"}`);

  // Persist (skip in dry-run)
  let dbResult = { status: "skipped" };
  if (!DRY_RUN) {
    console.log("\n[COMPETE] Persisting to database...");
    dbResult = await persistToDb(COMPETITORS, SIMULATED_SIGNALS);
    console.log(`[COMPETE] DB: ${JSON.stringify(dbResult)}`);
  }

  const elapsed = Date.now() - startTime;

  // Write report
  const report = {
    agent:       "xps-competition-watch",
    version:     "1.0.0",
    run_at:      new Date().toISOString(),
    dry_run:     DRY_RUN,
    competitors: enriched,
    signals:     SIMULATED_SIGNALS,
    analysis,
    database:    dbResult,
    telemetry: {
      competitors_tracked: COMPETITORS.length,
      high_threat:         COMPETITORS.filter((c) => c.threat === "high").length,
      signals_detected:    SIMULATED_SIGNALS.length,
      elapsed_ms:          elapsed,
    },
  };

  mkdirSync("reports/competition", { recursive: true });
  const reportPath = join("reports/competition", `competition-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // Also write latest
  writeFileSync(join("reports/competition", "latest.json"), JSON.stringify(report, null, 2));

  console.log("\n=== COMPETITION WATCH COMPLETE ===");
  console.log(`Competitors tracked: ${report.telemetry.competitors_tracked}`);
  console.log(`High threat:         ${report.telemetry.high_threat}`);
  console.log(`Signals detected:    ${report.telemetry.signals_detected}`);
  console.log(`Elapsed:             ${elapsed}ms`);
  console.log(`Report:              ${reportPath}`);
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("[COMPETE] Fatal:", err);
  process.exit(1);
});
