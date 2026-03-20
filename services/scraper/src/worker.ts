import "dotenv/config";
import { getRedis } from "./lib/redis.js";
import { getDb } from "./lib/db.js";
import { runScrapeTask, type ScrapeTask } from "./scraper.js";

const QUEUE_KEY = "xps:scrape:queue";
const POLLING_INTERVAL = 2000;

async function processTask(taskData: string): Promise<void> {
  const task: ScrapeTask = JSON.parse(taskData) as ScrapeTask;
  const db = getDb();

  try {
    console.log(`[Worker] Processing task ${task.taskId}`);
    await db.query("UPDATE agent_tasks SET status='running', started_at=NOW() WHERE id=$1", [task.taskId]);

    const result = await runScrapeTask(task);

    await db.query(
      "UPDATE agent_tasks SET status='completed', result=$1, completed_at=NOW() WHERE id=$2",
      [JSON.stringify(result), task.taskId]
    );

    // If lead context provided, enrich/create lead
    if (result.company && result.leads) {
      for (const lead of result.leads) {
        await db.query(
          `INSERT INTO leads (company_name, contact_name, email, phone, website, vertical, location, stage, source, score, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'Prospecting','scraper',$8,$9)
           ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE SET score=EXCLUDED.score, updated_at=NOW()`,
          [lead.company_name, lead.contact_name, lead.email, lead.phone, lead.website,
           lead.vertical, lead.location, lead.score, task.userId]
        );
      }
    }

    console.log(`[Worker] Task ${task.taskId} completed with ${result.leads?.length || 0} leads`);
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
