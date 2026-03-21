#!/usr/bin/env node
/**
 * XPS Intelligence — Doctor System
 *
 * Runs a comprehensive health check across the full platform:
 *   1. Frontend build validation
 *   2. TypeScript typecheck
 *   3. ESLint scan
 *   4. API route inventory
 *   5. DB schema completeness check
 *   6. E2E test spec inventory
 *   7. Environment variable completeness
 *   8. Agent script inventory
 *   9. CI/CD workflow presence
 *
 * Outputs a structured JSON report and exits non-zero if critical failures found.
 *
 * Usage:
 *   node scripts/agents/doctor.mjs
 *   DRY_RUN=true node scripts/agents/doctor.mjs
 */

import { execSync } from "child_process";
import { existsSync, readdirSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const DRY_RUN = process.env.DRY_RUN === "true";
const OUT_DIR = join(ROOT, "reports/doctor");
const REPORT_FILE = join(OUT_DIR, `doctor-${new Date().toISOString().slice(0, 10)}.json`);

mkdirSync(OUT_DIR, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const checks = [];
let criticalFailures = 0;

function check(category, name, fn) {
  const start = Date.now();
  try {
    const result = fn();
    const status = result.status ?? "pass";
    const ms = Date.now() - start;
    checks.push({ category, name, status, ms, ...result });
    const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : "✗";
    console.log(`  ${icon} [${category}] ${name}${result.detail ? " — " + result.detail : ""}`);
    if (status === "fail") criticalFailures++;
  } catch (err) {
    checks.push({ category, name, status: "error", ms: Date.now() - start, detail: err.message });
    console.log(`  ✗ [${category}] ${name} — ERROR: ${err.message}`);
    criticalFailures++;
  }
}

function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, { cwd: opts.cwd || ROOT, stdio: "pipe", timeout: 60000 }).toString().trim();
    return { status: "pass", detail: out.slice(0, 200) };
  } catch (err) {
    return { status: "fail", detail: err.stderr?.toString().slice(0, 300) || err.message };
  }
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

function listFiles(relDir, ext) {
  if (!existsSync(join(ROOT, relDir))) return [];
  return readdirSync(join(ROOT, relDir)).filter((f) => !ext || f.endsWith(ext));
}

