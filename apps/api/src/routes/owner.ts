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

/** POST /api/owner/simulation/run
 *  Runs the prediction simulation engine with custom parameters.
 */
ownerRouter.post("/simulation/run", async (req, res) => {
  const {
    lead_pool      = 100,
    followup_days  = 4,
    touchpoints    = 4,
    discount_pct   = 0,
    avg_deal_value = 4500,
    cost_per_lead  = 12,
  } = req.body as {
    lead_pool?: number;
    followup_days?: number;
    touchpoints?: number;
    discount_pct?: number;
    avg_deal_value?: number;
    cost_per_lead?: number;
  };

  // Conversion rate model (empirical coefficients derived from industry benchmarks)
  // Base rate: 12% for a typical 4-touchpoint, 4-day cadence sales process
  let convRate = 0.12;
  // Each additional touchpoint beyond baseline (3) adds ~1.5% conversion probability
  convRate += (touchpoints - 3) * 0.015;
  // Each extra day of gap beyond baseline (4) reduces urgency, dropping rate ~0.8%/day
  convRate -= (followup_days - 4) * 0.008;
  // A limited-time discount boosts close rate by ~3% (urgency + perceived value)
  convRate += discount_pct > 0 ? 0.03 : 0;
  // Hard bounds: minimum 2% (cold outreach floor), maximum 45% (exceptional campaigns)
  convRate = Math.max(0.02, Math.min(0.45, convRate));

  const closedDeals    = Math.round(lead_pool * convRate);
  const revenue        = closedDeals * avg_deal_value * (1 - discount_pct / 100);
  const totalCost      = lead_pool * cost_per_lead;
  const profit         = revenue - totalCost;
  const roi            = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;

  // ROI projections for 3 / 6 / 12 months
  const roiProjections = [3, 6, 12].map((months) => ({
    months,
    revenue:      Math.round(revenue * months),
    profit:       Math.round(profit * months),
    roi_pct:      roi,
    closed_deals: closedDeals * months,
  }));

  res.json({
    inputs: { lead_pool, followup_days, touchpoints, discount_pct, avg_deal_value, cost_per_lead },
    conversion_rate: Math.round(convRate * 1000) / 10,
    per_month: {
      closed_deals: closedDeals,
      revenue:      Math.round(revenue),
      profit:       Math.round(profit),
      roi_pct:      roi,
    },
    projections: roiProjections,
    efficiency_score: Math.min(10, Math.max(0, Math.round((roi / 30) * 10) / 10)),
    generated_at: new Date().toISOString(),
  });
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
