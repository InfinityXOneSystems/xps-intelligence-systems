import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(requireAuth);
auditRouter.use(requireRole("manager", "owner", "admin"));

auditRouter.get("/", async (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const result = await db.query(
      `SELECT al.*, u.email as user_email FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ logs: result.rows, limit, offset });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
