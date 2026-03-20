import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { leadsRouter } from "./routes/leads.js";
import { scrapeRouter } from "./routes/scrape.js";
import { agentsRouter } from "./routes/agents.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { auditRouter } from "./routes/audit.js";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || "*" }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/scrape", scrapeRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/audit", auditRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[XPS API] Running on port ${PORT}`);
});

export default app;
