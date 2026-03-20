import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

const CreateLeadSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  vertical: z.string().optional(),
  location: z.string().optional(),
  stage: z.enum(["Prospecting", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]).default("Prospecting"),
  estimated_value: z.number().optional(),
  notes: z.string().optional(),
});

leadsRouter.get("/", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;

    let query = "SELECT * FROM leads WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    // Employees/sales_staff only see their assigned leads
    if (user.role === "employee" || user.role === "sales_staff") {
      params.push(user.id);
      query += ` AND assigned_to = $${params.length}`;
    }
    // Managers see leads in their location
    if (user.role === "manager" && user.location_id) {
      params.push(user.location_id);
      query += ` AND location_id = $${params.length}`;
    }

    query += " ORDER BY score DESC NULLS LAST, created_at DESC LIMIT 200";
    const result = await db.query(query, params);
    res.json({ leads: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

leadsRouter.post("/", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  try {
    const data = CreateLeadSchema.parse(req.body);
    const db = getDb();
    const user = req.user!;

    const result = await db.query(
      `INSERT INTO leads (company_name, contact_name, email, phone, website, vertical, location, stage,
       estimated_value, notes, assigned_to, location_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [data.company_name, data.contact_name, data.email, data.phone, data.website,
       data.vertical, data.location, data.stage, data.estimated_value, data.notes,
       user.id, user.location_id, user.id]
    );

    // Audit log
    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "lead.created", "lead", result.rows[0].id, JSON.stringify({ company_name: data.company_name })]
    );

    res.status(201).json({ lead: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

leadsRouter.get("/:id", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

leadsRouter.patch("/:id", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;
    const { stage, notes, estimated_value, score, assigned_to } = req.body as {
      stage?: string;
      notes?: string;
      estimated_value?: number;
      score?: number;
      assigned_to?: string;
    };

    const result = await db.query(
      `UPDATE leads SET stage = COALESCE($1, stage), notes = COALESCE($2, notes),
       estimated_value = COALESCE($3, estimated_value), score = COALESCE($4, score),
       assigned_to = COALESCE($5, assigned_to), updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
      [stage, notes, estimated_value, score, assigned_to, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Lead not found" });

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "lead.updated", "lead", req.params.id, JSON.stringify({ stage, notes })]
    );

    res.json({ lead: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /leads/bulk — import multiple leads at once (from Sales Staff scraper)

/** Build a normalized location string from a scraped lead record. */
function buildLocation(lead: Record<string, unknown>): string | null {
  const city = String(lead.city || "").trim();
  const state = String(lead.state || "").trim();
  const address = String(lead.address || "").trim();
  if (city || state) {
    const combined = [city, state].filter(Boolean).join(", ");
    return combined || address || null;
  }
  return address || null;
}

leadsRouter.post("/bulk", requireRole("sales_staff", "manager", "owner", "admin"), async (req, res) => {
  const { leads } = req.body as { leads: Array<Record<string, unknown>> };
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "leads array is required" });
  }
  try {
    const db = getDb();
    const user = req.user!;
    let inserted = 0;
    let skipped = 0;
    for (const lead of leads) {
      const companyName = String(lead.business_name || lead.company_name || "").trim();
      if (!companyName) continue;
      const result = await db.query(
        `INSERT INTO leads (company_name, contact_name, email, phone, website, vertical, location, stage,
         notes, assigned_to, created_by, score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (email) WHERE email IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          companyName,
          lead.owner_name || null,
          lead.email || null,
          lead.phone || null,
          lead.website || null,
          lead.industry || lead.vertical || null,
          buildLocation(lead),
          "Prospecting",
          lead.notes || null,
          user.id,
          user.id,
          typeof lead.score === "number" ? lead.score : null,
        ]
      ).catch(() => ({ rows: [] as { id: string }[] }));
      if ((result as { rows: { id: string }[] }).rows.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
    res.json({ inserted, skipped, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
