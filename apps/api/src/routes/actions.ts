import { Router } from "express";
import { getDb } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { z } from "zod";
import { randomUUID } from "crypto";

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

// ─── POST /api/actions/sms ────────────────────────────────────────────────────

const SmsSchema = z.object({
  lead_id: z.string().uuid(),
  to_phone: z.string().min(7),
  message: z.string().min(1).max(1600),
  ai_generated: z.boolean().optional().default(false),
});

actionsRouter.post(
  "/sms",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id, to_phone, message, ai_generated } = SmsSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;

      let sent = false;
      let sid: string | undefined;

      if (accountSid && authToken && fromPhone) {
        try {
          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: to_phone, From: fromPhone, Body: message }),
            }
          );

          if (twilioRes.ok) {
            const data = await twilioRes.json() as { sid?: string; status?: string };
            sid = data.sid;
            sent = true;
          } else {
            const errText = await twilioRes.text();
            console.warn("[Actions/SMS] Twilio error:", errText);
          }
        } catch (err) {
          console.warn("[Actions/SMS] Twilio request failed:", (err as Error).message);
        }
      } else {
        console.warn("[Actions/SMS] Twilio not configured — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER required");
      }

      const logId = randomUUID();
      await db.query(
        `INSERT INTO communication_log
           (id, lead_id, user_id, type, direction, status, content, ai_generated, provider, external_id, sent_at)
         VALUES ($1,$2,$3,'sms','outbound',$4,$5,$6,'twilio',$7,NOW())`,
        [logId, lead_id, user.id, sent ? "sent" : "failed", message, ai_generated, sid || null]
      );

      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "actions.sms", "lead", lead_id, JSON.stringify({ to_phone, sent, ai_generated })]
      );

      res.json({ sent, sid, log_id: logId });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /api/actions/email ──────────────────────────────────────────────────

const EmailSchema = z.object({
  lead_id: z.string().uuid(),
  to_email: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  ai_generated: z.boolean().optional().default(false),
});

actionsRouter.post(
  "/email",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id, to_email, subject, body, ai_generated } = EmailSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;

      let sent = false;
      let messageId: string | undefined;
      let provider = "none";

      const sendgridKey = process.env.SENDGRID_API_KEY;
      const gmailSecret = process.env.GMAIL_CLIENT_SECRET;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_FROM_EMAIL || "noreply@xpsintelligence.com";

      if (sendgridKey) {
        provider = "sendgrid";
        try {
          const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${sendgridKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to_email }] }],
              from: { email: fromEmail, name: "XPS Intelligence" },
              subject,
              content: [{ type: "text/plain", value: body }],
            }),
          });

          if (sgRes.ok || sgRes.status === 202) {
            sent = true;
            messageId = sgRes.headers.get("X-Message-Id") || randomUUID();
          } else {
            const errText = await sgRes.text();
            console.warn("[Actions/Email] SendGrid error:", errText);
          }
        } catch (err) {
          console.warn("[Actions/Email] SendGrid failed:", (err as Error).message);
        }
      } else if (gmailSecret) {
        // Gmail OAuth flow — requires valid tokens
        provider = "gmail";
        console.warn("[Actions/Email] Gmail OAuth not fully configured — email not sent");
      } else {
        console.warn("[Actions/Email] No email provider configured — set SENDGRID_API_KEY or GMAIL_CLIENT_SECRET");
      }

      const logId = randomUUID();
      await db.query(
        `INSERT INTO communication_log
           (id, lead_id, user_id, type, direction, status, content, ai_generated, provider, external_id, sent_at)
         VALUES ($1,$2,$3,'email','outbound',$4,$5,$6,$7,$8,NOW())`,
        [logId, lead_id, user.id, sent ? "sent" : "failed", `${subject}\n\n${body}`, ai_generated, provider, messageId || null]
      );

      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "actions.email", "lead", lead_id, JSON.stringify({ to_email, subject, sent, provider, ai_generated })]
      );

      res.json({ sent, message_id: messageId, log_id: logId, provider });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ─── POST /api/actions/schedule-followup ──────────────────────────────────────

const ScheduleSchema = z.object({
  lead_id: z.string().uuid(),
  schedule: z.array(z.object({
    day: z.number().int().min(0),
    action: z.string().min(1),
    channel: z.enum(["email", "sms", "call", "note"]).default("email"),
  })).min(1),
});

actionsRouter.post(
  "/schedule-followup",
  requireRole("sales_staff", "manager", "owner", "admin"),
  async (req, res) => {
    try {
      const { lead_id, schedule } = ScheduleSchema.parse(req.body);
      const db = getDb();
      const user = req.user!;

      const now = new Date();
      const insertedIds: string[] = [];

      for (const item of schedule) {
        const scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + item.day);
        const id = randomUUID();

        await db.query(
          `INSERT INTO follow_up_schedules
             (id, lead_id, user_id, scheduled_for, action, channel, status)
           VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
          [id, lead_id, user.id, scheduledFor.toISOString(), item.action, item.channel]
        );
        insertedIds.push(id);
      }

      await db.query(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "actions.schedule_followup", "lead", lead_id, JSON.stringify({ items: schedule.length })]
      );

      res.json({ scheduled: true, items: schedule.length, ids: insertedIds });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);
