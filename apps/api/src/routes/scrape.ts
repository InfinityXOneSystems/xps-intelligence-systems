import { Router } from "express";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { searchBusinesses } from "../lib/search-engine.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const scrapeRouter = Router();
scrapeRouter.use(requireAuth);

const ScrapeSchema = z.object({
  url: z.string().url().optional(),
  company_name: z.string().optional(),
  query: z.string().optional(),
  mode: z.enum(["firecrawl", "steel", "auto"]).default("auto"),
}).refine(
  (d) => !!(d.url || d.company_name || d.query),
  { message: "At least one of url, company_name, or query is required" }
);

scrapeRouter.post("/start", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const data = ScrapeSchema.parse(req.body);
    const db = getDb();
    const redis = getRedis();
    const user = req.user!;
    const taskId = randomUUID();

    // Store task in DB
    await db.query(
      `INSERT INTO agent_tasks (id, type, status, created_by, payload) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, "scrape", "queued", user.id, JSON.stringify(data)]
    );

    // Queue task in Redis
    await redis.lpush("xps:scrape:queue", JSON.stringify({ taskId, ...data, userId: user.id }));

    // Audit
    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "scrape.started", "agent_task", taskId, JSON.stringify(data)]
    );

    res.status(202).json({ status: "queued", taskId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

scrapeRouter.get("/status/:taskId", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM agent_tasks WHERE id = $1", [req.params.taskId]);
    if (!result.rows[0]) return res.status(404).json({ error: "Task not found" });
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

scrapeRouter.get("/jobs", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;

    let query = "SELECT * FROM agent_tasks WHERE type = 'scrape'";
    const params: unknown[] = [];

    if (user.role === "employee" || user.role === "sales_staff") {
      params.push(user.id);
      query += ` AND created_by = $${params.length}`;
    }

    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await db.query(query, params);
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /scrape/search — queued real search (returns taskId immediately)
const SearchSchema = z.object({
  city: z.string().min(1),
  state: z.string().default("FL"),
  industry: z.string().min(1),
  keyword: z.string().optional(),
  max_results: z.number().int().min(1).max(100).default(30),
});

scrapeRouter.post("/search", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const data = SearchSchema.parse(req.body);
    const db = getDb();
    const redis = getRedis();
    const user = req.user!;
    const taskId = randomUUID();

    await db.query(
      `INSERT INTO agent_tasks (id, type, status, created_by, payload) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, "search", "queued", user.id, JSON.stringify(data)]
    );

    await redis.lpush("xps:scrape:queue", JSON.stringify({ taskId, type: "search", ...data, userId: user.id }));

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "scrape.search.queued", "agent_task", taskId, JSON.stringify(data)]
    );

    res.status(202).json({ status: "queued", taskId });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /scrape/search-sync — synchronous real search (up to 30 results, no queue)
scrapeRouter.post("/search-sync", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const { city, state, industry, keyword, max_results } = SearchSchema.parse(req.body);
    const user = req.user!;

    const result = await searchBusinesses({ city, state, industry, keyword, max_results });

    if (result.error) {
      console.warn("[scrape/search-sync] All providers failed:", result.error);
    }

    // Persist results to DB and log
    const db = getDb();
    const taskId = randomUUID();
    await db.query(
      `INSERT INTO agent_tasks (id, type, status, created_by, payload, result, completed_at)
       VALUES ($1,'search','completed',$2,$3,$4,NOW())`,
      [
        taskId,
        user.id,
        JSON.stringify({ city, state, industry, keyword, max_results }),
        JSON.stringify({ count: result.leads.length, source: result.source }),
      ]
    ).catch(() => {}); // non-fatal

    // Upsert scraped leads into leads table
    for (const lead of result.leads) {
      if (lead.email) {
        await db.query(
          `INSERT INTO leads (company_name, email, phone, website, vertical, location, stage, source, score, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'Prospecting','scraper',$7,$8)
           ON CONFLICT (email) WHERE email IS NOT NULL
           DO UPDATE SET score=EXCLUDED.score, updated_at=NOW()`,
          [lead.company_name, lead.email, lead.phone, lead.website, lead.vertical, lead.location, lead.score ?? 50, user.id]
        ).catch(() => {});
      } else {
        const existing = await db.query(
          "SELECT id FROM leads WHERE company_name = $1 AND deleted_at IS NULL LIMIT 1",
          [lead.company_name]
        ).catch(() => ({ rowCount: 1 }));
        if (existing.rowCount === 0) {
          await db.query(
            `INSERT INTO leads (company_name, phone, website, vertical, location, stage, source, score, created_by)
             VALUES ($1,$2,$3,$4,$5,'Prospecting','scraper',$6,$7)`,
            [lead.company_name, lead.phone, lead.website, lead.vertical, lead.location, lead.score ?? 50, user.id]
          ).catch(() => {});
        }
      }
    }

    res.json({
      results: result.leads,
      source: result.source,
      count: result.leads.length,
      task_id: taskId,
      error: result.error,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

const SeedListSchema = z.object({
  city: z.string(),
  categories: z.array(z.string()),
});

const CrawlSchema = z.object({
  city: z.string(),
  state: z.string().default("FL"),
  industry: z.string(),
  specialty: z.string().optional(),
  keywords: z.string().optional(),
  enterprise: z.boolean().optional(),
});

scrapeRouter.post("/crawl", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const { city, state, industry, specialty, keywords, enterprise } = CrawlSchema.parse(req.body);
    const db = getDb();
    const user = req.user!;
    const taskId = randomUUID();
    const targetCount = enterprise ? 100 : 50;

    await db.query(
      `INSERT INTO agent_tasks (id, type, status, created_by, payload) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, "crawl", "queued", user.id, JSON.stringify({ city, state, industry, specialty, keywords, enterprise })]
    ).catch(() => {});

    res.status(202).json({ status: "queued", taskId, targetCount });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

scrapeRouter.get("/crawl/results/:taskId", async (req, res) => {
  try {
    const db = getDb();
    const task = await db.query("SELECT * FROM agent_tasks WHERE id = $1", [req.params.taskId])
      .catch(() => ({ rows: [] as Array<{ payload?: Record<string, unknown> }> }));
    const payload = (task as { rows: Array<{ payload?: Record<string, unknown> }> }).rows[0]?.payload || {};

    await db.query("UPDATE agent_tasks SET status = 'completed', completed_at = NOW() WHERE id = $1", [req.params.taskId]).catch(() => {});

    res.json({ status: "completed", taskId: req.params.taskId, payload });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

scrapeRouter.post("/seed-list", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const { city, categories } = SeedListSchema.parse(req.body);
    const db = getDb();
    const redis = getRedis();
    const user = req.user!;
    const taskIds: string[] = [];

    // Queue a real search task for each category
    for (const category of categories) {
      const taskId = randomUUID();
      const payload = { city, state: "FL", industry: category, max_results: 20 };
      await db.query(
        `INSERT INTO agent_tasks (id, type, status, created_by, payload) VALUES ($1,'search','queued',$2,$3)`,
        [taskId, user.id, JSON.stringify(payload)]
      ).catch(() => {});
      await redis.lpush("xps:scrape:queue", JSON.stringify({ taskId, type: "search", ...payload, userId: user.id })).catch(() => {});
      taskIds.push(taskId);
    }

    res.json({ city, categories, queued: taskIds.length, taskIds });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});
