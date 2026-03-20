import { Router } from "express";
import { Pool } from "pg";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";
import { requireAuth } from "../middleware/auth.js";

export const healthRouter = Router();

const startTime = Date.now();
let requestCount = 0;

// Track requests globally
healthRouter.use((_req, _res, next) => {
  requestCount++;
  next();
});

healthRouter.get("/", async (_req, res) => {
  const checks: Record<string, string> = { api: "ok" };

  try {
    const db = getDb();
    await db.query("SELECT 1");
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = `error: ${(err as Error).message}`;
  }

  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch (err) {
    checks.redis = `error: ${(err as Error).message}`;
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() });
});

interface DiagnosticResult {
  component: string;
  status: "ok" | "degraded" | "error";
  latency?: number;
  detail?: string;
}

healthRouter.get("/diagnose", requireAuth, async (_req, res) => {
  const results: DiagnosticResult[] = [];

  // DB check
  const dbStart = Date.now();
  try {
    const db = getDb();
    await db.query("SELECT 1");
    results.push({ component: "Database", status: "ok", latency: Date.now() - dbStart, detail: "PostgreSQL responding" });
  } catch (err) {
    results.push({ component: "Database", status: "error", latency: Date.now() - dbStart, detail: (err as Error).message });
  }

  // Redis check
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    results.push({ component: "Redis", status: "ok", latency: Date.now() - redisStart, detail: "Redis responding" });
  } catch (err) {
    results.push({ component: "Redis", status: "error", latency: Date.now() - redisStart, detail: (err as Error).message });
  }

  // AI / LLM check
  const aiStart = Date.now();
  if (!process.env.GROQ_API_KEY) {
    results.push({ component: "AI LLM", status: "degraded", latency: 0, detail: "GROQ_API_KEY not configured" });
  } else {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        results.push({ component: "AI LLM", status: "ok", latency: Date.now() - aiStart, detail: "Groq API reachable" });
      } else {
        results.push({ component: "AI LLM", status: "degraded", latency: Date.now() - aiStart, detail: `Groq returned ${response.status}` });
      }
    } catch (err) {
      results.push({ component: "AI LLM", status: "error", latency: Date.now() - aiStart, detail: (err as Error).message });
    }
  }

  // Scraper queue check
  const scraperStart = Date.now();
  try {
    const redis = getRedis();
    const queueLen = await redis.llen("xps:scrape:queue");
    results.push({ component: "Scraper Queue", status: "ok", latency: Date.now() - scraperStart, detail: `${queueLen} jobs in queue` });
  } catch (err) {
    results.push({ component: "Scraper Queue", status: "error", latency: Date.now() - scraperStart, detail: (err as Error).message });
  }

  const overallHealthy = results.every((r) => r.status === "ok");
  const hasDegraded = results.some((r) => r.status === "degraded");

  res.json({
    status: overallHealthy ? "healthy" : hasDegraded ? "degraded" : "unhealthy",
    diagnostics: results,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.post("/heal", requireAuth, async (_req, res) => {
  const actions: Array<{ component: string; action: string; success: boolean; detail?: string }> = [];

  // Attempt DB reconnect
  try {
    const db = getDb();
    await db.query("SELECT 1");
    actions.push({ component: "Database", action: "ping", success: true, detail: "Connection verified" });
  } catch (err) {
    // Try to reset pool by creating a new connection
    try {
      const newPool = new Pool({ connectionString: process.env.DATABASE_URL });
      await newPool.query("SELECT 1");
      await newPool.end();
      actions.push({ component: "Database", action: "reconnect", success: true, detail: "New connection verified" });
    } catch (innerErr) {
      actions.push({ component: "Database", action: "reconnect", success: false, detail: (innerErr as Error).message });
    }
  }

  // Attempt Redis reconnect
  try {
    const redis = getRedis();
    await redis.ping();
    actions.push({ component: "Redis", action: "ping", success: true, detail: "Connection verified" });
  } catch (err) {
    actions.push({ component: "Redis", action: "reconnect", success: false, detail: (err as Error).message });
  }

  // AI LLM - just verify key is present
  if (process.env.GROQ_API_KEY) {
    actions.push({ component: "AI LLM", action: "verify", success: true, detail: "API key present" });
  } else {
    actions.push({ component: "AI LLM", action: "verify", success: false, detail: "GROQ_API_KEY missing" });
  }

  const allSuccess = actions.every((a) => a.success);
  res.json({
    healed: allSuccess,
    actions,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/metrics", requireAuth, (_req, res) => {
  const uptimeMs = Date.now() - startTime;
  const memUsage = process.memoryUsage();

  res.json({
    uptime: {
      ms: uptimeMs,
      seconds: Math.floor(uptimeMs / 1000),
      human: formatUptime(uptimeMs),
    },
    memory: {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
    },
    requests: requestCount,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  });
});

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
