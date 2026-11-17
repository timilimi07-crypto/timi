/**
 * MailMind-Worker (eigener Prozess): npm run worker
 *
 *  - Scheduler: prüft jede Minute, welche Postfächer fällig sind
 *    (Abrufintervall der Firma bzw. offener Rückstand) und stellt Jobs ein.
 *  - mail-sync: führt Abrufe aus (max. 3 Postfächer parallel).
 *  - ai-process: folgt in Phase 3.
 */
import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { findDueMailboxes } from "@/server/mail/sync";
import { enqueueMailboxSync, mailSyncQueue, QUEUE_MAIL_SYNC, workerConnection, type SyncJobData } from "@/server/jobs/queues";
import { runMailboxSync } from "@/server/jobs/sync-runner";

const TICK = "tick";

async function main() {
  console.log("[worker] startet …");

  // Wiederkehrender Scheduler-Job (idempotent, auch bei mehreren Workern nur einmal).
  await mailSyncQueue().upsertJobScheduler(TICK, { every: 60_000 }, { name: TICK, data: { mailboxId: "", trigger: "schedule" } });

  const worker = new Worker<SyncJobData>(
    QUEUE_MAIL_SYNC,
    async (job) => {
      if (job.name === TICK) {
        const due = await findDueMailboxes();
        for (const id of due) await enqueueMailboxSync(id, "schedule");
        if (due.length) console.log(`[scheduler] ${due.length} Postfach/Postfächer fällig – Abruf eingestellt`);
        return { enqueued: due.length };
      }
      const r = await runMailboxSync(job.data.mailboxId);
      console.log(
        `[sync] ${job.data.mailboxId} (${job.data.trigger}): ${r.status}, neu ${r.created}, doppelt ${r.duplicates}, ` +
          `zu alt ${r.skippedOld}, Rückstand ${r.remaining}${r.error ? `, Fehler: ${r.error}` : ""}`,
      );
      return r;
    },
    { connection: workerConnection(), concurrency: 3 },
  );

  worker.on("failed", (job, err) => console.error(`[worker] Job ${job?.id} fehlgeschlagen:`, err.message));
  console.log("[worker] bereit – Abruf-Scheduler läuft (jede Minute).");

  const shutdown = async () => {
    console.log("[worker] fährt herunter …");
    await worker.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] Start fehlgeschlagen:", err);
  process.exit(1);
});
