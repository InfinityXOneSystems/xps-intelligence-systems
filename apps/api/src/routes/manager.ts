import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const managerRouter = Router();
managerRouter.use(requireAuth);
managerRouter.use(requireRole("manager", "owner", "admin"));

managerRouter.get("/team", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;
    let whereClause = "WHERE u.role IN ('sales_staff', 'employee') AND u.is_active = true";
    const params: unknown[] = [];

    if (user.role === "manager" && user.location_id) {
      params.push(user.location_id);
      whereClause += ` AND u.location_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.metadata,
        COUNT(DISTINCT l.id) as lead_count,
        SUM(l.estimated_value) as pipeline_value,
        MAX(al.created_at) as last_active
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
       LEFT JOIN audit_logs al ON al.user_id = u.id
       ${whereClause}
       GROUP BY u.id ORDER BY lead_count DESC`,
      params
    );
    res.json({ team: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

managerRouter.get("/stats", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;
    let leadWhere = "WHERE l.deleted_at IS NULL";
    const params: unknown[] = [];

    if (user.role === "manager" && user.location_id) {
      params.push(user.location_id);
      leadWhere += ` AND l.location_id = $${params.length}`;
    }

    const stats = await db.query(
      `SELECT COUNT(*) as total_leads, SUM(estimated_value) as pipeline_value,
       COUNT(DISTINCT assigned_to) as active_reps
       FROM leads l ${leadWhere}`,
      params
    );

    res.json({ stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
