import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const ownerRouter = Router();
ownerRouter.use(requireAuth);
ownerRouter.use(requireRole("owner", "admin"));

ownerRouter.get("/analytics", async (_req, res) => {
  try {
    const db = getDb();

    const [leadStats, userStats, proposalStats] = await Promise.all([
      db.query(`SELECT COUNT(*) as total, SUM(estimated_value) as pipeline,
        COUNT(DISTINCT assigned_to) as reps_active,
        COUNT(DISTINCT location_id) as locations_active
        FROM leads WHERE deleted_at IS NULL`),
      db.query(`SELECT role, COUNT(*) as cnt FROM users WHERE is_active = true GROUP BY role`),
      db.query(`SELECT status, COUNT(*) as cnt, SUM(total_value) as value FROM proposals GROUP BY status`),
    ]);

    res.json({
      leads: leadStats.rows[0],
      users_by_role: userStats.rows,
      proposals_by_status: proposalStats.rows,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

ownerRouter.post("/simulation/save", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;
    await db.query(
      "UPDATE users SET metadata = jsonb_set(metadata, '{last_simulation}', $1::jsonb) WHERE id = $2",
      [JSON.stringify(req.body), user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
