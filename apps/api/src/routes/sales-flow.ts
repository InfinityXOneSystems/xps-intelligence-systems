import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const salesFlowRouter = Router();
salesFlowRouter.use(requireAuth);

// ─── AI helpers ───────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert XPS sales AI assistant specializing in epoxy flooring and decorative concrete. Generate professional, actionable sales analysis in JSON format.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Groq: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callOllama(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("Ollama unavailable");
  const data = await res.json() as { response: string };
  return data.response;
}

async function callAI(prompt: string): Promise<string> {
  try {
    return await callGroq(prompt);
  } catch (err) {
    console.warn("[SalesFlow] Groq failed, trying Ollama:", (err as Error).message);
    return callOllama(prompt);
  }
}

// ─── POST /api/sales-flow/analyze ─────────────────────────────────────────────

const AnalyzeSchema = z.object({
  lead_id: z.string().uuid(),
});

salesFlowRouter.post(
  "/analyze",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id } = AnalyzeSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;

      const leadResult = await db.query(
        `SELECT id, company_name, contact_name, email, phone, website, vertical,
                location, stage, score, notes, estimated_value, created_at
         FROM leads WHERE id = $1 AND deleted_at IS NULL`,
        [lead_id]
      );

      if (!leadResult.rows[0]) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const lead = leadResult.rows[0] as Record<string, unknown>;

      const prompt = `Analyze this sales lead and generate a complete sales strategy.

Lead Information:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name || "Unknown"}
- Email: ${lead.email || "None"}
- Phone: ${lead.phone || "None"}
- Website: ${lead.website || "None"}
- Industry: ${lead.vertical || "Unknown"}
- Location: ${lead.location || "Unknown"}
- Current Stage: ${lead.stage}
- Score: ${lead.score || 50}/100
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "Unknown"}
- Notes: ${lead.notes || "None"}

Generate a comprehensive sales strategy. Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of this lead and opportunity",
  "recommended_action": "call|email|text",
  "script": "Full script for the recommended action (call script, email body, or SMS text)",
  "pricing_recommendation": "Specific pricing recommendation with rationale",
  "proposal_outline": "Bulleted outline of key proposal elements",
  "follow_up_schedule": [
    {"day": 1, "action": "Initial contact description"},
    {"day": 3, "action": "Follow-up description"},
    {"day": 7, "action": "Second follow-up"},
    {"day": 14, "action": "Final follow-up"},
    {"day": 30, "action": "Long-term nurture"}
  ]
}`;

      const aiResponse = await callAI(prompt);

      let parsed: Record<string, unknown>;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        parsed = {
          summary: aiResponse.slice(0, 300),
          recommended_action: "call",
          script: "Hi, this is [Your Name] from XPS Intelligence. I'm reaching out regarding flooring solutions for your business...",
          pricing_recommendation: "Standard commercial pricing: $4-7/sqft based on scope.",
          proposal_outline: "- Site assessment\n- Custom flooring solution\n- Timeline and pricing",
          follow_up_schedule: [
            { day: 1, action: "Initial call" },
            { day: 3, action: "Email follow-up" },
            { day: 7, action: "Second call" },
          ],
        };
      }

      // Upsert sales_flow_records
      const recordId = randomUUID();
      await db.query(
        `INSERT INTO sales_flow_records
           (id, lead_id, created_by, summary, recommended_action, script,
            pricing_recommendation, proposal_outline, follow_up_schedule, ai_model)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (lead_id) DO UPDATE SET
           summary = EXCLUDED.summary,
           recommended_action = EXCLUDED.recommended_action,
           script = EXCLUDED.script,
           pricing_recommendation = EXCLUDED.pricing_recommendation,
           proposal_outline = EXCLUDED.proposal_outline,
           follow_up_schedule = EXCLUDED.follow_up_schedule,
           ai_model = EXCLUDED.ai_model,
           updated_at = NOW()`,
        [
          recordId,
          lead_id,
          user.id,
          parsed.summary,
          parsed.recommended_action,
          parsed.script,
          parsed.pricing_recommendation,
          parsed.proposal_outline,
          JSON.stringify(parsed.follow_up_schedule),
          "groq/llama-3.3-70b-versatile",
        ]
      );

      // Audit
      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "sales_flow.analyzed", "lead", lead_id, JSON.stringify({ recommended_action: parsed.recommended_action })]
      );

      res.json({ lead_id, analysis: parsed, record_id: recordId });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── GET /api/sales-flow/:lead_id ─────────────────────────────────────────────

salesFlowRouter.get("/:lead_id", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT sfr.*, u.full_name as created_by_name
       FROM sales_flow_records sfr
       LEFT JOIN users u ON sfr.created_by = u.id
       WHERE sfr.lead_id = $1
       ORDER BY sfr.created_at DESC
       LIMIT 1`,
      [req.params.lead_id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "No sales flow analysis found for this lead" });
    }

    res.json({ record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/sales-flow/execute-action ──────────────────────────────────────

const ExecuteActionSchema = z.object({
  lead_id: z.string().uuid(),
  action_type: z.string().min(1),
  content: z.string().min(1),
  channel: z.enum(["sms", "email", "call", "note"]),
});

salesFlowRouter.post(
  "/execute-action",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id, action_type, content, channel } = ExecuteActionSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;
      const logId = randomUUID();

      // Queue Twilio SMS if configured
      let twilioSid: string | undefined;
      if (channel === "sms") {
        const twilioSid_env = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

        if (twilioSid_env && twilioToken && twilioFrom) {
          try {
            const leadPhoneResult = await db.query("SELECT phone FROM leads WHERE id = $1", [lead_id]);
            const phone = (leadPhoneResult.rows[0] as Record<string, string | undefined> | undefined)?.phone;
            if (phone) {
              const twilioRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioSid_env}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Basic ${Buffer.from(`${twilioSid_env}:${twilioToken}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ To: phone, From: twilioFrom, Body: content }),
                }
              );
              if (twilioRes.ok) {
                const twilioData = await twilioRes.json() as { sid?: string };
                twilioSid = twilioData.sid;
              }
            }
          } catch (err) {
            console.warn("[SalesFlow] Twilio SMS failed:", (err as Error).message);
          }
        } else {
          console.warn("[SalesFlow] Twilio not configured — SMS not sent");
        }
      }

      // Log to communication_log
      await db.query(
        `INSERT INTO communication_log
           (id, lead_id, user_id, type, direction, status, content, ai_generated, provider, external_id, sent_at)
         VALUES ($1,$2,$3,$4,'outbound','sent',$5,false,$6,$7,NOW())`,
        [logId, lead_id, user.id, channel, content, channel === "sms" ? "twilio" : channel, twilioSid || null]
      );

      // Audit
      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, `sales_flow.action.${channel}`, "lead", lead_id, JSON.stringify({ action_type, channel })]
      );

      res.json({ executed: true, log_id: logId, twilio_sid: twilioSid });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);
