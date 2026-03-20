import { Router } from "express";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const checks: Record<string, string> = { api: "ok" };

  try {
    const db = getDb();
    await db.query("SELECT 1");
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = `error: ${(err as Error).message}`;
  }

  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch (err) {
    checks.redis = `error: ${(err as Error).message}`;
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() });
});
