import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const telemetryRouter = Router();
telemetryRouter.use(requireAuth);

/** GET /api/telemetry/scoring
 *  Returns efficiency / friction / lead scoring statistics.
 *  Used by the optimization agent and Owner portal.
 */
telemetryRouter.get("/scoring", requireRole("manager", "owner", "admin"), async (_req, res) => {
  try {
    const db = getDb();

    const [leadScores, workflowStats, proposalStats] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                       AS total_leads,
          ROUND(AVG(score))::int                         AS avg_score,
          COUNT(*) FILTER (WHERE score < 0 OR score > 100) AS out_of_range,
          COUNT(*) FILTER (WHERE score >= 80)            AS high_score,
          COUNT(*) FILTER (WHERE score >= 50 AND score < 80) AS mid_score,
          COUNT(*) FILTER (WHERE score < 50)             AS low_score
        FROM leads WHERE deleted_at IS NULL
      `).catch(() => ({
        rows: [{ total_leads: "0", avg_score: "0", out_of_range: "0", high_score: "0", mid_score: "0", low_score: "0" }],
      })),

      db.query(`
        SELECT
          COUNT(*) AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000))::int AS avg_duration_ms
        FROM agent_tasks
        WHERE created_at > NOW() - INTERVAL '7 days'
      `).catch(() => ({
        rows: [{ total_tasks: "0", completed: "0", failed: "0", avg_duration_ms: "0" }],
      })),

      db.query(`
        SELECT
          COUNT(*) AS sent,
          COUNT(*) FILTER (WHERE status = 'accepted') AS won,
          COUNT(*) FILTER (WHERE status = 'rejected') AS lost
        FROM proposals
      `).catch(() => ({
        rows: [{ sent: "0", won: "0", lost: "0" }],
      })),
    ]);

    const ls = leadScores.rows[0] as {
      total_leads: string; avg_score: string; out_of_range: string;
      high_score: string; mid_score: string; low_score: string;
    };
    const ws = workflowStats.rows[0] as {
      total_tasks: string; completed: string; failed: string; avg_duration_ms: string;
    };
    const ps = proposalStats.rows[0] as { sent: string; won: string; lost: string };

    const totalTasks  = parseInt(ws.total_tasks) || 1;
    const failureRate = totalTasks > 0 ? Math.round((parseInt(ws.failed) / totalTasks) * 100) : 0;

    const proposalsSent = parseInt(ps.sent) || 1;
    const closeRate = proposalsSent > 0 ? Math.round((parseInt(ps.won) / proposalsSent) * 100 * 10) / 10 : 0;

    // Composite efficiency score 0–10
    const efficiencyScore = Math.min(
      10,
      Math.max(
        0,
        10
          - failureRate * 0.05
          + closeRate * 0.03
          - (parseInt(ls.out_of_range) > 0 ? 0.5 : 0),
      )
    );

    res.json({
      leads: {
        total:        parseInt(ls.total_leads),
        avg_score:    parseInt(ls.avg_score),
        out_of_range: parseInt(ls.out_of_range),
        distribution: {
          high: parseInt(ls.high_score),
          mid:  parseInt(ls.mid_score),
          low:  parseInt(ls.low_score),
        },
      },
      workflows: {
        total_tasks:    parseInt(ws.total_tasks),
        completed:      parseInt(ws.completed),
        failed:         parseInt(ws.failed),
        failure_rate:   failureRate,
        avg_duration_ms: parseInt(ws.avg_duration_ms),
      },
      proposals: {
        sent:       parseInt(ps.sent),
        won:        parseInt(ps.won),
        lost:       parseInt(ps.lost),
        close_rate: closeRate,
      },
      scoring: {
        efficiency_score: Math.round(efficiencyScore * 10) / 10,
        friction_score:   Math.round(failureRate * 0.1 * 10) / 10,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/telemetry/event
 *  Records a telemetry event (page visit, action, error).
 */
telemetryRouter.post("/event", async (req, res) => {
  try {
    const { event_type, resource_type, resource_id, details } = req.body as {
      event_type: string;
      resource_type?: string;
      resource_id?: string;
      details?: Record<string, unknown>;
    };

    if (!event_type) return res.status(400).json({ error: "event_type is required" });

    const db = getDb();
    await db.query(
      `INSERT INTO telemetry_events (user_id, event_type, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id ?? null, event_type, resource_type ?? "telemetry", resource_id ?? null, JSON.stringify(details ?? {})]
    ).catch(() => undefined); // non-critical

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
