import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

/**
 * BullMQ-Warteschlangen.
 *  - mail-sync:    ein Job pro Postfach-Abruf + wiederkehrender "tick" (Scheduler)
 *  - ai-process:   KI-Verarbeitung einzelner E-Mails (Worker folgt in Phase 3)
 *
 * Dieses Modul wird von der Web-App (Jobs einstellen) und vom Worker genutzt.
 */
export const QUEUE_MAIL_SYNC = "mail-sync";
export const QUEUE_AI = "ai-process";

export type SyncJobData = { mailboxId: string; trigger: "schedule" | "manual" | "backlog" };
export type AiJobData = { emailId: string };

const globalForRedis = globalThis as unknown as { mmRedis?: IORedis; mmQueues?: Map<string, Queue> };

/** Gemeinsame Redis-Verbindung für Producer (fail fast, wenn Redis fehlt). */
export function producerConnection(): IORedis {
  if (!globalForRedis.mmRedis) {
    globalForRedis.mmRedis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      lazyConnect: false,
    });
    globalForRedis.mmRedis.on("error", () => {}); // Fehler werden beim Einstellen behandelt.
  }
  return globalForRedis.mmRedis;
}

/** Eigene Verbindung für Worker (BullMQ verlangt maxRetriesPerRequest: null). */
export function workerConnection(): ConnectionOptions {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
}

function queue<T>(name: string): Queue<T> {
  globalForRedis.mmQueues ??= new Map();
  let q = globalForRedis.mmQueues.get(name);
  if (!q) {
    q = new Queue(name, { connection: producerConnection() });
    q.on("error", () => {});
    globalForRedis.mmQueues.set(name, q);
  }
  return q as Queue<T>;
}

export const mailSyncQueue = () => queue<SyncJobData>(QUEUE_MAIL_SYNC);
export const aiQueue = () => queue<AiJobData>(QUEUE_AI);

/**
 * Abruf für ein Postfach einstellen. Die feste jobId verhindert, dass dasselbe
 * Postfach mehrfach in der Warteschlange steht.
 */
export async function enqueueMailboxSync(mailboxId: string, trigger: SyncJobData["trigger"]) {
  await mailSyncQueue().add(
    "sync",
    { mailboxId, trigger },
    {
      jobId: `sync-${mailboxId}`,
      priority: trigger === "manual" ? 1 : 5,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 1,
    },
  );
}

/** Neue E-Mails zur KI-Verarbeitung einstellen (Verarbeitung ab Phase 3). */
export async function enqueueAiProcessing(emailIds: string[]) {
  if (emailIds.length === 0) return;
  await aiQueue().addBulk(
    emailIds.map((emailId) => ({
      name: "process",
      data: { emailId },
      opts: {
        jobId: `ai-${emailId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    })),
  );
}

/** Ist Redis erreichbar? (Für den Fallback „Abruf direkt ausführen“.) */
export async function isQueueAvailable(): Promise<boolean> {
  try {
    const c = producerConnection();
    if (c.status !== "ready") await new Promise((r) => setTimeout(r, 300));
    return (await Promise.race([c.ping(), new Promise((r) => setTimeout(() => r("timeout"), 1500))])) === "PONG";
  } catch {
    return false;
  }
}
