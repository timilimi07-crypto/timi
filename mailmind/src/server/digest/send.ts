import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { startOfBerlinDay } from "@/server/ai/time";
import { collectDigest, isDigestEmpty, renderDigest } from "./build";

let cached: Transporter | null | undefined;

/** SMTP-Versand über SMTP_URL (z. B. smtp://user:pass@smtp.firma.de:587). Ohne SMTP_URL: null. */
export function getTransport(): Transporter | null {
  if (cached === undefined) cached = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return cached;
}

/** Für Tests: eigenen Transport setzen. */
export function setTransportForTests(t: Transporter | null) {
  cached = t;
}

export type DigestSendResult = { status: "sent" | "skipped_empty" | "no_smtp"; subject?: string };

/** Digest für eine Person bauen und verschicken; Ergebnis landet im DigestLog. */
export async function sendDigest(userId: string, opts: { now?: Date; force?: boolean } = {}): Promise<DigestSendResult> {
  const now = opts.now ?? new Date();
  const data = await collectDigest(userId, now);
  if (!opts.force && isDigestEmpty(data)) {
    await db.digestLog.create({ data: { userId, success: true, stats: { skipped: "leer" } } });
    return { status: "skipped_empty" };
  }
  const transport = getTransport();
  if (!transport) return { status: "no_smtp" };

  const { subject, html, text } = renderDigest(data);
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM ?? "MailMind <no-reply@mailmind.local>", to: `"${data.user.name}" <${data.user.email}>`, subject, html, text });
    await db.digestLog.create({
      data: { userId, success: true, stats: { assigned: data.assigned.length, important: data.important.length, tasks: data.tasks.length, ...data.counts } },
    });
    return { status: "sent", subject };
  } catch (err) {
    await db.digestLog.create({ data: { userId, success: false, error: err instanceof Error ? err.message.slice(0, 500) : String(err) } });
    throw err;
  }
}

const hourFmt = new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", weekday: "short", timeZone: "Europe/Berlin" });

/**
 * Wer bekommt jetzt seinen Digest? Firma mit aktivem Digest, Uhrzeit (Berlin)
 * ab digestHour, ggf. nur werktags, Person aktiv + angemeldet, heute noch nicht versendet.
 */
export async function findDueDigests(now = new Date()): Promise<string[]> {
  const parts = hourFmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const weekend = weekday.startsWith("Sa") || weekday.startsWith("So");

  const orgs = await db.organization.findMany({
    where: { digestEnabled: true, digestHour: { lte: hour } },
    select: { id: true, digestWeekdaysOnly: true },
  });
  const orgIds = orgs.filter((o) => !(o.digestWeekdaysOnly && weekend)).map((o) => o.id);
  if (!orgIds.length) return [];
  const users = await db.user.findMany({
    where: {
      organizationId: { in: orgIds },
      isActive: true,
      digestOptIn: true,
      digestLogs: { none: { sentAt: { gte: startOfBerlinDay(now) }, success: true } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
