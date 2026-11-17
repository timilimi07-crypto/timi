/**
 * Thread-Zuordnung.
 * - Gmail/Outlook liefern eine Thread-ID (threadId / conversationId).
 * - Bei IMAP wird der Thread aus den Headern References/In-Reply-To abgeleitet:
 *   Wurzel ist die erste Message-ID in References, sonst In-Reply-To, sonst
 *   die eigene Message-ID. Fehlen alle Header, dient der normalisierte
 *   Betreff + Absender als Schlüssel.
 */

const SUBJECT_PREFIX = /^\s*((re|aw|antw|wg|fw|fwd|wtr|sv|vs)(\[\d+\])?\s*:\s*)+/i;

/** "AW: Re: WG: Angebot" → "Angebot" */
export function normalizeSubject(subject: string): string {
  return subject.replace(SUBJECT_PREFIX, "").replace(/\s+/g, " ").trim();
}

/** Entfernt spitze Klammern und Leerraum: "<abc@x>" → "abc@x". */
export function cleanMessageId(id: string | undefined | null): string | undefined {
  const v = id?.trim().replace(/^<|>$/g, "").trim();
  return v ? v : undefined;
}

export function deriveThreadKey(m: {
  providerThreadId?: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  fromEmail: string;
}): string {
  if (m.providerThreadId) return `p:${m.providerThreadId}`;
  const root = cleanMessageId(m.references[0]) ?? cleanMessageId(m.inReplyTo) ?? cleanMessageId(m.messageIdHeader);
  if (root) return `m:${root}`;
  return `s:${normalizeSubject(m.subject).toLowerCase()}|${m.fromEmail.toLowerCase()}`;
}

/** Alle Message-IDs, über die eine Nachricht mit einem bestehenden Thread verknüpft sein kann. */
export function relatedMessageIds(m: { inReplyTo?: string; references: string[] }): string[] {
  return [...new Set([...m.references, m.inReplyTo].map(cleanMessageId).filter((x): x is string => !!x))];
}
