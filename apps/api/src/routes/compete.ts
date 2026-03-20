import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const competeRouter = Router();
competeRouter.use(requireAuth);

// Static competitor profiles (updated by competition-watch agent)
const COMPETITOR_PROFILES = [
  {
    id:         "polycoat-pro",
    name:       "PolyCoat Pro",
    type:       "Contractor",
    territory:  "Southeast FL",
    threat:     "high",
    price_tier: "budget",
    services:   ["epoxy flooring", "polyurea coatings", "garage floors"],
    recent_changes: [{ type: "price_change", detail: "15% off garage floor promo", date: "2 days ago" }],
  },
  {
    id:         "floorcraft-systems",
    name:       "FloorCraft Systems",
    type:       "Contractor",
    territory:  "Central FL",
    threat:     "medium",
    price_tier: "premium",
    services:   ["metallic epoxy", "commercial floors", "decorative concrete"],
    recent_changes: [{ type: "new_service", detail: "Added metallic epoxy service line", date: "1 week ago" }],
  },
  {
    id:         "epoxy-master-supply",
    name:       "EpoxyMaster Supply",
    type:       "Distributor",
    territory:  "National",
    threat:     "high",
    price_tier: "budget",
    services:   ["epoxy supplies", "contractor training", "DIY kits"],
    recent_changes: [{ type: "price_change", detail: "Polyaspartic systems +8% price increase", date: "3 days ago" }],
  },
  {
    id:         "grindtech-industries",
    name:       "GrindTech Industries",
    type:       "Manufacturer",
    territory:  "National",
    threat:     "low",
    price_tier: "ultra-premium",
    services:   ["diamond tooling", "surface prep equipment", "training"],
    recent_changes: [{ type: "new_product", detail: "Launched next-gen diamond tooling", date: "2 weeks ago" }],
  },
  {
    id:         "surface-pro-coatings",
    name:       "SurfacePro Coatings",
    type:       "Contractor",
    territory:  "Southwest FL",
    threat:     "medium",
    price_tier: "budget",
    services:   ["garage coatings", "warehouse floors", "concrete sealing"],
    recent_changes: [{ type: "expansion", detail: "Hired 3 new sales reps in Naples area", date: "1 week ago" }],
  },
];

/** GET /api/compete/profiles
 *  Returns all tracked competitor profiles.
 */
competeRouter.get("/profiles", async (_req, res) => {
  try {
    // Attempt to fetch stored signals from telemetry_events table
    const db = getDb();
    const stored = await db.query(
      `SELECT resource_id, details, created_at
       FROM telemetry_events
       WHERE event_type IN ('competition.profile', 'competition.signal')
       ORDER BY created_at DESC LIMIT 200`
    ).catch(() => ({ rows: [] }));

    res.json({
      competitors:     COMPETITOR_PROFILES,
      stored_signals:  (stored as { rows: unknown[] }).rows.length,
      last_updated:    new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/compete/signals
 *  Returns recent competitor intelligence signals stored in DB.
 */
competeRouter.get("/signals", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT resource_id as competitor_id, details, created_at
       FROM telemetry_events
       WHERE event_type = 'competition.signal'
       ORDER BY created_at DESC LIMIT 50`
    ).catch(() => ({ rows: [] }));

    res.json({ signals: (result as { rows: unknown[] }).rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/compete/summary
 *  Returns a threat assessment summary.
 */
competeRouter.get("/summary", requireRole("manager", "owner", "admin"), async (_req, res) => {
  const highThreat   = COMPETITOR_PROFILES.filter((c) => c.threat === "high").length;
  const medThreat    = COMPETITOR_PROFILES.filter((c) => c.threat === "medium").length;
  const lowThreat    = COMPETITOR_PROFILES.filter((c) => c.threat === "low").length;
  const recentSignals = COMPETITOR_PROFILES.flatMap((c) => c.recent_changes).length;

  res.json({
    total_tracked:   COMPETITOR_PROFILES.length,
    high_threat:     highThreat,
    medium_threat:   medThreat,
    low_threat:      lowThreat,
    recent_signals:  recentSignals,
    overall_threat:  highThreat >= 2 ? "elevated" : "moderate",
    last_updated:    new Date().toISOString(),
    xps_advantages:  [
      "Full-service franchise model vs. independent contractors",
      "Proven proprietary systems with warranty",
      "Comprehensive training + certification",
      "Standardized pricing across locations",
      "AI-powered lead intelligence and outreach",
    ],
    recommendations: [
      "Reinforce premium positioning vs. budget competitors",
      "Target commercial/industrial segments less contested by budget players",
      "Leverage franchise network for geographic coverage advantages",
      "Highlight warranty and support programs in sales process",
    ],
  });
});
