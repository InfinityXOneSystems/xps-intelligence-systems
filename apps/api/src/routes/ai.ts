import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const InvokeSchema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  model: z.string().optional(),
});

async function callGroq(prompt: string, context?: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const systemPrompt = "You are an XPS Intelligence AI sales assistant. Help sales reps with lead research, outreach drafting, and pipeline management. Be concise, professional, and actionable.";
  const fullPrompt = context ? `Context: ${JSON.stringify(context)}\n\nUser: ${prompt}` : prompt;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: fullPrompt }],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callOllama(prompt: string, context?: Record<string, unknown>): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const fullPrompt = context ? `Context: ${JSON.stringify(context)}\n\nUser: ${prompt}` : prompt;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3.2", prompt: fullPrompt, stream: false }),
  });

  if (!response.ok) throw new Error("Ollama API error");
  const data = await response.json() as { response: string };
  return data.response;
}

aiRouter.post("/invoke", async (req, res) => {
  try {
    const { prompt, context } = InvokeSchema.parse(req.body);

    let result: string;
    try {
      result = await callGroq(prompt, context);
    } catch (groqErr) {
      console.warn("[AI] Groq failed, falling back to Ollama:", (groqErr as Error).message);
      try {
        result = await callOllama(prompt, context);
      } catch (ollamaErr) {
        return res.status(503).json({ error: "All LLM providers unavailable", details: (ollamaErr as Error).message });
      }
    }

    res.json({ result, model: "groq/llama-3.3-70b-versatile" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});
