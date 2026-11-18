/**
 * MailMind-Worker (eigener Prozess): npm run worker
 *
 *  - Scheduler: prüft jede Minute, welche Postfächer fällig sind
 *    (Abrufintervall der Firma bzw. offener Rückstand) und stellt Jobs ein.
 *  - mail-sync: führt Abrufe aus (max. 3 Postfächer parallel).
 *  - ai-process: KI-Auswertung (siehe worker/ai.ts).
 *  - Tages-Digest: zur eingestellten Uhrzeit pro Person (Job "digest").
 */
import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { findDueMailboxes } from "@/server/mail/sync";
import { isAiConfigured } from "@/server/ai/provider";
import { enqueueMailboxSync, enqueuePendingAi, mailSyncQueue, QUEUE_MAIL_SYNC, workerConnection, type SyncJobData } from "@/server/jobs/queues";
import { runMailboxSync } from "@/server/jobs/sync-runner";
import { startAiWorker } from "./ai";
import { findDueDigests, getTransport, sendDigest } from "@/server/digest/send";

const TICK = "tick";
let warnedNoSmtp = false;

/** Fällige Digests einstellen (feste jobId pro Person und Tag → kein Doppelversand). */
async function scheduleDigests() {
  if (!getTransport()) {
    if (!warnedNoSmtp) console.warn("[digest] SMTP_URL fehlt – Tages-Digest wird nicht verschickt (Vorschau unter Einstellungen → Mein Konto).");
    warnedNoSmtp = true;
    return;
  }
  const due = await findDueDigests();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  for (const userId of due) {
    await mailSyncQueue().add("digest", { mailboxId: userId, trigger: "schedule" }, { jobId: `digest-${userId}-${day}`, removeOnComplete: 500, removeOnFail: 500, attempts: 3, backoff: { type: "exponential", delay: 60_000 } });
  }
  if (due.length) console.log(`[digest] ${due.length} Digest(s) eingestellt`);
}

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
        if (isAiConfigured()) await enqueuePendingAi();
        await scheduleDigests();
        return { enqueued: due.length };
      }
      if (job.name === "digest") {
        const r = await sendDigest(job.data.mailboxId /* = userId */);
        console.log(`[digest] ${job.data.mailboxId}: ${r.status}${r.subject ? ` – ${r.subject}` : ""}`);
        return r;
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
  const aiWorker = startAiWorker();
  console.log("[worker] bereit – Abruf-Scheduler läuft (jede Minute).");

  const shutdown = async () => {
    console.log("[worker] fährt herunter …");
    await Promise.all([worker.close(), aiWorker?.close()]);
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
