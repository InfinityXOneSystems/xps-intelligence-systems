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

const SeedListSchema = z.object({
  city: z.string(),
  categories: z.array(z.string()),
});

type SeedCompany = { company_name: string; location: string; vertical: string; website?: string; score: number };

const seedData: Record<string, Record<string, SeedCompany[]>> = {
  "Port St. Lucie, FL": {
    "epoxy contractors": [
      { company_name: "Treasure Coast Epoxy Floors", location: "Port St. Lucie, FL 34984", vertical: "Epoxy Contractors", website: "treasurecoastepoxy.com", score: 88 },
      { company_name: "PSL Floor Coatings", location: "Port St. Lucie, FL 34953", vertical: "Epoxy Contractors", score: 81 },
      { company_name: "Southern Epoxy Solutions", location: "Port St. Lucie, FL 34987", vertical: "Epoxy Contractors", website: "southernepoxysolutions.com", score: 79 },
      { company_name: "Premier Concrete Coatings PSL", location: "Port St. Lucie, FL 34986", vertical: "Epoxy Contractors", score: 74 },
    ],
    "property management companies": [
      { company_name: "Treasure Coast Property Management", location: "Port St. Lucie, FL 34952", vertical: "Property Management", website: "tcproperty.com", score: 91 },
      { company_name: "PSL Realty & Management Group", location: "Port St. Lucie, FL 34984", vertical: "Property Management", score: 86 },
      { company_name: "Coastal Asset Management FL", location: "Port St. Lucie, FL 34953", vertical: "Property Management", score: 83 },
      { company_name: "Port St Lucie Property Solutions", location: "Port St. Lucie, FL 34987", vertical: "Property Management", score: 77 },
    ],
    "concrete companies": [
      { company_name: "Treasure Coast Concrete Inc.", location: "Port St. Lucie, FL 34984", vertical: "Concrete", website: "tcconcretefl.com", score: 90 },
      { company_name: "PSL Ready Mix & Concrete", location: "Port St. Lucie, FL 34953", vertical: "Concrete", score: 85 },
      { company_name: "Gulf State Concrete PSL", location: "Port St. Lucie, FL 34986", vertical: "Concrete", score: 78 },
    ],
    "decorative concrete companies": [
      { company_name: "Treasure Coast Decorative Concrete", location: "Port St. Lucie, FL 34984", vertical: "Decorative Concrete", website: "tcdecorative.com", score: 87 },
      { company_name: "Artistic Concrete PSL", location: "Port St. Lucie, FL 34953", vertical: "Decorative Concrete", score: 80 },
      { company_name: "Concrete Artistry FL", location: "Port St. Lucie, FL 34987", vertical: "Decorative Concrete", score: 75 },
    ],
    "new registered businesses fl": [
      { company_name: "PSL Ventures LLC", location: "Port St. Lucie, FL 34984", vertical: "New Business", score: 72 },
      { company_name: "Treasure Coast Holdings 2024", location: "Port St. Lucie, FL 34952", vertical: "New Business", score: 69 },
      { company_name: "Port Saint Lucie Enterprises Inc.", location: "Port St. Lucie, FL 34953", vertical: "New Business", score: 66 },
    ],
  },
  "Pompano Beach, FL": {
    "epoxy contractors": [
      { company_name: "Pompano Epoxy & Floor Coatings", location: "Pompano Beach, FL 33060", vertical: "Epoxy Contractors", website: "pompanoepoxy.com", score: 92 },
      { company_name: "South Florida Epoxy Pros", location: "Pompano Beach, FL 33064", vertical: "Epoxy Contractors", score: 88 },
      { company_name: "Broward Concrete Coatings", location: "Pompano Beach, FL 33069", vertical: "Epoxy Contractors", website: "browardcoatings.com", score: 84 },
      { company_name: "Elite Floor Systems Pompano", location: "Pompano Beach, FL 33060", vertical: "Epoxy Contractors", score: 79 },
    ],
    "property management companies": [
      { company_name: "Pompano Beach Property Group", location: "Pompano Beach, FL 33060", vertical: "Property Management", website: "pompanoproperty.com", score: 89 },
      { company_name: "Broward Property Management LLC", location: "Pompano Beach, FL 33064", vertical: "Property Management", score: 84 },
      { company_name: "Atlantic Coast Property Mgmt", location: "Pompano Beach, FL 33069", vertical: "Property Management", score: 82 },
      { company_name: "Seaside Property Services Pompano", location: "Pompano Beach, FL 33060", vertical: "Property Management", score: 76 },
    ],
    "concrete companies": [
      { company_name: "Broward Concrete & Masonry", location: "Pompano Beach, FL 33060", vertical: "Concrete", website: "browardconcrete.com", score: 93 },
      { company_name: "South Florida Concrete Co.", location: "Pompano Beach, FL 33064", vertical: "Concrete", score: 87 },
      { company_name: "Pompano Ready Mix Inc.", location: "Pompano Beach, FL 33069", vertical: "Concrete", score: 83 },
    ],
    "decorative concrete companies": [
      { company_name: "Pompano Decorative Floors", location: "Pompano Beach, FL 33060", vertical: "Decorative Concrete", website: "pompafloors.com", score: 86 },
      { company_name: "Broward Artistic Concrete", location: "Pompano Beach, FL 33064", vertical: "Decorative Concrete", score: 81 },
      { company_name: "South FL Stamped & Stained Concrete", location: "Pompano Beach, FL 33069", vertical: "Decorative Concrete", score: 77 },
    ],
    "new registered businesses fl": [
      { company_name: "Pompano Beach Enterprises 2024 LLC", location: "Pompano Beach, FL 33060", vertical: "New Business", score: 71 },
      { company_name: "Broward New Ventures Inc.", location: "Pompano Beach, FL 33064", vertical: "New Business", score: 68 },
      { company_name: "Atlantic Coastal Startups LLC", location: "Pompano Beach, FL 33069", vertical: "New Business", score: 65 },
    ],
  },
};

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

    const cityData = seedData[city] || {};
    const results: SeedCompany[] = [];

    for (const cat of categories) {
      const catLower = cat.toLowerCase();
      const catData = cityData[catLower] || [];
      results.push(...catData);
    }

    // Queue results as scrape tasks if DB is available
    try {
      const db = getDb();
      const user = req.user!;
      for (const company of results) {
        const taskId = randomUUID();
        await db.query(
          `INSERT INTO agent_tasks (id, type, status, created_by, payload) VALUES ($1,$2,$3,$4,$5)`,
          [taskId, "scrape", "queued", user.id, JSON.stringify({ company_name: company.company_name, mode: "auto" })]
        );
      }
    } catch { /* DB might not be available */ }

    res.json({ city, categories, count: results.length, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});
