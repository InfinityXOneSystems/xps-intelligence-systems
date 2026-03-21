import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

// ─── AI helper ────────────────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Ollama fallback
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error("All AI providers unavailable");
    const data = await res.json() as { response: string };
    return data.response;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an XPS sales AI that analyzes feedback and improves sales recommendations. Return JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Groq: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

// ─── POST /api/feedback/outcome ───────────────────────────────────────────────

const OutcomeSchema = z.object({
  lead_id: z.string().uuid(),
  action_type: z.string().min(1),
  outcome: z.enum(["positive", "negative", "neutral"]),
  notes: z.string().optional(),
});

feedbackRouter.post(
  "/outcome",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id, action_type, outcome, notes } = OutcomeSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;

      // Compute score delta
      const scoreDelta = outcome === "positive" ? 8 : outcome === "negative" ? -5 : 0;

      // Store feedback event in action_outcomes
      await db.query(
        `INSERT INTO action_outcomes
           (lead_id, user_id, action_type, outcome, notes, score_delta)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [lead_id, user.id, action_type, outcome, notes || null, scoreDelta]
      );

      // Update lead score
      const leadResult = await db.query(
        `UPDATE leads
         SET score = GREATEST(0, LEAST(100, COALESCE(score, 50) + $1)), updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING score`,
        [scoreDelta, lead_id]
      );

      const updatedScore = (leadResult.rows[0] as Record<string, unknown> | undefined)?.score ?? 50;

      // Audit
      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "feedback.outcome", "lead", lead_id, JSON.stringify({ action_type, outcome, score_delta: scoreDelta })]
      );

      res.json({
        updated_score: updatedScore,
        improvement_delta: scoreDelta,
        outcome,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── GET /api/feedback/recommendations/:lead_id ────────────────────────────────

feedbackRouter.get("/recommendations/:lead_id", async (req, res) => {
  try {
    const db = getDb();
    const { lead_id } = req.params;

    const [leadResult, outcomesResult, sfResult] = await Promise.all([
      db.query(
        "SELECT company_name, vertical, score, stage FROM leads WHERE id = $1 AND deleted_at IS NULL",
        [lead_id]
      ),
      db.query(
        `SELECT action_type, outcome, notes, score_delta, created_at
         FROM action_outcomes WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [lead_id]
      ),
      db.query(
        "SELECT recommended_action, summary FROM sales_flow_records WHERE lead_id = $1 LIMIT 1",
        [lead_id]
      ),
    ]);

    if (!leadResult.rows[0]) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const lead = leadResult.rows[0] as Record<string, unknown>;
    const outcomes = outcomesResult.rows as Array<Record<string, unknown>>;
    const existingFlow = sfResult.rows[0] as Record<string, unknown> | undefined;

    const positiveActions = outcomes.filter((o) => o.outcome === "positive").map((o) => o.action_type);
    const negativeActions = outcomes.filter((o) => o.outcome === "negative").map((o) => o.action_type);

    let recommendations: string[];

    if (outcomes.length === 0) {
      recommendations = [
        `No feedback yet for ${lead.company_name}. Start with ${existingFlow?.recommended_action || "a call"}.`,
        "Track each interaction to enable AI-powered recommendations.",
      ];
    } else {
      try {
        const prompt = `Based on this sales feedback history, provide improved recommendations.

Lead: ${lead.company_name} (${lead.vertical}, score ${lead.score})
Stage: ${lead.stage}
Previous AI recommendation: ${existingFlow?.recommended_action || "none"}

Feedback history:
${outcomes.map((o) => `- ${o.action_type}: ${o.outcome} outcome${o.notes ? " (" + o.notes + ")" : ""}`).join("\n")}

Positive actions: ${positiveActions.join(", ") || "none"}
Negative actions: ${negativeActions.join(", ") || "none"}

Return JSON array of 3-5 specific, actionable recommendations:
["recommendation 1", "recommendation 2", "recommendation 3"]`;

        const aiResponse = await callAI(prompt);
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array");
        recommendations = JSON.parse(jsonMatch[0]) as string[];
      } catch {
        recommendations = [
          positiveActions.length > 0
            ? `Continue with ${positiveActions[0]} — it has shown positive results.`
            : "Try a different outreach channel.",
          negativeActions.length > 0
            ? `Avoid ${negativeActions[0]} — it has not been effective.`
            : "Maintain current approach.",
          `Lead score is ${lead.score}/100 — ${Number(lead.score) > 70 ? "prioritize for immediate close" : "continue nurturing"}.`,
        ];
      }
    }

    res.json({
      lead_id,
      company_name: lead.company_name,
      current_score: lead.score,
      total_interactions: outcomes.length,
      positive_outcomes: outcomes.filter((o) => o.outcome === "positive").length,
      negative_outcomes: outcomes.filter((o) => o.outcome === "negative").length,
      recommendations,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
