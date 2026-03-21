import "dotenv/config";
import { getRedis } from "./lib/redis.js";
import { getDb } from "./lib/db.js";
import { runScrapeTask, type ScrapeTask } from "./scraper.js";
import { searchBusinesses } from "./search-engine.js";

const QUEUE_KEY = "xps:scrape:queue";
const HEARTBEAT_KEY = "xps:worker:heartbeat";
const POLLING_INTERVAL = 2000;

async function processTask(taskData: string): Promise<void> {
  const task = JSON.parse(taskData) as ScrapeTask & {
    type?: string;
    city?: string;
    state?: string;
    industry?: string;
    keyword?: string;
    max_results?: number;
  };
  const db = getDb();

  try {
    console.log(`[Worker] Processing task ${task.taskId} (type: ${task.type || "scrape"})`);
    await db.query("UPDATE agent_tasks SET status='running', started_at=NOW() WHERE id=$1", [task.taskId]);

    if (task.type === "search") {
      // Real search engine task
      const result = await searchBusinesses({
        city: task.city || "Port St. Lucie",
        state: task.state || "FL",
        industry: task.industry || "businesses",
        keyword: task.keyword,
        max_results: task.max_results || 30,
      });

      // Persist each lead
      for (const lead of result.leads) {
        if (lead.email) {
          await db.query(
            `INSERT INTO leads (company_name, email, phone, website, vertical, location, stage, source, score, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,'Prospecting','scraper',$7,$8)
             ON CONFLICT (email) WHERE email IS NOT NULL
             DO UPDATE SET score=EXCLUDED.score, updated_at=NOW()`,
            [lead.company_name, lead.email, lead.phone ?? null, lead.website ?? null,
             lead.vertical ?? null, lead.location ?? null, lead.score ?? 50, task.userId]
          );
        } else {
          const existing = await db.query(
            "SELECT id FROM leads WHERE company_name = $1 AND deleted_at IS NULL LIMIT 1",
            [lead.company_name]
          );
          if (existing.rowCount === 0) {
            await db.query(
              `INSERT INTO leads (company_name, phone, website, vertical, location, stage, source, score, created_by)
               VALUES ($1,$2,$3,$4,$5,'Prospecting','scraper',$6,$7)`,
              [lead.company_name, lead.phone ?? null, lead.website ?? null,
               lead.vertical ?? null, lead.location ?? null, lead.score ?? 50, task.userId]
            );
          }
        }
      }

      await db.query(
        "UPDATE agent_tasks SET status='completed', result=$1, completed_at=NOW() WHERE id=$2",
        [JSON.stringify({ leads: result.leads.length, source: result.source, error: result.error }), task.taskId]
      );
      console.log(`[Worker] Search task ${task.taskId} completed: ${result.leads.length} leads via ${result.source}`);
    } else {
      // Legacy scrape task
      const result = await runScrapeTask(task);

      await db.query(
        "UPDATE agent_tasks SET status='completed', result=$1, completed_at=NOW() WHERE id=$2",
        [JSON.stringify(result), task.taskId]
      );

      if (result.company && result.leads) {
        for (const lead of result.leads) {
          if (lead.email) {
            await db.query(
              `INSERT INTO leads (company_name, contact_name, email, phone, website, vertical, location, stage, source, score, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'Prospecting','scraper',$8,$9)
               ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE SET score=EXCLUDED.score, updated_at=NOW()`,
              [lead.company_name, lead.contact_name ?? null, lead.email, lead.phone ?? null, lead.website ?? null,
               lead.vertical ?? null, lead.location ?? null, lead.score ?? 50, task.userId]
            );
          } else {
            const existing = await db.query(
              "SELECT id FROM leads WHERE company_name = $1 AND (website = $2 OR $2 IS NULL) AND deleted_at IS NULL LIMIT 1",
              [lead.company_name, lead.website ?? null]
            );
            if (existing.rowCount === 0) {
              await db.query(
                `INSERT INTO leads (company_name, contact_name, phone, website, vertical, location, stage, source, score, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,'Prospecting','scraper',$7,$8)`,
                [lead.company_name, lead.contact_name ?? null, lead.phone ?? null, lead.website ?? null,
                 lead.vertical ?? null, lead.location ?? null, lead.score ?? 50, task.userId]
              );
            }
          }
        }
      }
      console.log(`[Worker] Task ${task.taskId} completed with ${result.leads?.length || 0} leads`);
    }
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[Worker] Task ${task.taskId} failed:`, message);
    await db.query(
      "UPDATE agent_tasks SET status='failed', error=$1, completed_at=NOW() WHERE id=$2",
      [message, task.taskId]
    );
  }
}

async function main(): Promise<void> {
  console.log("[XPS Scraper Worker] Starting...");
  const redis = getRedis();

  // Publish heartbeat every 30s so metrics endpoint can detect active workers.
  // Store interval ref so we can clear it on SIGTERM/SIGINT.
  const heartbeatInterval = setInterval(async () => {
    try {
      await redis.set(HEARTBEAT_KEY, new Date().toISOString(), "EX", 60);
    } catch { /* non-fatal */ }
  }, 30_000);

  const shutdown = () => {
    clearInterval(heartbeatInterval);
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  await redis.set(HEARTBEAT_KEY, new Date().toISOString(), "EX", 60).catch(() => {});

  while (true) {
    try {
      const result = await redis.brpop(QUEUE_KEY, 2);
      if (result) {
        const [, taskData] = result;
        await processTask(taskData);
      }
    } catch (err) {
      console.error("[Worker] Loop error:", (err as Error).message);
      await new Promise((r) => setTimeout(r, POLLING_INTERVAL));
    }
  }
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
