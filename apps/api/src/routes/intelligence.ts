import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth);

// XPS pre-loaded taxonomy
const XPS_TAXONOMY = [
  { category: "product", name: "100% Solid Epoxy", description: "High-build flooring system with zero VOCs, maximum durability for industrial/commercial applications" },
  { category: "product", name: "Water-Based Epoxy", description: "Low-odor, easier application epoxy for residential and light commercial" },
  { category: "product", name: "Metallic Epoxy", description: "Decorative epoxy with metallic pigments creating unique 3D effects" },
  { category: "product", name: "Polyaspartic Coating", description: "Fast-cure topcoat with UV stability, ideal for fast-turnaround projects" },
  { category: "product", name: "Concrete Overlay", description: "Thin polymer-modified cement for resurfacing damaged concrete" },
  { category: "technique", name: "Diamond Grinding", description: "Surface preparation using diamond tooling to create proper profile for coatings" },
  { category: "technique", name: "Shot Blasting", description: "Abrasive surface prep method for industrial floors" },
  { category: "technique", name: "Acid Etching", description: "Chemical surface preparation for concrete floors" },
  { category: "technique", name: "Color Hardener Application", description: "Dry-shake color hardener for decorative concrete" },
  { category: "equipment", name: "Planetary Grinder", description: "Multi-head diamond grinding machine for large areas" },
  { category: "equipment", name: "Vacuum System", description: "HEPA dust containment system for grinding operations" },
  { category: "equipment", name: "Shot Blaster", description: "Steel shot machine for surface preparation" },
  { category: "chemical", name: "CSP Profile Standards", description: "Concrete surface profile standards 1-9 for coating adhesion" },
  { category: "market_segment", name: "Warehouse Flooring", description: "High-traffic industrial floors for logistics and distribution" },
  { category: "market_segment", name: "Garage Floor Coating", description: "Residential and commercial garage floor systems" },
  { category: "market_segment", name: "Commercial Showrooms", description: "Polished or coated concrete for retail and showroom environments" },
];

intelligenceRouter.get("/taxonomy", async (req, res) => {
  try {
    const db = getDb();
    const dbResult = await db.query("SELECT * FROM xps_taxonomy ORDER BY category, name").catch(() => ({ rows: [] }));
    const dbItems = (dbResult as { rows: unknown[] }).rows;

    // Merge pre-loaded taxonomy with DB items
    const allItems = [...XPS_TAXONOMY, ...dbItems];

    // Group by category
    const grouped: Record<string, typeof XPS_TAXONOMY> = {};
    for (const item of allItems) {
      const cat = (item as { category: string }).category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item as typeof XPS_TAXONOMY[0]);
    }

    res.json({ taxonomy: grouped, total: allItems.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.get("/kb", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM xps_knowledge_base ORDER BY relevance_score DESC, created_at DESC LIMIT 50"
    ).catch(() => ({ rows: [] }));
    res.json({ articles: (result as { rows: unknown[] }).rows, total: (result as { rows: unknown[] }).rows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const KBArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

intelligenceRouter.post("/kb", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const data = KBArticleSchema.parse(req.body);
    const db = getDb();
    const result = await db.query(
      `INSERT INTO xps_knowledge_base (title, content, category, tags, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.title, data.content, data.category, data.tags || [], data.source, req.user!.id]
    );
    res.status(201).json({ article: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.get("/distillation", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM xps_distillation_queue ORDER BY created_at DESC LIMIT 20"
    ).catch(() => ({ rows: [] }));
    res.json({ queue: (result as { rows: unknown[] }).rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

intelligenceRouter.post("/distillation", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const { source_url, source_type, content } = req.body as { source_url?: string; source_type?: string; content?: string };
    const db = getDb();
    const id = randomUUID();
    await db.query(
      `INSERT INTO xps_distillation_queue (id, source_url, source_type, content) VALUES ($1,$2,$3,$4)`,
      [id, source_url, source_type || "manual", content]
    );
    res.status(201).json({ id, status: "queued" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
