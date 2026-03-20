import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(requireRole("manager", "owner", "admin"));

adminRouter.get("/employees", async (_req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.metadata, u.created_at,
       COUNT(DISTINCT l.id) as lead_count,
       MAX(al.created_at) as last_active
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id AND l.deleted_at IS NULL
       LEFT JOIN audit_logs al ON al.user_id = u.id
       WHERE u.role != 'admin'
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json({ employees: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const UpdateEmployeeSchema = z.object({
  role: z.enum(["employee", "sales_staff", "manager", "owner", "admin"]).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().optional(),
});

adminRouter.patch("/employees/:id", async (req, res) => {
  try {
    const data = UpdateEmployeeSchema.parse(req.body);
    const db = getDb();
    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.role !== undefined) { params.push(data.role); updates.push(`role = $${params.length}`); }
    if (data.is_active !== undefined) { params.push(data.is_active); updates.push(`is_active = $${params.length}`); }
    if (data.full_name !== undefined) { params.push(data.full_name); updates.push(`full_name = $${params.length}`); }
    if (updates.length === 0) return void res.status(400).json({ error: "No fields to update" });
    params.push(req.params.id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
