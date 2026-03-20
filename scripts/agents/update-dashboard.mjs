#!/usr/bin/env node
/**
 * XPS Intelligence – GitHub Pages Dashboard Updater
 *
 * Reads the latest operation/ingest/optimize reports and generates
 * an up-to-date static HTML dashboard in docs/dashboard/index.html.
 *
 * Usage:
 *   node scripts/agents/update-dashboard.mjs
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const DASHBOARD_DIR = "docs/dashboard";

function readLatest(path) {
  if (existsSync(path)) {
    try { return JSON.parse(readFileSync(path, "utf8")); } catch { /* ignore */ }
  }
  return null;
}

const operateReport    = readLatest("reports/operate/latest.json");
const ingestFiles      = existsSync("reports/ingest") ?
  readdirSync("reports/ingest").filter((f) => f.endsWith(".json") && f !== ".gitkeep")
    .sort().reverse().slice(0, 1) : [];
const ingestReport     = ingestFiles.length > 0 ? readLatest(join("reports/ingest", ingestFiles[0])) : null;
const optimizeFiles    = existsSync("reports/optimize") ?
  readdirSync("reports/optimize").filter((f) => f.endsWith(".json") && f !== ".gitkeep")
    .sort().reverse().slice(0, 1) : [];
const optimizeReport   = optimizeFiles.length > 0 ? readLatest(join("reports/optimize", optimizeFiles[0])) : null;
const competeReport    = readLatest("reports/competition/latest.json");

// LLM Intelligence reports
const ragFiles         = existsSync("reports/rag") ?
  readdirSync("reports/rag").filter((f) => f.endsWith(".json") && f !== ".gitkeep")
    .sort().reverse().slice(0, 1) : [];
const ragReport        = ragFiles.length > 0 ? readLatest(join("reports/rag", ragFiles[0])) : null;
const intelFiles       = existsSync("reports/intelligence") ?
  readdirSync("reports/intelligence").filter((f) => f.endsWith(".json") && f !== ".gitkeep")
    .sort().reverse().slice(0, 1) : [];
const intelReport      = intelFiles.length > 0 ? readLatest(join("reports/intelligence", intelFiles[0])) : null;

const now = new Date().toISOString();

