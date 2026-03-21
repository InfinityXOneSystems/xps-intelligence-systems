import { Router } from "express";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const metricsRouter = Router();
metricsRouter.use(requireAuth);

const QUEUE_KEY = "xps:scrape:queue";
const WORKER_HEARTBEAT_KEY = "xps:worker:heartbeat";

// ─── GET /api/metrics/system ──────────────────────────────────────────────────

metricsRouter.get(
  "/system",
  requireRole("manager", "owner", "admin"),
  async (_req, res) => {
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // DB latency
    try {
      const db = getDb();
      const t0 = Date.now();
      await db.query("SELECT 1");
      results.db_latency_ms = Date.now() - t0;
    } catch (err) {
      results.db_latency_ms = null;
      errors.db = (err as Error).message;
    }

    // Queue depth + worker heartbeat
    try {
      const redis = getRedis();
      const [queueLen, heartbeat] = await Promise.all([
        redis.llen(QUEUE_KEY),
        redis.get(WORKER_HEARTBEAT_KEY),
      ]);
      results.queue_depth = queueLen;
      results.active_workers = heartbeat ? 1 : 0;
      results.last_worker_heartbeat = heartbeat || null;
    } catch (err) {
      results.queue_depth = null;
      results.active_workers = 0;
      errors.redis = (err as Error).message;
    }

    // AI latency (Groq ping)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const t0 = Date.now();
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(10000),
        });
        results.ai_latency_ms = Date.now() - t0;
        results.ai_provider = r.ok ? "groq" : "unavailable";
      } catch {
        results.ai_latency_ms = null;
        results.ai_provider = "unavailable";
      }
    } else {
      results.ai_latency_ms = null;
      results.ai_provider = "not_configured";
    }

    // Error rate from agent_tasks in last hour
    try {
      const db = getDb();
      const errorResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) AS total
        FROM agent_tasks
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      const row = errorResult.rows[0] as Record<string, string>;
      const failed = Number(row.failed ?? 0);
      const total = Number(row.total ?? 0);
      results.error_rate = total > 0 ? Number((failed / total * 100).toFixed(1)) : 0;
      results.tasks_last_hour = total;
    } catch {
      results.error_rate = null;
      results.tasks_last_hour = null;
    }

    // Last scrape time
    try {
      const db = getDb();
      const scrapeResult = await db.query(`
        SELECT MAX(completed_at) as last_scrape_at
        FROM agent_tasks
        WHERE type IN ('scrape','search') AND status = 'completed'
      `);
      results.last_scrape_at = (scrapeResult.rows[0] as Record<string, unknown>)?.last_scrape_at || null;
    } catch {
      results.last_scrape_at = null;
    }

    // Leads ingested today
    try {
      const db = getDb();
      const leadsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM leads
        WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL
      `);
      results.leads_ingested_today = Number((leadsResult.rows[0] as Record<string, string>).count ?? 0);
    } catch {
      results.leads_ingested_today = null;
    }

    res.json({
      timestamp: new Date().toISOString(),
      ...results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  }
);
