#!/usr/bin/env node
/**
 * XPS Intelligence – Optimization Agent
 *
 * Performs recursive optimization analysis:
 *   1. Telemetry collection – query DB for workflow metrics
 *   2. Scoring normalization – ensure lead scores are in 0-100 range
 *   3. Simulation engine – model pricing / messaging / follow-up strategies
 *   4. LLM analysis – Groq-powered bottleneck detection & recommendations
 *   5. Report generation – JSON report with efficiency scores
 *
 * Usage:
 *   node scripts/agents/optimize.mjs
 *   DRY_RUN=true node scripts/agents/optimize.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DRY_RUN       = process.env.DRY_RUN       === "true" || process.argv.includes("--dry-run");
const RUN_SIM       = process.env.RUN_SIMULATION !== "false";
const RUN_SCORING   = process.env.RUN_SCORING    !== "false";
const DB_URL        = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Simulation engine – models different business strategies
// ---------------------------------------------------------------------------
const SIMULATION_STRATEGIES = [
  {
    id:    "aggressive-followup",
    name:  "Aggressive Follow-up (3-day cadence)",
    params: { followup_days: 3, touchpoints: 5, discount_pct: 0 },
  },
  {
    id:    "value-first",
    name:  "Value-First Approach (educational content)",
    params: { followup_days: 7, touchpoints: 3, discount_pct: 0 },
  },
  {
    id:    "discount-close",
    name:  "Discount Close (10% limited offer)",
    params: { followup_days: 5, touchpoints: 4, discount_pct: 10 },
  },
  {
    id:    "multi-channel",
    name:  "Multi-Channel (email + SMS + call)",
    params: { followup_days: 4, touchpoints: 6, discount_pct: 0 },
  },
];

function simulateStrategy(strategy, baseConversionRate = 0.12) {
  const { followup_days, touchpoints, discount_pct } = strategy.params;

  // Model conversion probability adjustments
  let convRate = baseConversionRate;
  convRate += (touchpoints - 3) * 0.015;          // more touchpoints → higher conversion
  convRate -= (followup_days - 4) * 0.008;         // longer gaps → lower conversion
  convRate += discount_pct > 0 ? 0.03 : 0;         // discount boosts short-term close rate
  convRate = Math.max(0.02, Math.min(0.45, convRate));

  const avgDealValue   = 4500;
  const leadPool       = 100;
  const closedDeals    = Math.round(leadPool * convRate);
  const revenue        = closedDeals * avgDealValue * (1 - discount_pct / 100);
  const costPerLead    = 12;
  const roi            = ((revenue - leadPool * costPerLead) / (leadPool * costPerLead)) * 100;

  return {
    strategy_id:       strategy.id,
    strategy_name:     strategy.name,
    conversion_rate:   Math.round(convRate * 1000) / 10, // percent
    closed_deals:      closedDeals,
    projected_revenue: Math.round(revenue),
    roi_pct:           Math.round(roi),
    efficiency_score:  Math.min(10, Math.round((roi / 30) * 10) / 10),
    friction_score:    Math.round((1 / touchpoints) * 10 * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Telemetry – query DB for real metrics (graceful fallback)
// ---------------------------------------------------------------------------
async function collectTelemetry() {
  if (!DB_URL) {
    return {
      source: "fallback",
      leads_total:      0,
      leads_qualified:  0,
      proposals_sent:   0,
      proposals_won:    0,
      avg_score:        0,
      score_out_of_range: 0,
    };
  }

  try {
    const { default: pkg } = await import("pg").catch(() => ({ default: null }));
    if (!pkg) throw new Error("pg not available");

    const { Pool } = pkg;
    const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5000 });

    const [leads, proposals, scores] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='qualified') as qualified FROM leads"),
      pool.query("SELECT status, COUNT(*) as cnt FROM proposals GROUP BY status"),
      pool.query("SELECT AVG(score) as avg, COUNT(*) FILTER (WHERE score < 0 OR score > 100) as out_of_range FROM leads"),
    ]);

    await pool.end();

    const proposalMap = {};
    for (const row of proposals.rows) proposalMap[row.status] = parseInt(row.cnt, 10);

    return {
      source:            "database",
      leads_total:       parseInt(leads.rows[0].total, 10),
      leads_qualified:   parseInt(leads.rows[0].qualified, 10),
      proposals_sent:    proposalMap["sent"] || 0,
      proposals_won:     proposalMap["accepted"] || proposalMap["won"] || 0,
      avg_score:         Math.round(parseFloat(scores.rows[0].avg || "0")),
      score_out_of_range: parseInt(scores.rows[0].out_of_range, 10),
    };
  } catch (err) {
    console.warn("[OPTIMIZE] Telemetry query failed:", err.message);
    return { source: "fallback", leads_total: 0, leads_qualified: 0, proposals_sent: 0, proposals_won: 0, avg_score: 0, score_out_of_range: 0 };
  }
}

// ---------------------------------------------------------------------------
// Score normalization – fix any leads with scores outside 0-100
// ---------------------------------------------------------------------------
async function normalizeScores() {
  if (!DB_URL || !RUN_SCORING) return { fixed: 0 };

  try {
    const { default: pkg } = await import("pg").catch(() => ({ default: null }));
    if (!pkg) return { fixed: 0 };

    const { Pool } = pkg;
    const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5000 });
    const result = await pool.query(`
      UPDATE leads
      SET score = GREATEST(0, LEAST(100, score))
      WHERE score < 0 OR score > 100
      RETURNING id
    `);
    await pool.end();
    return { fixed: result.rowCount };
  } catch {
    return { fixed: 0 };
  }
}

// ---------------------------------------------------------------------------
// LLM analysis via Groq
// ---------------------------------------------------------------------------
async function llmAnalysis(telemetry, simResults) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      bottlenecks:     ["Unable to perform AI analysis – GROQ_API_KEY not configured"],
      recommendations: ["Configure GROQ_API_KEY to enable AI-powered optimization"],
      efficiency_score: 5,
    };
  }

  const prompt = `You are the XPS Intelligence optimization analyst. Analyze these system metrics and provide actionable recommendations.

TELEMETRY:
${JSON.stringify(telemetry, null, 2)}

TOP SIMULATION RESULTS:
${JSON.stringify(simResults.slice(0, 2), null, 2)}

Respond ONLY with valid JSON:
{
  "bottlenecks": ["list of identified bottlenecks"],
  "recommendations": ["list of concrete improvement actions"],
  "efficiency_score": 7.5,
  "priority_action": "single most important action to take now"
}`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}`);
    const data = await resp.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.warn("[OPTIMIZE] LLM analysis failed:", err.message);
    return {
      bottlenecks:     ["LLM analysis unavailable"],
      recommendations: ["Review conversion funnel manually"],
      efficiency_score: 5,
      priority_action:  "Review lead pipeline and follow-up cadence",
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(60));
  console.log("XPS INTELLIGENCE – OPTIMIZATION AGENT");
  console.log("=".repeat(60));
  console.log(`Dry run:    ${DRY_RUN}`);
  console.log(`Simulation: ${RUN_SIM}`);
  console.log(`Scoring:    ${RUN_SCORING}`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  // 1. Collect telemetry
  console.log("\n[OPTIMIZE] Collecting telemetry...");
  const telemetry = await collectTelemetry();
  console.log(`[OPTIMIZE] Telemetry: ${JSON.stringify(telemetry)}`);

  // 2. Normalize scores
  console.log("\n[OPTIMIZE] Normalizing lead scores...");
  const scoring = DRY_RUN ? { fixed: 0 } : await normalizeScores();
  console.log(`[OPTIMIZE] Scores normalized: ${scoring.fixed} records fixed`);

  // 3. Run simulation
  let simResults = [];
  if (RUN_SIM) {
    console.log("\n[OPTIMIZE] Running simulation engine...");
    simResults = SIMULATION_STRATEGIES.map(simulateStrategy);
    simResults.sort((a, b) => b.roi_pct - a.roi_pct);
    console.log(`[OPTIMIZE] Best strategy: ${simResults[0].strategy_name} (ROI: ${simResults[0].roi_pct}%)`);
  }

  // 4. LLM analysis
  console.log("\n[OPTIMIZE] Running LLM analysis...");
  const analysis = DRY_RUN
    ? { bottlenecks: [], recommendations: ["Dry run – LLM skipped"], efficiency_score: 8, priority_action: "N/A" }
    : await llmAnalysis(telemetry, simResults);
  console.log(`[OPTIMIZE] Efficiency score: ${analysis.efficiency_score}/10`);

  const elapsed = Date.now() - startTime;

  // 5. Write report
  const report = {
    agent:     "xps-optimize",
    version:   "1.0.0",
    run_at:    new Date().toISOString(),
    dry_run:   DRY_RUN,
    telemetry,
    scoring_normalization: scoring,
    simulation: simResults,
    analysis,
    telemetry_run: {
      elapsed_ms:    elapsed,
      db_available:  !!DB_URL,
    },
    recursive_loop: {
      next_step:  "ingest → test → analyze → optimize → re-test",
      status:     "ready",
    },
  };

  const reportDir = "reports/optimize";
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `optimize-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== OPTIMIZATION COMPLETE ===");
  console.log(`Efficiency score:  ${analysis.efficiency_score}/10`);
  console.log(`Best strategy:     ${simResults[0]?.strategy_name ?? "N/A"}`);
  console.log(`Priority action:   ${analysis.priority_action ?? "N/A"}`);
  console.log(`Elapsed:           ${elapsed}ms`);
  console.log(`Report:            ${reportPath}`);
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("[OPTIMIZE] Fatal error:", err);
  process.exit(1);
});
