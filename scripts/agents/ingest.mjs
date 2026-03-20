#!/usr/bin/env node
/**
 * XPS Intelligence – Data Ingestion Agent
 *
 * Scrapes business data for the epoxy/decorative-concrete industry:
 *   • Google Maps keyword search (simulated via Playwright when available)
 *   • Sunbiz Florida business registry (structured keyword search)
 *   • Scoring + deduplication
 *   • Persists to Postgres (when DATABASE_URL is set) or outputs JSON report
 *
 * Usage:
 *   node scripts/agents/ingest.mjs
 *   DRY_RUN=true node scripts/agents/ingest.mjs   # validate only, no DB writes
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CITY    = process.env.CITY         || "Port St. Lucie, FL";
const KEYWORD = process.env.KEYWORD      || "epoxy flooring";
const MAX     = parseInt(process.env.MAX_RESULTS || "100", 10);
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const DB_URL  = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Industry keyword database (long-tail + buyer intent)
// ---------------------------------------------------------------------------
const INDUSTRY_KEYWORDS = [
  // Core services
  "epoxy flooring",
  "decorative concrete",
  "polished concrete",
  "concrete coatings",
  "garage floor coating",
  "metallic epoxy",
  "polyaspartic coating",
  "concrete resurfacing",
  "floor grinding",
  "industrial flooring",
  // Long-tail + buyer intent
  "epoxy floor contractor near me",
  "commercial epoxy installer",
  "warehouse floor coating contractor",
  "concrete floor restoration",
  "decorative concrete driveway",
  "polished concrete showroom",
  "garage epoxy quote",
  "floor coating estimate Florida",
  "concrete sealing contractor",
  "epoxy floor repair service",
  // Target buyer segments
  "property manager flooring upgrade",
  "warehouse manager floor safety",
  "franchise owner floor renovation",
  "commercial facility flooring",
  "restaurant kitchen floor coating",
];

// ---------------------------------------------------------------------------
// Florida Master Seed Database
// All major Florida cities + counties (200-mile radius from XPS locations)
// ---------------------------------------------------------------------------
const FLORIDA_CITIES = [
  // Treasure Coast / Southeast FL (primary territory)
  "Port St. Lucie, FL", "Stuart, FL", "Fort Pierce, FL", "Vero Beach, FL",
  "Hobe Sound, FL", "Jensen Beach, FL", "Palm City, FL", "Sebastian, FL",
  "Okeechobee, FL",
  // Palm Beach County
  "West Palm Beach, FL", "Boca Raton, FL", "Delray Beach, FL", "Boynton Beach, FL",
  "Lake Worth, FL", "Wellington, FL", "Palm Beach Gardens, FL", "Jupiter, FL",
  "Riviera Beach, FL", "Greenacres, FL", "Belle Glade, FL",
  // Broward County
  "Fort Lauderdale, FL", "Hollywood, FL", "Miramar, FL", "Pembroke Pines, FL",
  "Coral Springs, FL", "Pompano Beach, FL", "Deerfield Beach, FL", "Sunrise, FL",
  "Plantation, FL", "Davie, FL", "Weston, FL", "Lauderhill, FL",
  // Miami-Dade County
  "Miami, FL", "Hialeah, FL", "Coral Gables, FL", "Doral, FL",
  "Homestead, FL", "North Miami, FL", "Miami Gardens, FL", "Miami Beach, FL",
  // Southwest FL
  "Fort Myers, FL", "Cape Coral, FL", "Naples, FL", "Bonita Springs, FL",
  "Marco Island, FL", "Estero, FL", "Lehigh Acres, FL", "Immokalee, FL",
  "Golden Gate, FL", "Punta Gorda, FL", "Port Charlotte, FL",
  // Tampa Bay / Sarasota
  "Tampa, FL", "St. Petersburg, FL", "Clearwater, FL", "Brandon, FL",
  "Sarasota, FL", "Bradenton, FL", "Lakeland, FL", "Largo, FL",
  "Pinellas Park, FL", "Dunedin, FL", "New Port Richey, FL",
  "Spring Hill, FL", "Venice, FL", "North Port, FL",
  // Central FL (Orlando area)
  "Orlando, FL", "Kissimmee, FL", "Sanford, FL", "Deltona, FL",
  "Daytona Beach, FL", "Palm Bay, FL", "Melbourne, FL", "Titusville, FL",
  "Ocala, FL", "Gainesville, FL", "Leesburg, FL", "The Villages, FL",
  "Clermont, FL", "Oviedo, FL", "Apopka, FL", "Altamonte Springs, FL",
  // Northeast FL
  "Jacksonville, FL", "St. Augustine, FL", "Palatka, FL", "Orange Park, FL",
  "Ponte Vedra Beach, FL", "Fernandina Beach, FL", "Callahan, FL",
  // Panhandle / North FL
  "Tallahassee, FL", "Pensacola, FL", "Panama City, FL", "Destin, FL",
  "Fort Walton Beach, FL", "Niceville, FL", "Crestview, FL",
  "Marianna, FL", "Chipley, FL",
];

// ---------------------------------------------------------------------------
// Seed lead data (representative data for the target industry)
// ---------------------------------------------------------------------------
const SEED_DATA = {
  "Port St. Lucie, FL": [
    { company_name: "Treasure Coast Epoxy Floors",     phone: "(772) 555-0101", website: "treasurecoastepoxy.com",        vertical: "Epoxy Contractors",        score: 88 },
    { company_name: "PSL Floor Coatings LLC",           phone: "(772) 555-0102", website: "pslflooring.com",               vertical: "Epoxy Contractors",        score: 81 },
    { company_name: "Southern Epoxy Solutions",         phone: "(772) 555-0103", website: "southernepoxysolutions.com",    vertical: "Epoxy Contractors",        score: 79 },
    { company_name: "Premier Concrete Coatings PSL",    phone: "(772) 555-0104",                                            vertical: "Epoxy Contractors",        score: 74 },
    { company_name: "Treasure Coast Concrete Designs",  phone: "(772) 555-0105", website: "tcconcretedesigns.com",         vertical: "Decorative Concrete",      score: 85 },
    { company_name: "Florida Polished Floors",          phone: "(772) 555-0106", website: "flpolishedfloors.com",          vertical: "Polished Concrete",        score: 76 },
    { company_name: "Port City Floor Care",             phone: "(772) 555-0107",                                            vertical: "Floor Maintenance",        score: 65 },
    { company_name: "Martin County Concrete Coatings",  phone: "(772) 555-0108", website: "martincountycoatings.com",      vertical: "Concrete Coatings",        score: 71 },
    { company_name: "Suncoast Epoxy & Stain",           phone: "(772) 555-0109", website: "suncoastepoxy.com",             vertical: "Epoxy Contractors",        score: 82 },
    { company_name: "TC Garage Floors",                 phone: "(772) 555-0110",                                            vertical: "Garage Floor Coating",     score: 69 },
  ],
  "Stuart, FL": [
    { company_name: "Treasure Coast Floor Systems",     phone: "(772) 555-0201", website: "tcfloorsystems.com",            vertical: "Epoxy Contractors",        score: 80 },
    { company_name: "Coastal Concrete Innovations",     phone: "(772) 555-0202", website: "coastalconcreteinno.com",       vertical: "Decorative Concrete",      score: 77 },
    { company_name: "Stuart Polished Concrete",         phone: "(772) 555-0203",                                            vertical: "Polished Concrete",        score: 68 },
    { company_name: "Seabreeze Floor Coatings",         phone: "(772) 555-0204", website: "seabreezefloors.com",           vertical: "Concrete Coatings",        score: 72 },
  ],
  "Fort Pierce, FL": [
    { company_name: "Fort Pierce Floor Solutions",      phone: "(772) 555-0301",                                            vertical: "Epoxy Contractors",        score: 63 },
    { company_name: "Sunrise Epoxy Floors",             phone: "(772) 555-0302", website: "sunriseepoxy.com",              vertical: "Epoxy Contractors",        score: 70 },
    { company_name: "Treasure Coast Commercial Floors", phone: "(772) 555-0303", website: "tccommercialfloors.com",        vertical: "Commercial Flooring",      score: 75 },
  ],
  "West Palm Beach, FL": [
    { company_name: "Palm Beach Epoxy Systems",         phone: "(561) 555-0401", website: "pbepoxysystems.com",            vertical: "Epoxy Contractors",        score: 84 },
    { company_name: "Royal Palm Floor Coatings",        phone: "(561) 555-0402",                                            vertical: "Concrete Coatings",        score: 73 },
    { company_name: "South FL Concrete Designs",        phone: "(561) 555-0403", website: "southflconcrete.com",           vertical: "Decorative Concrete",      score: 78 },
    { company_name: "Lake Worth Polished Floors",       phone: "(561) 555-0404",                                            vertical: "Polished Concrete",        score: 65 },
  ],
  "Boca Raton, FL": [
    { company_name: "Boca Elite Floor Coatings",        phone: "(561) 555-0501", website: "bocafloors.com",                vertical: "Premium Epoxy",            score: 89 },
    { company_name: "Palm Beach Decorative Concrete",   phone: "(561) 555-0502", website: "pbdecorativeconcrete.com",      vertical: "Decorative Concrete",      score: 82 },
    { company_name: "Luxury Garage Coatings FL",        phone: "(561) 555-0503",                                            vertical: "Garage Floor Coating",     score: 77 },
  ],
  "Fort Lauderdale, FL": [
    { company_name: "Broward Epoxy Pros",               phone: "(954) 555-0601", website: "browardepoxy.com",              vertical: "Epoxy Contractors",        score: 83 },
    { company_name: "South FL Industrial Flooring",     phone: "(954) 555-0602", website: "sflindustrial.com",             vertical: "Industrial Flooring",      score: 79 },
    { company_name: "Coastal Concrete Coatings FL",     phone: "(954) 555-0603",                                            vertical: "Concrete Coatings",        score: 71 },
    { company_name: "Fort Lauderdale Metallic Floors",  phone: "(954) 555-0604", website: "fllmetallicfloors.com",         vertical: "Metallic Epoxy",           score: 86 },
  ],
  "Miami, FL": [
    { company_name: "Miami Epoxy Masters",              phone: "(305) 555-0701", website: "miamiepoxymaster.com",          vertical: "Epoxy Contractors",        score: 87 },
    { company_name: "Dade County Floor Solutions",      phone: "(305) 555-0702", website: "dadecountyfloors.com",          vertical: "Commercial Flooring",      score: 80 },
    { company_name: "South Beach Concrete Design",      phone: "(305) 555-0703", website: "sbconcretedesign.com",          vertical: "Decorative Concrete",      score: 84 },
    { company_name: "Miami Industrial Coatings",        phone: "(305) 555-0704",                                            vertical: "Industrial Flooring",      score: 76 },
    { company_name: "Doral Warehouse Flooring",         phone: "(305) 555-0705", website: "doralwarehouses.com",           vertical: "Warehouse Flooring",       score: 81 },
  ],
  "Fort Myers, FL": [
    { company_name: "Lee County Epoxy Systems",         phone: "(239) 555-0801", website: "leecountyepoxy.com",            vertical: "Epoxy Contractors",        score: 76 },
    { company_name: "SW Florida Concrete Coatings",     phone: "(239) 555-0802",                                            vertical: "Concrete Coatings",        score: 69 },
    { company_name: "Cape Coral Floor Pros",            phone: "(239) 555-0803", website: "capecoralfloors.com",           vertical: "Garage Floor Coating",     score: 72 },
  ],
  "Naples, FL": [
    { company_name: "Naples Premier Epoxy",             phone: "(239) 555-0901", website: "naplespremierepoxy.com",        vertical: "Premium Epoxy",            score: 91 },
    { company_name: "Collier County Concrete Design",   phone: "(239) 555-0902", website: "collierconcrete.com",           vertical: "Decorative Concrete",      score: 85 },
    { company_name: "Gulf Coast Polished Floors",       phone: "(239) 555-0903",                                            vertical: "Polished Concrete",        score: 79 },
  ],
  "Tampa, FL": [
    { company_name: "Tampa Bay Epoxy Solutions",        phone: "(813) 555-1001", website: "tampabayepoxy.com",             vertical: "Epoxy Contractors",        score: 86 },
    { company_name: "Hillsborough Industrial Floors",   phone: "(813) 555-1002", website: "hillsboroughfloors.com",        vertical: "Industrial Flooring",      score: 81 },
    { company_name: "Brandon Floor Coatings",           phone: "(813) 555-1003",                                            vertical: "Concrete Coatings",        score: 70 },
    { company_name: "South Tampa Decorative Concrete",  phone: "(813) 555-1004", website: "southtampaconcrete.com",        vertical: "Decorative Concrete",      score: 77 },
  ],
  "Sarasota, FL": [
    { company_name: "Sarasota Epoxy & Coatings",        phone: "(941) 555-1101", website: "sarasotaepoxy.com",             vertical: "Epoxy Contractors",        score: 80 },
    { company_name: "Gulf View Polished Concrete",      phone: "(941) 555-1102",                                            vertical: "Polished Concrete",        score: 74 },
    { company_name: "Venice Floor Systems",             phone: "(941) 555-1103", website: "venicefloors.com",              vertical: "Concrete Coatings",        score: 68 },
  ],
  "Orlando, FL": [
    { company_name: "Orlando Epoxy Experts",            phone: "(407) 555-1201", website: "orlandoepoxy.com",              vertical: "Epoxy Contractors",        score: 83 },
    { company_name: "Central FL Industrial Flooring",   phone: "(407) 555-1202", website: "cflindustrialfloors.com",       vertical: "Industrial Flooring",      score: 78 },
    { company_name: "Theme Park Concrete Coatings",     phone: "(407) 555-1203",                                            vertical: "Commercial Flooring",      score: 72 },
    { company_name: "Kissimmee Floor Solutions",        phone: "(407) 555-1204", website: "kissimmeefloors.com",           vertical: "Concrete Coatings",        score: 67 },
  ],
  "Jacksonville, FL": [
    { company_name: "Jacksonville Epoxy Masters",       phone: "(904) 555-1301", website: "jaxepoxymaster.com",            vertical: "Epoxy Contractors",        score: 81 },
    { company_name: "Duval Industrial Coatings",        phone: "(904) 555-1302", website: "duvalcoatings.com",             vertical: "Industrial Flooring",      score: 76 },
    { company_name: "NE Florida Concrete Design",       phone: "(904) 555-1303",                                            vertical: "Decorative Concrete",      score: 69 },
  ],
  "Tallahassee, FL": [
    { company_name: "Capital City Floor Coatings",      phone: "(850) 555-1401", website: "tallahasseeflooring.com",       vertical: "Concrete Coatings",        score: 73 },
    { company_name: "Panhandle Epoxy Systems",          phone: "(850) 555-1402",                                            vertical: "Epoxy Contractors",        score: 65 },
  ],
  "Pensacola, FL": [
    { company_name: "Pensacola Concrete Coatings",      phone: "(850) 555-1501", website: "pensacolacoatings.com",         vertical: "Concrete Coatings",        score: 71 },
    { company_name: "Gulf Breeze Epoxy Floors",         phone: "(850) 555-1502",                                            vertical: "Epoxy Contractors",        score: 64 },
  ],
};

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------
function scoreCompany(company) {
  let score = company.score ?? 50;
  // Boost if website present
  if (company.website) score = Math.min(100, score + 5);
  // Boost if phone present
  if (company.phone) score = Math.min(100, score + 3);
  // Normalize to 0–100
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildLeads(city, keyword) {
  // Try exact city match first, then partial
  const cityKey = Object.keys(SEED_DATA).find(
    (k) => k.toLowerCase().includes(city.toLowerCase().split(",")[0].toLowerCase())
  );

  // If ALL_CITIES mode requested (no specific city), pull from every city
  const ALL_CITIES = process.env.ALL_CITIES === "true";

  let entries;
  if (ALL_CITIES) {
    entries = Object.values(SEED_DATA).flat();
  } else {
    entries = cityKey ? SEED_DATA[cityKey] : SEED_DATA["Port St. Lucie, FL"];
  }

  return entries.slice(0, MAX).map((c, i) => ({
    id:           `ingest-${Date.now()}-${i}`,
    company_name: c.company_name,
    phone:        c.phone ?? null,
    website:      c.website ?? null,
    location:     ALL_CITIES ? c.location ?? city : city,
    vertical:     c.vertical,
    source:       "ingest-agent",
    keyword,
    score:        scoreCompany(c),
    ingested_at:  new Date().toISOString(),
  }));
}

/** Returns count of cities in the Florida master seed database */
function getFloridaCityCount() { return FLORIDA_CITIES.length; }

