import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/summary", async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;

    let whereClause = "WHERE l.deleted_at IS NULL";
    const params: unknown[] = [];

    if (user.role === "sales_staff" || user.role === "employee") {
      params.push(user.id);
      whereClause += ` AND l.assigned_to = $${params.length}`;
    } else if (user.role === "manager" && user.location_id) {
      params.push(user.location_id);
      whereClause += ` AND l.location_id = $${params.length}`;
    }

    // Total leads
    const leadsResult = await db.query(
      `SELECT COUNT(*) as total, SUM(estimated_value) as pipeline FROM leads l ${whereClause}`,
      params
    );
    const { total, pipeline } = leadsResult.rows[0] as { total: string; pipeline: string | null };

    // Stage breakdown
    const stagesResult = await db.query(
      `SELECT stage, COUNT(*) as value FROM leads l ${whereClause} GROUP BY stage ORDER BY stage`,
      params
    );

    // Proposals
    let propWhere = "WHERE p.status IN ('sent','viewed','accepted','rejected')";
    if (user.role === "sales_staff" || user.role === "employee") {
      propWhere += ` AND p.created_by = '${user.id}'`;
    }
    const propResult = await db.query(
      `SELECT COUNT(*) as cnt, SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as won FROM proposals p ${propWhere}`
    ).catch(() => ({ rows: [{ cnt: "0", won: "0" }] }));
    const { cnt: propCnt, won } = propResult.rows[0] as { cnt: string; won: string | null };

    // Recent leads
    const recentLeadsResult = await db.query(
      `SELECT company_name, vertical, score, stage, estimated_value FROM leads l ${whereClause} ORDER BY l.created_at DESC LIMIT 5`,
      params
    );

    // Recent activities
    const activitiesResult = await db.query(
      `SELECT a.type, a.subject, a.created_at FROM activities a
       JOIN leads l ON a.lead_id = l.id ${whereClause.replace("WHERE", "WHERE l.deleted_at IS NULL AND")}
       ORDER BY a.created_at DESC LIMIT 5`,
      params
    ).catch(() => ({ rows: [] }));

    // Monthly revenue (last 9 months from proposals accepted)
    const monthlyResult = await db.query(
      `SELECT TO_CHAR(decided_at, 'Mon') as month, SUM(total_value) as value
       FROM proposals WHERE status = 'accepted' AND decided_at > NOW() - INTERVAL '9 months'
       GROUP BY TO_CHAR(decided_at, 'Mon'), DATE_TRUNC('month', decided_at)
       ORDER BY DATE_TRUNC('month', decided_at)`
    ).catch(() => ({ rows: [] }));

    const totalLeads = parseInt(total) || 0;
    const proposalsSent = parseInt(propCnt) || 0;
    const wonCount = parseInt(won || "0") || 0;
    const closeRate = proposalsSent > 0 ? Math.round((wonCount / proposalsSent) * 100 * 10) / 10 : 0;

    res.json({
      total_leads: totalLeads,
      pipeline_value: parseFloat(pipeline || "0") || 0,
      proposals_sent: proposalsSent,
      close_rate: closeRate,
      pipeline_stages: stagesResult.rows.map((r: { stage: string; value: string }) => ({
        name: r.stage,
        value: parseInt(r.value),
      })),
      monthly_revenue: (monthlyResult as { rows: { month: string; value: string }[] }).rows.map((r) => ({
        month: r.month,
        value: parseFloat(r.value),
      })),
      recent_leads: recentLeadsResult.rows,
      recent_activities: (activitiesResult as { rows: unknown[] }).rows,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
