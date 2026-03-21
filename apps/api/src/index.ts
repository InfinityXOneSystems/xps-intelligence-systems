import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { leadsRouter } from "./routes/leads.js";
import { scrapeRouter } from "./routes/scrape.js";
import { agentsRouter } from "./routes/agents.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { auditRouter } from "./routes/audit.js";
import { healthRouter } from "./routes/health.js";
import { connectorsRouter } from "./routes/connectors.js";
import { analyticsRouter } from "./routes/analytics.js";
import { profileRouter } from "./routes/profile.js";
import { managerRouter } from "./routes/manager.js";
import { ownerRouter } from "./routes/owner.js";
import { adminRouter } from "./routes/admin.js";
import { intelligenceRouter } from "./routes/intelligence.js";
import { telemetryRouter } from "./routes/telemetry.js";
import { competeRouter } from "./routes/compete.js";
import { salesFlowRouter } from "./routes/sales-flow.js";
import { actionsRouter } from "./routes/actions.js";
import { feedbackRouter } from "./routes/feedback.js";
import { metricsRouter } from "./routes/metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Railway injects PORT; fall back to API_PORT for local dev
const PORT = process.env.PORT || process.env.API_PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || "*" }));
app.use(express.json({ limit: "10mb" }));

// Global rate limiter: 200 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

app.use(globalLimiter);

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/scrape", scrapeRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/audit", auditRouter);
app.use("/api/connectors", connectorsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/manager", managerRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/admin", adminRouter);
app.use("/api/intelligence", intelligenceRouter);
app.use("/api/telemetry", telemetryRouter);
app.use("/api/compete", competeRouter);
app.use("/api/sales-flow", salesFlowRouter);
app.use("/api/actions", actionsRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/metrics", metricsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// Serve React frontend static files in production (placed after API routes)
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  // SPA fallback — any non-API route serves index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[XPS API] Running on port ${PORT}`);
});

export default app;
