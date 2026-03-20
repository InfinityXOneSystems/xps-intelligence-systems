import { Router } from "express";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const scrapeRouter = Router();
scrapeRouter.use(requireAuth);

const ScrapeSchema = z.object({
  url: z.string().url().optional(),
  company_name: z.string().optional(),
  query: z.string().optional(),
  mode: z.enum(["firecrawl", "steel", "auto"]).default("auto"),
});

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