// ─── Checks ───────────────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════╗");
console.log("║    XPS Intelligence — Doctor System      ║");
console.log(`╚══════════════════════════════════════════╝\n`);
console.log(`Root: ${ROOT}\nMode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

// 1. Frontend build
check("build", "Frontend build (vite)", () => {
  if (DRY_RUN) return { status: "pass", detail: "DRY_RUN skipped" };
  return run("npm run build:frontend 2>&1 | tail -5");
});

// 2. TypeScript typecheck
check("types", "TypeScript typecheck (root)", () => {
  if (DRY_RUN) return { status: "pass", detail: "DRY_RUN skipped" };
  return run("npx tsc --noEmit 2>&1 | tail -10");
});

// 3. ESLint
check("lint", "ESLint frontend scan", () => {
  if (DRY_RUN) return { status: "pass", detail: "DRY_RUN skipped" };
  return run("npx eslint src --max-warnings 20 2>&1 | tail -5");
});

// 4. Critical source files
for (const file of [
  "src/App.tsx",
  "src/main.tsx",
  "src/index.css",
  "src/pages/Login.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/Leads.tsx",
  "src/pages/Scraper.tsx",
  "src/pages/SalesStaff.tsx",
  "src/pages/Manager.tsx",
  "src/pages/Owner.tsx",
  "src/pages/Admin.tsx",
  "src/pages/Onboarding.tsx",
  "src/components/layout/AppLayout.tsx",
  "src/components/layout/AppSidebar.tsx",
  "src/lib/api.ts",
  "src/hooks/useAuth.tsx",
]) {
  check("frontend", `File exists: ${file}`, () =>
    fileExists(file)
      ? { status: "pass" }
      : { status: "fail", detail: `Missing: ${file}` }
  );
}

// 5. API routes
check("api", "API entry point exists", () =>
  fileExists("apps/api/src/index.ts") ? { status: "pass" } : { status: "fail", detail: "apps/api/src/index.ts missing" }
);

const apiRoutes = listFiles("apps/api/src/routes", ".ts");
check("api", `API routes count (${apiRoutes.length})`, () =>
  apiRoutes.length >= 10
    ? { status: "pass", detail: apiRoutes.join(", ") }
    : { status: "warn", detail: `Only ${apiRoutes.length} routes found` }
);

// Check for /scrape/search and /leads/bulk
check("api", "scrape.ts has /search endpoint", () => {
  if (!fileExists("apps/api/src/routes/scrape.ts")) return { status: "fail", detail: "scrape.ts missing" };
  const content = readFileSync(join(ROOT, "apps/api/src/routes/scrape.ts"), "utf8");
  return content.includes("/search")
    ? { status: "pass", detail: "POST /scrape/search endpoint present" }
    : { status: "warn", detail: "POST /scrape/search endpoint not found" };
});

check("api", "leads.ts has /bulk endpoint", () => {
  if (!fileExists("apps/api/src/routes/leads.ts")) return { status: "fail", detail: "leads.ts missing" };
  const content = readFileSync(join(ROOT, "apps/api/src/routes/leads.ts"), "utf8");
  return content.includes("/bulk")
    ? { status: "pass", detail: "POST /leads/bulk endpoint present" }
    : { status: "warn", detail: "POST /leads/bulk endpoint not found" };
});

// New autonomous system checks
check("scraper", "Real search engine file exists", () =>
  fileExists("services/scraper/src/search-engine.ts")
    ? { status: "pass", detail: "search-engine.ts found" }
    : { status: "fail", detail: "services/scraper/src/search-engine.ts missing" }
);

check("api", "Sales flow route exists", () =>
  fileExists("apps/api/src/routes/sales-flow.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "apps/api/src/routes/sales-flow.ts missing" }
);

check("api", "Actions route exists", () =>
  fileExists("apps/api/src/routes/actions.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "apps/api/src/routes/actions.ts missing" }
);

check("api", "Feedback route exists", () =>
  fileExists("apps/api/src/routes/feedback.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "apps/api/src/routes/feedback.ts missing" }
);

check("api", "Metrics route exists", () =>
  fileExists("apps/api/src/routes/metrics.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "apps/api/src/routes/metrics.ts missing" }
);

check("services", "ByteBot service exists", () =>
  fileExists("services/bytebot/src/index.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "services/bytebot/src/index.ts missing" }
);

check("services", "Intelligence service exists", () =>
  fileExists("services/intelligence/src/index.ts")
    ? { status: "pass" }
    : { status: "fail", detail: "services/intelligence/src/index.ts missing" }
);

check("frontend", "SalesFlow page exists", () =>
  fileExists("src/pages/SalesFlow.tsx")
    ? { status: "pass" }
    : { status: "warn", detail: "src/pages/SalesFlow.tsx missing" }
);

// 6. Database schema
check("db", "DB schema exists", () =>
  fileExists("db/schema.sql") ? { status: "pass" } : { status: "fail", detail: "db/schema.sql missing" }
);

// 7. E2E tests
const e2eSpecs = listFiles("e2e", ".spec.ts");
check("e2e", `E2E specs count (${e2eSpecs.length})`, () =>
  e2eSpecs.length >= 5
    ? { status: "pass", detail: e2eSpecs.join(", ") }
    : { status: "warn", detail: `Only ${e2eSpecs.length} specs found` }
);

check("e2e", "ByteBot journey spec present", () =>
  fileExists("e2e/bytebot-journey.spec.ts")
    ? { status: "pass" }
    : { status: "warn", detail: "e2e/bytebot-journey.spec.ts missing" }
);

// 8. Environment variables
const envExample = fileExists(".env.example")
  ? readFileSync(join(ROOT, ".env.example"), "utf8")
  : "";

const requiredEnvVars = [
  "DATABASE_URL", "REDIS_URL", "JWT_SECRET",
  "VITE_API_URL", "API_PORT",
];
for (const envVar of requiredEnvVars) {
  check("env", `Env var documented: ${envVar}`, () =>
    envExample.includes(envVar)
      ? { status: "pass" }
      : { status: "warn", detail: `${envVar} not in .env.example` }
  );
}

const scrapeEnvVars = ["GOOGLE_MAPS_API_KEY", "SERPAPI_KEY"];
for (const envVar of scrapeEnvVars) {
  check("env", `Scraper env var documented: ${envVar}`, () =>
    envExample.includes(envVar)
      ? { status: "pass" }
      : { status: "warn", detail: `${envVar} not in .env.example — required for real scraper` }
  );
}

// 9. Agent scripts
const agentScripts = listFiles("scripts/agents", ".mjs");
check("agents", `Agent scripts count (${agentScripts.length})`, () =>
  agentScripts.length >= 4
    ? { status: "pass", detail: agentScripts.join(", ") }
    : { status: "warn", detail: `Only ${agentScripts.length} agent scripts found` }
);

// 10. CI/CD workflows
const workflows = listFiles(".github/workflows", ".yml");
check("ci", `CI workflows count (${workflows.length})`, () =>
  workflows.length >= 3
    ? { status: "pass", detail: workflows.join(", ") }
    : { status: "warn", detail: `Only ${workflows.length} workflows found` }
);

check("ci", "ByteBot CI workflow present", () =>
  fileExists(".github/workflows/bytebot.yml")
    ? { status: "pass" }
    : { status: "warn", detail: ".github/workflows/bytebot.yml missing" }
);

// 11. Playwright config
check("e2e", "playwright.config.ts exists", () =>
  fileExists("playwright.config.ts") ? { status: "pass" } : { status: "fail" }
);

// ─── Report ───────────────────────────────────────────────────────────────────

const summary = {
  generated_at: new Date().toISOString(),
  root: ROOT,
  dry_run: DRY_RUN,
  total_checks: checks.length,
  passed: checks.filter((c) => c.status === "pass").length,
  warnings: checks.filter((c) => c.status === "warn").length,
  failures: checks.filter((c) => c.status === "fail" || c.status === "error").length,
  critical_failures: criticalFailures,
  checks,
};

writeFileSync(REPORT_FILE, JSON.stringify(summary, null, 2));

console.log("\n──────────────────────────────────────────");
console.log(`Doctor Report: ${REPORT_FILE}`);
console.log(`Checks: ${summary.total_checks} | Passed: ${summary.passed} | Warnings: ${summary.warnings} | Failures: ${summary.failures}`);
if (criticalFailures > 0) {
  console.log(`\n⛔ ${criticalFailures} CRITICAL FAILURE(S) — System not production-ready`);
  process.exit(1);
} else if (summary.warnings > 0) {
  console.log(`\n⚠  ${summary.warnings} WARNING(S) — Review recommended`);
} else {
  console.log("\n✅ All checks passed — System healthy");
}
