import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getDb } from "../lib/db.js";
import { getRedis } from "../lib/redis.js";

export const connectorsRouter = Router();
connectorsRouter.use(requireAuth);

interface ConnectorStatus {
  name: string;
  status: "connected" | "configured" | "pending" | "error";
  category: string;
  lastChecked: string;
  details?: string;
}

function getConnectorStatuses(): ConnectorStatus[] {
  const now = new Date().toISOString();
  return [
    {
      name: "railway",
      status: process.env.RAILWAY_TOKEN ? "connected" : "pending",
      category: "Infrastructure",
      lastChecked: now,
      details: process.env.RAILWAY_TOKEN ? "Token configured" : "RAILWAY_TOKEN not set",
    },
    {
      name: "supabase",
      status: process.env.DATABASE_URL ? "connected" : "pending",
      category: "Database",
      lastChecked: now,
      details: process.env.DATABASE_URL ? "Connection string configured" : "DATABASE_URL not set",
    },
    {
      name: "github",
      status: process.env.GITHUB_TOKEN ? "connected" : "pending",
      category: "DevOps",
      lastChecked: now,
      details: process.env.GITHUB_TOKEN ? "Token configured" : "GITHUB_TOKEN not set",
    },
    {
      name: "google",
      status: process.env.GOOGLE_CLIENT_ID ? "configured" : "pending",
      category: "Auth / Workspace",
      lastChecked: now,
      details: process.env.GOOGLE_CLIENT_ID ? "Client ID configured" : "GOOGLE_CLIENT_ID not set",
    },
    {
      name: "hubspot",
      status: process.env.HUBSPOT_API_KEY ? "connected" : "pending",
      category: "CRM",
      lastChecked: now,
      details: process.env.HUBSPOT_API_KEY ? "API key configured" : "HUBSPOT_API_KEY not set",
    },
    {
      name: "firecrawl",
      status: process.env.FIRECRAWL_API_KEY ? "connected" : "pending",
      category: "Scraping",
      lastChecked: now,
      details: process.env.FIRECRAWL_API_KEY ? "API key configured" : "FIRECRAWL_API_KEY not set",
    },
    {
      name: "twilio",
      status: process.env.TWILIO_ACCOUNT_SID ? "configured" : "pending",
      category: "Communications",
      lastChecked: now,
      details: process.env.TWILIO_ACCOUNT_SID ? "Account SID configured" : "TWILIO_ACCOUNT_SID not set",
    },
    {
      name: "groq",
      status: process.env.GROQ_API_KEY ? "connected" : "pending",
      category: "AI / LLM",
      lastChecked: now,
      details: process.env.GROQ_API_KEY ? "API key configured" : "GROQ_API_KEY not set",
    },
  ];
}

connectorsRouter.get("/", (_req, res) => {
  try {
    const connectors = getConnectorStatuses();
    res.json({ connectors });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

connectorsRouter.post("/:name/test", requireRole("manager", "owner", "admin"), async (req, res) => {
  const { name } = req.params;
  try {
    let result: { success: boolean; latency?: number; message: string } = { success: false, message: "Unknown connector" };

    const start = Date.now();

    switch (name) {
      case "supabase": {
        try {
          const db = getDb();
          await db.query("SELECT 1");
          result = { success: true, latency: Date.now() - start, message: "PostgreSQL connection successful" };
        } catch (err) {
          result = { success: false, message: `DB error: ${(err as Error).message}` };
        }
        break;
      }
      case "railway": {
        if (!process.env.RAILWAY_TOKEN) {
          result = { success: false, message: "RAILWAY_TOKEN not configured" };
        } else {
          result = { success: true, latency: Date.now() - start, message: "Railway token present" };
        }
        break;
      }
      case "groq": {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          result = { success: false, message: "GROQ_API_KEY not configured" };
        } else {
          try {
            const response = await fetch("https://api.groq.com/openai/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (response.ok) {
              result = { success: true, latency: Date.now() - start, message: "Groq API reachable" };
            } else {
              result = { success: false, message: `Groq API returned ${response.status}` };
            }
          } catch (err) {
            result = { success: false, message: `Groq API error: ${(err as Error).message}` };
          }
        }
        break;
      }
      case "github": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
          result = { success: false, message: "GITHUB_TOKEN not configured" };
        } else {
          try {
            const response = await fetch("https://api.github.com/user", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              result = { success: true, latency: Date.now() - start, message: "GitHub API reachable" };
            } else {
              result = { success: false, message: `GitHub API returned ${response.status}` };
            }
          } catch (err) {
            result = { success: false, message: `GitHub API error: ${(err as Error).message}` };
          }
        }
        break;
      }
      case "firecrawl": {
        if (!process.env.FIRECRAWL_API_KEY) {
          result = { success: false, message: "FIRECRAWL_API_KEY not configured" };
        } else {
          result = { success: true, latency: Date.now() - start, message: "Firecrawl API key present" };
        }
        break;
      }
      case "hubspot": {
        if (!process.env.HUBSPOT_API_KEY) {
          result = { success: false, message: "HUBSPOT_API_KEY not configured" };
        } else {
          result = { success: true, latency: Date.now() - start, message: "HubSpot API key present" };
        }
        break;
      }
      case "google": {
        if (!process.env.GOOGLE_CLIENT_ID) {
          result = { success: false, message: "GOOGLE_CLIENT_ID not configured" };
        } else {
          result = { success: true, latency: Date.now() - start, message: "Google client ID present" };
        }
        break;
      }
      case "twilio": {
        if (!process.env.TWILIO_ACCOUNT_SID) {
          result = { success: false, message: "TWILIO_ACCOUNT_SID not configured" };
        } else {
          result = { success: true, latency: Date.now() - start, message: "Twilio Account SID present" };
        }
        break;
      }
      default:
        result = { success: false, message: `Unknown connector: ${name}` };
    }

    res.json({ connector: name, tested: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// NOTE: Credential configuration requires secure server-side secret storage (e.g., Railway env vars).
// This endpoint intentionally does not accept or store credentials to prevent accidental exposure.
connectorsRouter.post("/:name/configure", requireRole("owner", "admin"), (req, res) => {
  const { name } = req.params;
  const knownConnectors = ["railway", "supabase", "github", "google", "hubspot", "firecrawl", "twilio", "groq"];
  if (!knownConnectors.includes(name)) {
    return res.status(404).json({ error: `Unknown connector: ${name}` });
  }
  res.json({
    connector: name,
    message: `To configure '${name}', set the required environment variable on your Railway service and redeploy.`,
    docs: "https://docs.railway.app/reference/variables",
  });
});
