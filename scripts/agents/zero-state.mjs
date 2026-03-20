#!/usr/bin/env node
/**
 * XPS Intelligence – Zero State Initialization Agent
 *
 * Resets the system to a clean state:
 *   1. Clears all database tables (preserving schema)
 *   2. Flushes Redis queues
 *   3. Clears cache keys
 *   4. Reports what was cleared
 *
 * Usage:
 *   node scripts/agents/zero-state.mjs
 *   DRY_RUN=true node scripts/agents/zero-state.mjs   # Preview only
 *   TABLES=leads,proposals node scripts/agents/zero-state.mjs  # Selective
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DRY_RUN    = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const DB_URL     = process.env.DATABASE_URL;
const REDIS_URL  = process.env.REDIS_URL || "redis://localhost:6379";
const SELECTIVE  = process.env.TABLES ? process.env.TABLES.split(",").map((t) => t.trim()) : null;

// Tables to truncate (in dependency-safe order)
const TRUNCATE_ORDER = [
  "communication_log",
  "telemetry_events",
  "optimization_reports",
  "activities",
  "proposals",
  "agent_tasks",
  "leads",
  "agent_workflows",
  "audit_logs",
  "xps_distillation_queue",
  "xps_knowledge_base",
  "xps_taxonomy",
  "users",
  "locations",
];

async function clearDatabase() {
  if (!DB_URL) {
    return { status: "skipped", reason: "DATABASE_URL not set", tables_cleared: [] };
  }

  const { default: pkg } = await import("pg").catch(() => ({ default: null }));
  if (!pkg) {
    return { status: "skipped", reason: "pg module not available", tables_cleared: [] };
  }

  const { Pool } = pkg;
  const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 8000 });

  const tablesToClear = SELECTIVE
    ? SELECTIVE.filter((t) => TRUNCATE_ORDER.includes(t)) // whitelist: only allow known tables
    : TRUNCATE_ORDER;
  const cleared = [];
  const failed  = [];

  for (const table of tablesToClear) {
    if (DRY_RUN) {
      cleared.push({ table, rows_deleted: "(dry-run)" });
      console.log(`[ZERO] [DRY-RUN] Would TRUNCATE ${table}`);
      continue;
    }

    try {
      const count = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`).catch(() => ({ rows: [{ cnt: "?" }] }));
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
      cleared.push({ table, rows_deleted: count.rows[0].cnt });
      console.log(`[ZERO] ✓ TRUNCATED ${table} (${count.rows[0].cnt} rows)`);
    } catch (err) {
      failed.push({ table, error: err.message });
      console.warn(`[ZERO] ✗ Failed to truncate ${table}: ${err.message}`);
    }
  }

  await pool.end();
  return { status: "done", tables_cleared: cleared, tables_failed: failed };
}

async function clearRedis() {
  try {
    const { default: ioredis } = await import("ioredis").catch(() => ({ default: null }));
    if (!ioredis) return { status: "skipped", reason: "ioredis module not available", keys_deleted: 0 };

    const redis = new ioredis(REDIS_URL, { lazyConnect: true, connectTimeout: 5000 });
    await redis.connect().catch(() => {});

    if (DRY_RUN) {
      const keys = await redis.keys("xps:*").catch(() => []);
      await redis.quit().catch(() => {});
      return { status: "dry-run", keys_would_delete: keys.length, keys };
    }

    const keys = await redis.keys("xps:*").catch(() => []);
    let deleted = 0;
    if (keys.length > 0) {
      deleted = await redis.del(...keys).catch(() => 0);
    }
    await redis.quit().catch(() => {});

    console.log(`[ZERO] ✓ Redis: deleted ${deleted} xps:* keys`);
    return { status: "done", keys_deleted: deleted };
  } catch (err) {
    console.warn(`[ZERO] Redis clear failed: ${err.message}`);
    return { status: "error", error: err.message, keys_deleted: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(60));
  console.log("XPS INTELLIGENCE – ZERO STATE INITIALIZATION");
  console.log("=".repeat(60));
  console.log(`Dry run:    ${DRY_RUN}`);
  console.log(`Selective:  ${SELECTIVE ? SELECTIVE.join(", ") : "all tables"}`);
  console.log(`DB URL:     ${DB_URL ? "configured" : "not set"}`);
  console.log(`Redis URL:  ${REDIS_URL}`);
  console.log("=".repeat(60));

  if (!DRY_RUN) {
    console.log("\n⚠️  WARNING: This will DELETE ALL DATA from the specified tables.");
    console.log("⚠️  Set DRY_RUN=true to preview without making changes.\n");
  }

  const startTime = Date.now();

  console.log("\n[ZERO] Step 1: Clearing database...");
  const dbResult = await clearDatabase();

  console.log("\n[ZERO] Step 2: Clearing Redis queues...");
  const redisResult = await clearRedis();

  const elapsed = Date.now() - startTime;

  const report = {
    agent:      "xps-zero-state",
    version:    "1.0.0",
    run_at:     new Date().toISOString(),
    dry_run:    DRY_RUN,
    elapsed_ms: elapsed,
    database:   dbResult,
    redis:      redisResult,
    summary: {
      tables_cleared: Array.isArray(dbResult.tables_cleared) ? dbResult.tables_cleared.length : 0,
      tables_failed:  Array.isArray(dbResult.tables_failed) ? dbResult.tables_failed.length : 0,
      redis_keys_deleted: typeof redisResult.keys_deleted === "number" ? redisResult.keys_deleted : 0,
    },
  };

  mkdirSync("reports/zero-state", { recursive: true });
  const reportPath = join("reports/zero-state", `zero-state-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== ZERO STATE COMPLETE ===");
  console.log(`Tables cleared: ${report.summary.tables_cleared}`);
  console.log(`Tables failed:  ${report.summary.tables_failed}`);
  console.log(`Redis keys:     ${report.summary.redis_keys_deleted}`);
  console.log(`Elapsed:        ${elapsed}ms`);
  console.log(`Report:         ${reportPath}`);
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log("[ZERO] Dry-run complete ✓");
  } else {
    console.log("[ZERO] System is now at ZERO STATE ✓");
    console.log("[ZERO] Ready to ingest fresh data.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[ZERO] Fatal:", err);
  process.exit(1);
});
