import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const agentsRouter = Router();
agentsRouter.use(requireAuth);

const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.enum(["manual", "schedule", "webhook", "lead_created", "lead_updated"]),
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(["scrape", "ai_enrich", "send_email", "update_lead", "notify", "condition"]),
    config: z.record(z.unknown()),
    next: z.string().optional(),
  })),
  is_active: z.boolean().default(true),
});

// List workflows
agentsRouter.get("/workflows", async (_req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM agent_workflows ORDER BY created_at DESC"
    );
    res.json({ workflows: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create workflow
agentsRouter.post("/workflows", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const data = WorkflowSchema.parse(req.body);
    const db = getDb();
    const user = req.user!;
    const id = randomUUID();

    const result = await db.query(
      `INSERT INTO agent_workflows (id, name, description, trigger, steps, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, data.name, data.description, data.trigger, JSON.stringify(data.steps), data.is_active, user.id]
    );

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "workflow.created", "agent_workflow", id, JSON.stringify({ name: data.name })]
    );

    res.status(201).json({ workflow: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get workflow
agentsRouter.get("/workflows/:id", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM agent_workflows WHERE id = $1", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Workflow not found" });
    res.json({ workflow: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update workflow
agentsRouter.put("/workflows/:id", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const data = WorkflowSchema.parse(req.body);
    const db = getDb();
    const user = req.user!;

    const result = await db.query(
      `UPDATE agent_workflows SET name=$1, description=$2, trigger=$3, steps=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [data.name, data.description, data.trigger, JSON.stringify(data.steps), data.is_active, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Workflow not found" });

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "workflow.updated", "agent_workflow", req.params.id, JSON.stringify({ name: data.name })]
    );

    res.json({ workflow: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

// Execute workflow
agentsRouter.post("/workflows/:id/execute", requireRole("manager", "owner", "admin"), async (req, res) => {
  try {
    const db = getDb();
    const user = req.user!;
    const taskId = randomUUID();

    const wfResult = await db.query("SELECT * FROM agent_workflows WHERE id = $1 AND is_active = true", [req.params.id]);
    if (!wfResult.rows[0]) return res.status(404).json({ error: "Workflow not found or inactive" });

    await db.query(
      `INSERT INTO agent_tasks (id, type, status, created_by, payload, workflow_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [taskId, "workflow_execution", "running", user.id, JSON.stringify(req.body), req.params.id]
    );

    await db.query(
      "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
      [user.id, "workflow.executed", "agent_workflow", req.params.id, JSON.stringify({ taskId })]
    );

    res.status(202).json({ status: "running", taskId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List tasks
agentsRouter.get("/tasks", async (_req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