const metrics = {
  efficiency:    operateReport?.telemetry?.efficiency_score  ?? "N/A",
  friction:      operateReport?.telemetry?.friction_score    ?? "N/A",
  steps_passed:  operateReport?.telemetry?.passed            ?? "N/A",
  steps_total:   operateReport?.telemetry?.total_steps       ?? "N/A",
  leads_found:   ingestReport?.telemetry?.leads_found        ?? "N/A",
  best_strategy: optimizeReport?.simulation?.[0]?.strategy_name ?? "N/A",
  roi_pct:       optimizeReport?.simulation?.[0]?.roi_pct    ?? "N/A",
  competitors:   competeReport?.telemetry?.competitors_tracked ?? "N/A",
  last_run:      operateReport?.run_at ?? now,
  // LLM Intelligence metrics
  rag_queries:        ragReport?.queries_run        ?? "N/A",
  rag_kb_docs:        ragReport?.total_docs         ?? "N/A",
  rag_model:          ragReport?.model              ?? "llama-3.3-70b-versatile",
  intel_leads:        intelReport?.leads_analyzed   ?? "N/A",
  intel_opportunity:  intelReport?.summary?.total_opportunity_value
    ? `$${(intelReport.summary.total_opportunity_value).toLocaleString()}` : "N/A",
  intel_avg_score:    intelReport?.summary?.avg_score ?? "N/A",
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="refresh" content="300"/>
  <title>XPS Intelligence – Live Dashboard</title>
  <style>
    :root {
      --gold: #c9a84c;
      --gold-light: #e8c96a;
      --dark: #0f0f0f;
      --card: #1a1a1a;
      --border: #2a2a2a;
      --text: #f0f0f0;
      --muted: #888;
      --green: #22c55e;
      --red: #ef4444;
      --blue: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--dark);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
    }
    header {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border-bottom: 1px solid var(--gold);
      padding: 1.5rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .logo-ring {
      width: 44px; height: 44px;
      border: 2px solid var(--gold);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; color: var(--gold); font-size: 1rem;
      background: radial-gradient(circle at 40% 40%, #2a2a1a, #0f0f0f);
    }
    .header-text h1 { font-size: 1.4rem; font-weight: 700; color: var(--gold); }
    .header-text p  { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      margin-left: auto;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity:1; } 50% { opacity:0.4; }
    }
    .badge {
      font-size: 0.65rem; background: var(--green); color: #000;
      padding: 2px 8px; border-radius: 20px; font-weight: 600;
      margin-left: 0.5rem;
    }
    main { padding: 2rem; max-width: 1400px; margin: 0 auto; }
    .section-title {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--muted);
      margin-bottom: 1rem; margin-top: 2rem;
      border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .kpi {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      transition: border-color 0.2s;
    }
    .kpi:hover { border-color: var(--gold); }
    .kpi-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-value { font-size: 2rem; font-weight: 800; color: var(--gold); line-height: 1.1; margin: 0.25rem 0; }
    .kpi-sub   { font-size: 0.75rem; color: var(--muted); }
    .gold-kpi .kpi-value { color: var(--gold-light); }
    .green-kpi .kpi-value { color: var(--green); }
    .table-wrap {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead th {
      background: #111;
      padding: 0.75rem 1rem;
      text-align: left;
      font-size: 0.7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
    }
    tbody tr { border-top: 1px solid var(--border); }
    tbody tr:hover { background: #222; }
    tbody td { padding: 0.75rem 1rem; }
    .pill {
      display: inline-block;
      padding: 2px 8px; border-radius: 20px;
      font-size: 0.65rem; font-weight: 600;
    }
    .pill-green { background: rgba(34,197,94,0.15); color: var(--green); }
    .pill-red   { background: rgba(239,68,68,0.15);  color: var(--red); }
    .pill-gold  { background: rgba(201,168,76,0.15); color: var(--gold); }
    .pill-blue  { background: rgba(59,130,246,0.15); color: var(--blue); }
    .footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem 2rem;
      font-size: 0.7rem; color: var(--muted);
      display: flex; align-items: center; gap: 1rem;
    }
    .update-time { margin-left: auto; }
  </style>
</head>
<body>
  <header>
    <div class="logo-ring">XPS</div>
    <div class="header-text">
      <h1>XPS Intelligence <span style="color:#fff;font-weight:400">/ Live Dashboard</span></h1>
      <p>Autonomous intelligence system · Continuous operation</p>
    </div>
    <div class="status-dot" title="System operational"></div>
    <span class="badge">LIVE</span>
  </header>

  <main>
    <div class="section-title">System Metrics</div>
    <div class="kpi-grid">
      <div class="kpi gold-kpi">
        <div class="kpi-label">Efficiency Score</div>
        <div class="kpi-value">${metrics.efficiency}</div>
        <div class="kpi-sub">out of 10</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Friction Score</div>
        <div class="kpi-value">${metrics.friction}</div>
        <div class="kpi-sub">lower is better</div>
      </div>
      <div class="kpi green-kpi">
        <div class="kpi-label">Steps Passed</div>
        <div class="kpi-value">${metrics.steps_passed}<span style="font-size:1rem;color:var(--muted)">/${metrics.steps_total}</span></div>
        <div class="kpi-sub">last operation run</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Leads Ingested</div>
        <div class="kpi-value">${metrics.leads_found}</div>
        <div class="kpi-sub">last ingest cycle</div>
      </div>
      <div class="kpi gold-kpi">
        <div class="kpi-label">Best Strategy ROI</div>
        <div class="kpi-value">${metrics.roi_pct}%</div>
        <div class="kpi-sub">${metrics.best_strategy ?? ""}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Competitors Tracked</div>
        <div class="kpi-value">${metrics.competitors}</div>
        <div class="kpi-sub">competition watch</div>
      </div>
    </div>

    <div class="section-title">LLM Intelligence System</div>
    <div class="kpi-grid">
      <div class="kpi gold-kpi">
        <div class="kpi-label">RAG Queries Run</div>
        <div class="kpi-value">${metrics.rag_queries}</div>
        <div class="kpi-sub">last RAG session</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Knowledge Base Docs</div>
        <div class="kpi-value">${metrics.rag_kb_docs}</div>
        <div class="kpi-sub">domain + scraped leads</div>
      </div>
      <div class="kpi green-kpi">
        <div class="kpi-label">Companies Profiled</div>
        <div class="kpi-value">${metrics.intel_leads}</div>
        <div class="kpi-sub">intelligence generated</div>
      </div>
      <div class="kpi gold-kpi">
        <div class="kpi-label">Total Opportunity</div>
        <div class="kpi-value" style="font-size:1.4rem">${metrics.intel_opportunity}</div>
        <div class="kpi-sub">estimated pipeline value</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Avg Lead Score</div>
        <div class="kpi-value">${metrics.intel_avg_score}</div>
        <div class="kpi-sub">out of 100</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">LLM Model</div>
        <div class="kpi-value" style="font-size:0.85rem">${metrics.rag_model}</div>
        <div class="kpi-sub">Groq inference</div>
      </div>
    </div>

    <div style="background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);margin-bottom:0.75rem;font-weight:700">RAG API Endpoints</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem;font-size:0.8rem;">
        ${[
          ["POST /api/intelligence/rag",     "Semantic Q&A – ask about contractors, pricing, territory"],
          ["POST /api/intelligence/company", "Generate full company intelligence profile + pitch"],
          ["GET  /api/intelligence/kb",      "Retrieve knowledge base articles"],
          ["POST /api/ai/invoke",            "Direct Groq/Ollama LLM invocation"],
        ].map(([ep, desc]) => `
          <div style="background:#111;border:1px solid var(--border);border-radius:8px;padding:0.75rem;">
            <code style="color:var(--gold);font-size:0.75rem">${ep}</code>
            <div style="color:var(--muted);margin-top:4px">${desc}</div>
          </div>
        `).join("")}
      </div>
      <div style="margin-top:1rem;font-size:0.75rem;color:var(--muted);">
        Example queries: "Who are the best epoxy contractors in Broward?" · "What should I sell this company?" · "What's their weakness?"
      </div>
    </div>

    <div class="section-title">Active Workflows</div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Workflow</th>
          <th>Schedule</th>
          <th>Status</th>
          <th>Last Run</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>xps-ingest</td>
            <td>Daily 06:00 UTC</td>
            <td><span class="pill pill-green">Active</span></td>
            <td>${ingestReport?.run_at?.slice(0,10) ?? "pending"}</td>
          </tr>
          <tr>
            <td>xps-operate</td>
            <td>Weekdays 10:00 UTC</td>
            <td><span class="pill pill-green">Active</span></td>
            <td>${operateReport?.run_at?.slice(0,10) ?? "pending"}</td>
          </tr>
          <tr>
            <td>xps-optimize</td>
            <td>Weekly Mon 08:00 UTC</td>
            <td><span class="pill pill-green">Active</span></td>
            <td>${optimizeReport?.run_at?.slice(0,10) ?? "pending"}</td>
          </tr>
          <tr>
            <td>xps-rag</td>
            <td>On demand / API</td>
            <td><span class="pill pill-green">Active</span></td>
            <td>${ragReport?.generated_at?.slice(0,10) ?? "pending"}</td>
          </tr>
          <tr>
            <td>xps-company-intel</td>
            <td>On demand / API</td>
            <td><span class="pill pill-green">Active</span></td>
            <td>${intelReport?.generated_at?.slice(0,10) ?? "pending"}</td>
          </tr>
          <tr>
            <td>xps-validate</td>
            <td>On Push / PR</td>
            <td><span class="pill pill-blue">CI</span></td>
            <td>continuous</td>
          </tr>
          <tr>
            <td>xps-test</td>
            <td>On Push / PR</td>
            <td><span class="pill pill-blue">CI</span></td>
            <td>continuous</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-title">Recursive Operation Loop</div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;font-size:0.85rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
        ${["Ingest Data","Operate System","Record Evidence","Analyze Telemetry","Optimize Strategy","Re-run"].map((s, i, arr) =>
          `<span style="background:#111;border:1px solid var(--gold);border-radius:8px;padding:4px 14px;color:var(--gold);font-weight:600">${s}</span>${i < arr.length - 1 ? '<span style="color:var(--muted)">→</span>' : '<span style="color:var(--green);font-size:1.2rem;margin-left:4px">↺</span>'}`
        ).join("")}
      </div>
      <p style="margin-top:1rem;color:var(--muted);font-size:0.75rem;">
        The system ingests real-world data, operates itself visibly via Playwright, records all evidence,
        analyzes efficiency metrics, runs LLM-powered optimization, and restarts the loop continuously.
      </p>
    </div>

    <div class="section-title">Competition Watch</div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Competitor</th>
          <th>Type</th>
          <th>Territory</th>
          <th>Threat</th>
          <th>Price Tier</th>
        </tr></thead>
        <tbody>
          ${(competeReport?.competitors ?? [
            { name: "PolyCoat Pro",       type: "Contractor",   territory: "SE FL",      threat: "high",   price_tier: "budget" },
            { name: "FloorCraft Systems", type: "Contractor",   territory: "Central FL", threat: "medium", price_tier: "premium" },
            { name: "EpoxyMaster Supply", type: "Distributor",  territory: "National",   threat: "high",   price_tier: "budget" },
            { name: "GrindTech Ind.",     type: "Manufacturer", territory: "National",   threat: "low",    price_tier: "ultra-premium" },
            { name: "SurfacePro Coatings",type: "Contractor",   territory: "SW FL",      threat: "medium", price_tier: "budget" },
          ]).map((c) => `
          <tr>
            <td>${c.name}</td>
            <td>${c.type}</td>
            <td>${c.territory}</td>
            <td><span class="pill ${c.threat === "high" ? "pill-red" : c.threat === "medium" ? "pill-gold" : "pill-green"}">${c.threat}</span></td>
            <td>${c.price_tier}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section-title">System Architecture</div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;font-size:0.8rem;color:var(--muted);">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;">
        ${[
          ["Frontend",    "React + Vite",          "blue"],
          ["API",         "Express + TypeScript",   "gold"],
          ["Database",    "Postgres / Supabase",    "green"],
          ["Queue",       "Redis + BullMQ",         "blue"],
          ["AI Engine",   "Groq + Ollama",          "gold"],
          ["Scraper",     "Playwright + Firecrawl", "green"],
          ["CI/CD",       "GitHub Actions",         "blue"],
          ["Deploy",      "Railway",                "gold"],
        ].map(([name, tech, color]) => `
          <div style="background:#111;border:1px solid var(--border);border-radius:8px;padding:0.75rem;">
            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--${color === "gold" ? "gold" : color === "green" ? "green" : "blue"});margin-bottom:4px">${name}</div>
            <div style="color:var(--text);font-weight:500">${tech}</div>
          </div>
        `).join("")}
      </div>
    </div>
  </main>

  <footer class="footer">
    <span>XPS Intelligence Systems · Autonomous AI Operating Platform</span>
    <span class="update-time">Auto-refresh every 5 minutes · Last updated: ${now.slice(0, 19).replace("T", " ")} UTC</span>
  </footer>
</body>
</html>`;

mkdirSync(DASHBOARD_DIR, { recursive: true });
writeFileSync(join(DASHBOARD_DIR, "index.html"), html);
console.log(`[DASHBOARD] Generated ${DASHBOARD_DIR}/index.html`);
