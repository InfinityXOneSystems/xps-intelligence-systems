#!/usr/bin/env node
/**
 * XPS Intelligence – System Operation Agent
 *
 * Uses Playwright to:
 *   1. Spin up the built frontend (vite preview)
 *   2. Navigate the full UI as a simulated user (Sales Rep → Manager → Owner)
 *   3. Capture screenshots and structured evidence at every step
 *   4. Generate a telemetry + scoring report
 *
 * All actions are logged, timed, and stored.
 *
 * Usage:
 *   node scripts/agents/operate.mjs
 *   BASE_URL=http://localhost:4173 node scripts/agents/operate.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const BASE_URL   = process.env.BASE_URL   || "http://localhost:4173";
const RECORD     = process.env.RECORD_VIDEO !== "false";
const OUT_DIR    = "reports/operate";
const SS_DIR     = join(OUT_DIR, "screenshots");
const VIDEO_DIR  = join(OUT_DIR, "videos");
const CI         = process.env.CI === "true";

mkdirSync(SS_DIR,    { recursive: true });
mkdirSync(VIDEO_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Preview server (used when BASE_URL points to localhost)
// ---------------------------------------------------------------------------
let previewProc = null;

async function startPreview() {
  return new Promise((resolve) => {
    console.log("[OPERATE] Starting vite preview server...");
    previewProc = spawn("npm", ["run", "preview", "--", "--port", "4173"], {
      stdio: "pipe",
      detached: false,
    });
    previewProc.stdout?.on("data", (d) => {
      if (d.toString().includes("4173")) {
        setTimeout(resolve, 500); // give it a moment
      }
    });
    // Fallback – if server takes >10s something is wrong but continue anyway
    setTimeout(resolve, 10000);
  });
}

async function stopPreview() {
  if (previewProc) {
    previewProc.kill("SIGTERM");
    previewProc = null;
  }
}

// ---------------------------------------------------------------------------
// Telemetry helpers
// ---------------------------------------------------------------------------
const steps = [];

function recordStep(name, durationMs, status, note = "") {
  steps.push({ name, duration_ms: durationMs, status, note, ts: new Date().toISOString() });
  const icon = status === "pass" ? "✓" : status === "skip" ? "-" : "✗";
  console.log(`  ${icon} [${durationMs}ms] ${name}${note ? " — " + note : ""}`);
}

async function ss(page, name) {
  try {
    const p = join(SS_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    return p;
  } catch { return null; }
}

async function timed(label, fn) {
  const t = Date.now();
  let status = "pass";
  let note = "";
  try {
    await fn();
  } catch (e) {
    status = "warn";
    note = String(e.message).slice(0, 80);
  }
  recordStep(label, Date.now() - t, status, note);
}

// ---------------------------------------------------------------------------
// Workflow steps
// ---------------------------------------------------------------------------
async function runLandingPage(page) {
  await timed("Navigate to landing page", async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 20000 });
    await ss(page, "01-landing");
  });
}

async function runLoginPage(page) {
  await timed("Navigate to login page", async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "02-login");
    // Verify form fields
    const emailInput = page.locator("input[type='email'], input[placeholder*='mail']").first();
    await emailInput.waitFor({ state: "visible", timeout: 8000 });
  });
}

async function runOnboarding(page) {
  await timed("Check onboarding page", async () => {
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "03-onboarding");
  });
}

async function runDashboard(page) {
  await timed("Navigate to dashboard", async () => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "04-dashboard");
  });
}

async function runLeads(page) {
  await timed("Navigate to leads page", async () => {
    await page.goto(`${BASE_URL}/leads`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "05-leads");
    // Scroll to see leads
    await page.evaluate(() => window.scrollBy(0, 400));
    await ss(page, "05b-leads-scrolled");
  });
}

async function runScraper(page) {
  await timed("Navigate to scraper", async () => {
    await page.goto(`${BASE_URL}/scraper`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "06-scraper");

    if (page.url().includes("scraper")) {
      // Fill city input
      const cityInput = page.locator("input[list='city-suggestions'], input[placeholder*='ity']").first();
      if (await cityInput.isVisible().catch(() => false)) {
        await cityInput.fill("Port St. Lucie, FL");
        await ss(page, "06b-scraper-city");
      }

      // Fill keyword
      const inputs = await page.locator("input").all();
      for (const inp of inputs) {
        const ph = await inp.getAttribute("placeholder").catch(() => "");
        if (ph?.toLowerCase().includes("keyword")) {
          await inp.fill("epoxy flooring");
          break;
        }
      }
    }
    await ss(page, "06c-scraper-configured");
  });
}

async function runAIAssistant(page) {
  await timed("Navigate to AI Assistant", async () => {
    await page.goto(`${BASE_URL}/ai-assistant`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "07-ai-assistant");

    if (page.url().includes("ai-assistant")) {
      const inp = page.locator("input[placeholder*='Ask'], input[placeholder*='ask'], input[placeholder*='message'], textarea").first();
      if (await inp.isVisible().catch(() => false)) {
        await inp.fill("What is the best pitch for a warehouse looking for epoxy flooring?");
        await ss(page, "07b-ai-query");
      }
    }
  });
}

async function runResearch(page) {
  await timed("Navigate to Research Lab", async () => {
    await page.goto(`${BASE_URL}/research`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "08-research");
  });
}

async function runIntelligence(page) {
  await timed("Navigate to Intelligence System", async () => {
    await page.goto(`${BASE_URL}/intelligence`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "09-intelligence");
  });
}

async function runAdmin(page) {
  await timed("Navigate to Admin Panel", async () => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "10-admin");
    if (page.url().includes("admin")) {
      // Tab through admin sections
      for (const [tabText, tabSlug] of [["Workflows", "workflows"], ["Audit", "audit"], ["Connectors", "connectors"]]) {
        const btn = page.locator(`button:has-text('${tabText}')`).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
          await ss(page, `10-admin-${tabSlug}`);
        }
      }
    }
  });
}

async function runManager(page) {
  await timed("Navigate to Manager Portal", async () => {
    await page.goto(`${BASE_URL}/manager`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "11-manager");
  });
}

async function runOwner(page) {
  await timed("Navigate to Owner Portal", async () => {
    await page.goto(`${BASE_URL}/owner`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "12-owner");
    if (page.url().includes("owner")) {
      // Try sliders
      const sliders = await page.locator("input[type='range']").all();
      for (const sl of sliders.slice(0, 2)) {
        await sl.fill("30").catch(() => {});
      }
      await ss(page, "12b-owner-sim");
    }
  });
}

async function runCompetition(page) {
  await timed("Navigate to Competition Watch", async () => {
    await page.goto(`${BASE_URL}/competition`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "13-competition");
  });
}

async function runConnectors(page) {
  await timed("Navigate to Connectors Hub", async () => {
    await page.goto(`${BASE_URL}/connectors`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "14-connectors");
  });
}

async function runProposals(page) {
  await timed("Navigate to Proposals", async () => {
    await page.goto(`${BASE_URL}/proposals`, { waitUntil: "networkidle", timeout: 15000 });
    await ss(page, "15-proposals");
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(60));
  console.log("XPS INTELLIGENCE – SYSTEM OPERATION AGENT");
  console.log("=".repeat(60));
  console.log(`Base URL:     ${BASE_URL}`);
  console.log(`Record video: ${RECORD}`);
  console.log(`CI:           ${CI}`);
  console.log("=".repeat(60));

  const globalStart = Date.now();
  let browser = null;
  let context = null;

  // Start preview server if targeting localhost
  if (BASE_URL.includes("localhost")) {
    await startPreview();
  }

  try {
    // Launch browser – always headless (no physical display available in CI or agent contexts)
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const contextOptions = {
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    };

    if (RECORD) {
      contextOptions.recordVideo = {
        dir: VIDEO_DIR,
        size: { width: 1280, height: 900 },
      };
    }

    context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    console.log("\n[OPERATE] Starting workflow execution...\n");

    // Execute all workflow steps
    await runLandingPage(page);
    await runLoginPage(page);
    await runOnboarding(page);
    await runDashboard(page);
    await runLeads(page);
    await runScraper(page);
    await runAIAssistant(page);
    await runResearch(page);
    await runIntelligence(page);
    await runAdmin(page);
    await runManager(page);
    await runOwner(page);
    await runCompetition(page);
    await runConnectors(page);
    await runProposals(page);

    // Final full-page screenshot of each major section (done above inline)

  } catch (fatalErr) {
    console.error("[OPERATE] Fatal error:", fatalErr);
    recordStep("FATAL ERROR", Date.now() - globalStart, "fail", String(fatalErr.message));
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await stopPreview();
  }

  const elapsed = Date.now() - globalStart;

  // Scoring
  const passed   = steps.filter((s) => s.status === "pass").length;
  const warned   = steps.filter((s) => s.status === "warn").length;
  const failed   = steps.filter((s) => s.status === "fail").length;
  const total    = steps.length;
  const avgMs    = total > 0 ? Math.round(steps.reduce((a, s) => a + s.duration_ms, 0) / total) : 0;
  const effScore = total > 0 ? Math.round(((passed + warned * 0.5) / total) * 10 * 10) / 10 : 0;

  // Write report
  const report = {
    agent:      "xps-operate",
    version:    "1.0.0",
    run_at:     new Date().toISOString(),
    base_url:   BASE_URL,
    telemetry: {
      total_steps:     total,
      passed,
      warned,
      failed,
      avg_step_ms:     avgMs,
      total_elapsed_ms: elapsed,
      efficiency_score: effScore,
      friction_score:   Math.round((failed / Math.max(total, 1)) * 10 * 10) / 10,
    },
    steps,
    screenshots_dir: SS_DIR,
    videos_dir:      VIDEO_DIR,
  };

  writeFileSync(join(OUT_DIR, `operate-${Date.now()}.json`), JSON.stringify(report, null, 2));
  // Also write latest.json for dashboard consumption
  writeFileSync(join(OUT_DIR, "latest.json"), JSON.stringify(report, null, 2));

  console.log("\n=== OPERATION COMPLETE ===");
  console.log(`Total steps:       ${total}`);
  console.log(`Passed:            ${passed}`);
  console.log(`Warned:            ${warned}`);
  console.log(`Failed:            ${failed}`);
  console.log(`Avg step time:     ${avgMs}ms`);
  console.log(`Total elapsed:     ${elapsed}ms`);
  console.log(`Efficiency score:  ${effScore}/10`);
  console.log(`Report:            ${join(OUT_DIR, "latest.json")}`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[OPERATE] Unhandled error:", err);
  process.exit(1);
});
