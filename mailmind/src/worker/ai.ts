import Anthropic from "@anthropic-ai/sdk";
import { DelayedError, Worker, type Job } from "bullmq";
import { checkOllama, OllamaError } from "@/server/ai/ollama";
import { createAiCaller, describeAiProvider, getAiProvider, isAiConfigured } from "@/server/ai/provider";
import { processEmail, summarizeThread } from "@/server/ai/pipeline";
import { applyRules } from "@/server/rules/engine";
import { enqueueThreadSummary, QUEUE_AI, workerConnection, type AiJobData } from "@/server/jobs/queues";

/**
 * KI-Worker: verarbeitet E-Mails (Job "process") und aktualisiert
 * Thread-Zusammenfassungen (Job "thread", entprellt pro Thread).
 * Anbieter über AI_PROVIDER (Standard Claude, alternativ lokal „ollama“).
 * Mit Claude ohne ANTHROPIC_API_KEY startet er nicht – die Jobs bleiben in
 * der Warteschlange und werden nach dem Eintragen des Schlüssels abgearbeitet.
 */
/** Pause, wenn der KI-Dienst nicht erreichbar ist (statt Fehlversuche zu verbrauchen). */
const UNAVAILABLE_PAUSE_MS = 60_000;

/** Vorübergehend nicht erreichbar? (lokaler Server aus, Netzwerk, Überlastung) */
export function isServiceUnavailable(err: unknown): boolean {
  if (err instanceof OllamaError) return /nicht erreichbar|nicht innerhalb/.test(err.message);
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) return err.status === 529 || (err.status ?? 0) >= 500 || err.status === 429;
  return false;
}

export function startAiWorker(): Worker | null {
  if (!isAiConfigured()) {
    console.warn("[ai] ANTHROPIC_API_KEY fehlt – KI-Verarbeitung pausiert. E-Mails bleiben auf „KI-Auswertung ausstehend“. Für lokale Tests: AI_PROVIDER=ollama.");
    return null;
  }
  const info = describeAiProvider();
  console.log(`[ai] KI-Anbieter: ${info.label} – ${info.detail}`);
  if (getAiProvider() === "ollama") {
    void checkOllama().then((r) => (r.ok ? console.log(`[ai] ${r.message}`) : console.warn(`[ai] ⚠ ${r.message}`)));
  }
  const caller = createAiCaller();

  const worker = new Worker<AiJobData>(
    QUEUE_AI,
    async (job: Job<AiJobData>, token?: string) => {
      if (job.name === "thread") {
        const r = await summarizeThread(job.data.threadId!, { caller });
        console.log(`[ai] Thread ${job.data.threadId}: ${r.status}${"mode" in r ? ` (${r.mode}, ${r.newEmails} neu)` : ` (${r.reason})`}`);
        return r;
      }

      let r: Awaited<ReturnType<typeof processEmail>>;
      try {
        r = await processEmail(job.data.emailId!, { caller });
      } catch (err) {
        if (isServiceUnavailable(err)) {
          // Ganze Warteschlange kurz anhalten; der Job kommt ohne Fehlversuch zurück.
          console.warn(`[ai] KI-Dienst nicht erreichbar – Pause ${UNAVAILABLE_PAUSE_MS / 1000} s: ${(err as Error).message}`);
          await worker.rateLimit(UNAVAILABLE_PAUSE_MS);
          throw Worker.RateLimitError();
        }
        throw err;
      }
      // Regeln nach der KI-Auswertung anwenden (auch wenn sie fehlschlug oder aufs Tageslimit wartet –
      // dann zumindest die Regeln auf Absender/Betreff/Text).
      if (r.status === "done" || r.status === "failed" || r.status === "deferred") {
        await applyRules(job.data.emailId!).catch((err) => console.error("[rules]", err));
      }
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
      concurrency: getAiProvider() === "ollama" ? 1 : 4,
      // Schutz vor Rate-Limits: höchstens 5 Jobs pro Sekunde.
      limiter: { max: 5, duration: 1000 },
      // Lokale Modelle rechnen auf einer Maschine – parallele Jobs bremsen sich nur gegenseitig aus.
    },
  );
  worker.on("failed", (job, err) => console.error(`[ai] Job ${job?.id} fehlgeschlagen (Versuch ${job?.attemptsMade}):`, err.message));
  console.log("[ai] KI-Worker bereit.");
  return worker;
}
