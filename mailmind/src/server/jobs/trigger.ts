import "server-only";
import { isQueueAvailable, enqueueMailboxSync, mailSyncQueue } from "./queues";
import { runMailboxSync } from "./sync-runner";
import type { SyncResult } from "@/server/mail/sync";

export type TriggerResult =
  | { mode: "queued"; count: number }
  | { mode: "inline"; results: SyncResult[] };

/**
 * Manueller Abruf (Sync-Button). Läuft ein Worker, wird der Abruf mit hoher
 * Priorität eingestellt. Ohne Redis/Worker (z. B. lokale Entwicklung ohne
 * `npm run worker`) wird direkt im Request abgerufen – das Limit pro Lauf gilt
 * auch hier.
 */
export async function triggerSync(mailboxIds: string[]): Promise<TriggerResult> {
  let workerRunning = false;
  if (await isQueueAvailable()) {
    workerRunning = (await mailSyncQueue().getWorkersCount().catch(() => 0)) > 0;
  }
  if (workerRunning) {
    for (const id of mailboxIds) await enqueueMailboxSync(id, "manual");
    return { mode: "queued", count: mailboxIds.length };
  }
  const results: SyncResult[] = [];
  for (const id of mailboxIds) results.push(await runMailboxSync(id, { enqueueAi: false }));
  return { mode: "inline", results };
}
