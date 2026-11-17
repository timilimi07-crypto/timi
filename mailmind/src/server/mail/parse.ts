import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { convert } from "html-to-text";
import type { Address, FetchedAttachment, FetchedMessage } from "./types";
import { cleanMessageId } from "./threading";

/** Obergrenzen, damit einzelne Riesen-Mails die Datenbank nicht sprengen. */
export const MAX_TEXT_LENGTH = 100_000;
export const MAX_HTML_LENGTH = 500_000;

export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  }).trim();
}

function toAddresses(obj: AddressObject | AddressObject[] | undefined): Address[] {
  if (!obj) return [];
  const list = Array.isArray(obj) ? obj : [obj];
  return list
    .flatMap((o) => o.value)
    .filter((a) => !!a.address)
    .map((a) => ({ email: a.address!.toLowerCase(), ...(a.name ? { name: a.name } : {}) }));
}

function toReferences(refs: string | string[] | undefined): string[] {
  if (!refs) return [];
  const list = Array.isArray(refs) ? refs : refs.split(/\s+/);
  return list.map(cleanMessageId).filter((x): x is string => !!x);
}

/** Echte Anhänge (keine eingebetteten Bilder einer HTML-Mail). */
function toAttachments(parsed: ParsedMail): FetchedAttachment[] {
  return parsed.attachments
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => !(a.related && a.contentId))
    .map(({ a, index }) => ({
      filename: a.filename ?? `Anhang-${index + 1}`,
      mimeType: a.contentType || "application/octet-stream",
      size: a.size ?? a.content?.length ?? 0,
      ...(a.contentId ? { contentId: a.contentId } : {}),
      providerAttachmentId: `idx:${index}`,
    }));
}

/**
 * RFC-822-Rohdaten (IMAP, Gmail raw) → normalisierte Nachricht.
 */
export async function parseRawMessage(
  raw: Buffer | string,
  meta: { providerMessageId?: string; providerThreadId?: string; isRead: boolean; fallbackDate?: Date },
): Promise<FetchedMessage> {
  const parsed = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  const messageIdHeader = cleanMessageId(parsed.messageId);
  const html = typeof parsed.html === "string" ? parsed.html : undefined;
  const text = (parsed.text?.trim() || (html ? htmlToText(html) : "")).slice(0, MAX_TEXT_LENGTH);
  const from = toAddresses(parsed.from)[0] ?? { email: "unbekannt@unbekannt" };

  return {
    providerMessageId: meta.providerMessageId ?? messageIdHeader ?? `${from.email}:${parsed.date?.getTime() ?? Date.now()}`,
    ...(meta.providerThreadId ? { providerThreadId: meta.providerThreadId } : {}),
    ...(messageIdHeader ? { messageIdHeader } : {}),
    ...(cleanMessageId(parsed.inReplyTo) ? { inReplyTo: cleanMessageId(parsed.inReplyTo) } : {}),
    references: toReferences(parsed.references),
    subject: parsed.subject?.trim() || "(kein Betreff)",
    from,
    to: toAddresses(parsed.to),
    cc: toAddresses(parsed.cc),
    ...(toAddresses(parsed.replyTo)[0] ? { replyTo: toAddresses(parsed.replyTo)[0]!.email } : {}),
    date: parsed.date ?? meta.fallbackDate ?? new Date(),
    text,
    ...(html ? { html: html.slice(0, MAX_HTML_LENGTH) } : {}),
    isRead: meta.isRead,
    attachments: toAttachments(parsed),
  };
}

/** Vorschautext für Listen: Zitate und Leerraum entfernt, max. 200 Zeichen. */
export function makeSnippet(text: string, max = 200): string {
  const withoutQuotes = text
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join(" ");
  const clean = withoutQuotes.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
