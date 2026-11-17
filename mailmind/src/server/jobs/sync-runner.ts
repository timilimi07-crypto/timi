import { syncMailbox, type SyncResult } from "@/server/mail/sync";
import { enqueueAiProcessing } from "./queues";

/**
 * Führt einen Abruf aus und stellt neue E-Mails in die KI-Warteschlange.
 * Wird vom Worker und (ohne Redis) direkt von der API genutzt.
 */
export async function runMailboxSync(mailboxId: string, opts: { enqueueAi?: boolean } = {}): Promise<SyncResult> {
  const result = await syncMailbox(mailboxId);
  if (result.newEmailIds.length && opts.enqueueAi !== false) {
    await enqueueAiProcessing(result.newEmailIds).catch((err) =>
      console.warn("[sync] KI-Warteschlange nicht erreichbar – E-Mails bleiben auf 'PENDING'.", err?.message),
    );
  }
  return result;
}
