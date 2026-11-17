import { DelayedError, Worker, type Job } from "bullmq";
import { createAnthropicCaller, isAiConfigured } from "@/server/ai/client";
import { processEmail, summarizeThread } from "@/server/ai/pipeline";
import { enqueueThreadSummary, QUEUE_AI, workerConnection, type AiJobData } from "@/server/jobs/queues";

/**
 * KI-Worker: verarbeitet E-Mails (Job "process") und aktualisiert
 * Thread-Zusammenfassungen (Job "thread", entprellt pro Thread).
 * Ohne ANTHROPIC_API_KEY startet er nicht – die Jobs bleiben in der
 * Warteschlange und werden nach dem Eintragen des Schlüssels abgearbeitet.
 */
export function startAiWorker(): Worker | null {
  if (!isAiConfigured()) {
    console.warn("[ai] ANTHROPIC_API_KEY fehlt – KI-Verarbeitung pausiert. E-Mails bleiben auf „KI-Auswertung ausstehend“.");
    return null;
  }
  const caller = createAnthropicCaller();

  const worker = new Worker<AiJobData>(
    QUEUE_AI,
    async (job: Job<AiJobData>, token?: string) => {
      if (job.name === "thread") {
        const r = await summarizeThread(job.data.threadId!, { caller });
        console.log(`[ai] Thread ${job.data.threadId}: ${r.status}${"mode" in r ? ` (${r.mode}, ${r.newEmails} neu)` : ` (${r.reason})`}`);
        return r;
      }

      const r = await processEmail(job.data.emailId!, { caller });
      if (r.status === "deferred") {
        // Tageslimit erreicht: Job auf den nächsten Tag verschieben (zählt nicht als Fehlversuch).
        await job.moveToDelayed(r.until.getTime(), token);
        throw new DelayedError();
      }
      if (r.status === "done" && r.threadId) await enqueueThreadSummary(r.threadId);
      console.log(`[ai] E-Mail ${job.data.emailId}: ${r.status}${"path" in r ? ` (${r.path}${r.needsReview ? ", Bitte prüfen" : ""})` : ""}${"error" in r ? ` – ${r.error}` : ""}`);
      return r;
    },
    {
      connection: workerConnection(),
      concurrency: 4,
      // Schutz vor Rate-Limits: höchstens 5 Jobs pro Sekunde.
      limiter: { max: 5, duration: 1000 },
    },
  );
  worker.on("failed", (job, err) => console.error(`[ai] Job ${job?.id} fehlgeschlagen (Versuch ${job?.attemptsMade}):`, err.message));
  console.log("[ai] KI-Worker bereit.");
  return worker;
}