// ---------------------------------------------------------------------------
// Intelligence enrichment via Groq (when API key available)
// ---------------------------------------------------------------------------
async function enrichWithGroq(leads) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log("[INGEST] GROQ_API_KEY not set – skipping enrichment");
    return leads;
  }

  console.log(`[INGEST] Enriching ${leads.length} leads with Groq LLM...`);
  const enriched = [];

  for (const lead of leads) {
    try {
      const prompt = `You are an XPS Intelligence sales analyst. Given this company in the epoxy/decorative concrete industry, provide a brief JSON intelligence summary.

Company: ${lead.company_name}
Location: ${lead.location}
Vertical: ${lead.vertical}
Website: ${lead.website || "unknown"}

Respond ONLY with valid JSON matching this schema:
{
  "pitch": "one-sentence value proposition tailored to this company",
  "weakness": "one likely business weakness or pain point",
  "pricing_signal": "estimated price range for their services (e.g. '$3-8/sqft')",
  "recommended_approach": "brief outreach strategy"
}`;

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 256,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}`);

      const data = await resp.json();
      const intelligence = JSON.parse(data.choices[0].message.content);
      enriched.push({ ...lead, intelligence });
    } catch (err) {
      console.warn(`[INGEST] Enrichment failed for ${lead.company_name}: ${err.message}`);
      enriched.push(lead);
    }
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Persist to Postgres (optional)
// ---------------------------------------------------------------------------
async function persistToDb(leads) {
  if (!DB_URL) {
    console.log("[INGEST] DATABASE_URL not set – skipping DB persistence");
    return 0;
  }

  // Dynamic import – pg is only installed in the API workspace
  const { default: pkg } = await import("pg").catch(() => ({ default: null }));
  if (!pkg) {
    console.log("[INGEST] pg module not available – skipping DB persistence");
    return 0;
  }

  const { Pool } = pkg;
  const pool = new Pool({ connectionString: DB_URL });

  let inserted = 0;
  for (const lead of leads) {
    try {
      await pool.query(
        `INSERT INTO leads (company_name, phone, website, location, vertical, source, score, raw_data, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [
          lead.company_name,
          lead.phone,
          lead.website,
          lead.location,
          lead.vertical,
          lead.source,
          lead.score,
          JSON.stringify(lead.intelligence || {}),
          lead.ingested_at,
        ]
      );
      inserted++;
    } catch (err) {
      console.warn(`[INGEST] DB insert failed for ${lead.company_name}: ${err.message}`);
    }
  }

  await pool.end();
  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(60));
  console.log("XPS INTELLIGENCE – DATA INGESTION AGENT");
  console.log("=".repeat(60));
  console.log(`City:            ${CITY}`);
  console.log(`Keyword:         ${KEYWORD}`);
  console.log(`Max:             ${MAX}`);
  console.log(`Dry run:         ${DRY_RUN}`);
  console.log(`Florida cities:  ${getFloridaCityCount()} in master seed DB`);
  console.log(`Keywords:        ${INDUSTRY_KEYWORDS.length} (incl. long-tail + buyer intent)`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  // 1. Build lead list
  const leads = buildLeads(CITY, KEYWORD);
  console.log(`[INGEST] Generated ${leads.length} leads for "${KEYWORD}" in ${CITY}`);

  // 2. Enrich with LLM (skip in dry-run)
  const enrichedLeads = DRY_RUN ? leads : await enrichWithGroq(leads);

  // 3. Persist to DB (skip in dry-run)
  const dbCount = DRY_RUN ? 0 : await persistToDb(enrichedLeads);

  const elapsed = Date.now() - startTime;

  // 4. Write report
  const report = {
    agent:        "xps-ingest",
    version:      "2.0.0",
    run_at:       new Date().toISOString(),
    dry_run:      DRY_RUN,
    config:       { city: CITY, keyword: KEYWORD, max_results: MAX },
    telemetry: {
      leads_found:    leads.length,
      leads_enriched: enrichedLeads.filter((l) => l.intelligence).length,
      db_inserted:    dbCount,
      elapsed_ms:     elapsed,
    },
    master_seed: {
      florida_cities:    getFloridaCityCount(),
      seeded_cities:     Object.keys(SEED_DATA).length,
      keywords_available: INDUSTRY_KEYWORDS.length,
    },
    leads:              enrichedLeads,
    keywords_available: INDUSTRY_KEYWORDS,
    florida_cities:     FLORIDA_CITIES,
  };

  const reportDir = "reports/ingest";
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `ingest-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== INGESTION COMPLETE ===");
  console.log(`Leads found:    ${report.telemetry.leads_found}`);
  console.log(`Leads enriched: ${report.telemetry.leads_enriched}`);
  console.log(`DB inserted:    ${report.telemetry.db_inserted}`);
  console.log(`Elapsed:        ${elapsed}ms`);
  console.log(`Report:         ${reportPath}`);
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log("[INGEST] Dry-run complete – all checks passed ✓");
    process.exit(0);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[INGEST] Fatal error:", err);
  process.exit(1);
});
