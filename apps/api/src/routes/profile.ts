import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT id, email, full_name, role, location_id, metadata FROM users WHERE id = $1",
      [req.user!.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Profile not found" });
    const user = result.rows[0] as { metadata: Record<string, unknown>; [key: string]: unknown };
    const meta: Record<string, unknown> = (user.metadata as Record<string, unknown>) || {};
    res.json({
      ...user,
      job_title: meta.job_title || null,
      territory: meta.territory || null,
      specialty: meta.specialty || null,
      onboarding_complete: meta.onboarding_complete || false,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const UpdateProfileSchema = z.object({
  full_name: z.string().optional(),
  job_title: z.string().optional(),
  territory: z.string().optional(),
  specialty: z.string().optional(),
  division: z.string().optional(),
  onboarding_complete: z.boolean().optional(),
});

profileRouter.patch("/", async (req, res) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    const db = getDb();
    const existing = await db.query("SELECT metadata FROM users WHERE id = $1", [req.user!.id]);
    const existingMeta = ((existing.rows[0] as { metadata: Record<string, unknown> })?.metadata) || {};

    const newMeta = { ...existingMeta };
    if (data.job_title !== undefined) newMeta.job_title = data.job_title;
    if (data.territory !== undefined) newMeta.territory = data.territory;
    if (data.specialty !== undefined) newMeta.specialty = data.specialty;
    if (data.division !== undefined) newMeta.division = data.division;
    if (data.onboarding_complete !== undefined) newMeta.onboarding_complete = data.onboarding_complete;

    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.full_name !== undefined) {
      params.push(data.full_name);
      updates.push(`full_name = $${params.length}`);
    }
    params.push(JSON.stringify(newMeta));
    updates.push(`metadata = $${params.length}`);
    params.push(req.user!.id);

    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: (err as Error).message });
  }
});
