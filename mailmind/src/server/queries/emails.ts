import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Posteingang-Abfragen.
 *
 * Liste: eine Zeile pro Thread (die neueste passende E-Mail), gefiltert und
 * sortiert in einer SQL-Abfrage (DISTINCT ON), Volltextsuche über die
 * generierte Spalte "searchVector" (deutsche Stammformen, Präfixsuche beim
 * Tippen) plus ILIKE für Adressen und Nummern wie „PO-2026-8841“.
 * Paginierung per Cursor (stabil, auch wenn neue E-Mails eintreffen).
 */

const boolParam = z
  .union([z.boolean(), z.enum(["1", "true", "0", "false", ""])])
  .optional()
  .transform((v) => v === true || v === "1" || v === "true");

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const inboxFilterSchema = z.object({
  /** open = nicht erledigt (Standard), done = erledigt, all = alles */
  view: z.enum(["open", "done", "all"]).catch("open").default("open"),
  status: z.enum(["NEW", "IN_PROGRESS", "WAITING", "DONE"]).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  category: z.string().max(60).optional().catch(undefined),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).optional().catch(undefined),
  mailbox: z.string().max(40).optional().catch(undefined),
  from: z.string().trim().max(120).optional().catch(undefined),
  after: dateParam,
  before: dateParam,
  review: boolParam,
  phishing: boolParam,
  unread: boolParam,
  /** Newsletter & Spam: hide (Standard ohne Kategorie-Filter), only, show */
  bulk: z.enum(["hide", "only", "show"]).optional().catch(undefined),
  sort: z.enum(["newest", "priority"]).catch("newest").default("newest"),
});

export type InboxFilters = z.infer<typeof inboxFilterSchema>;

/** Filter aus URL-Parametern (Record oder URLSearchParams). Unbekanntes wird ignoriert. */
export function parseInboxFilters(input: Record<string, string | string[] | undefined> | URLSearchParams): InboxFilters {
  const obj: Record<string, string> = {};
  const entries = input instanceof URLSearchParams ? [...input.entries()] : Object.entries(input);
  for (const [k, v] of entries) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") obj[k] = val;
  }
  return inboxFilterSchema.parse(obj);
}

/** Effektive Newsletter/Spam-Behandlung: ohne Kategorie- oder Sonderfilter eingeklappt. */
export function effectiveBulk(f: InboxFilters): "hide" | "only" | "show" {
  if (f.bulk) return f.bulk;
  return f.category || f.q || f.review || f.phishing ? "show" : "hide";
}

/** Suchbegriff → tsquery mit Präfixsuche („angeb weber“ → angeb:* & weber:*). */
export function toPrefixTsQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

const PRIORITY_RANK = Prisma.sql`CASE e.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 WHEN 'LOW' THEN 3 ELSE 2 END`;

type Cursor = { r: number; t: string; i: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(s: string | undefined | null): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString()) as Cursor;
    return typeof c.r === "number" && typeof c.t === "string" && typeof c.i === "string" ? c : null;
  } catch {
    return null;
  }
}

/** Felder einer Listenzeile (bewusst ohne Text/HTML – schnell und klein). */
export const listSelect = {
  id: true,
  threadId: true,
  subject: true,
  fromName: true,
  fromEmail: true,
  snippet: true,
  summary: true,
  receivedAt: true,
  isRead: true,
  hasAttachments: true,
  status: true,
  aiStatus: true,
  priority: true,
  priorityReason: true,
  needsReview: true,
  reviewReason: true,
  phishingSuspected: true,
  isCollapsed: true,
  aiModels: true,
  aiCostUsd: true,
  mailbox: { select: { id: true, name: true } },
  category: { select: { key: true, name: true, color: true } },
  thread: { select: { messageCount: true } },
  _count: { select: { tasks: { where: { status: "OPEN" } } } },
} satisfies Prisma.EmailSelect;

export type EmailListRow = Prisma.EmailGetPayload<{ select: typeof listSelect }>;

/** Serialisierte Zeile für den Client (Datum als ISO, Decimal als Zahl). */
export type EmailListItem = Omit<EmailListRow, "receivedAt" | "aiCostUsd" | "_count"> & {
  receivedAt: string;
  aiCostUsd: number;
  openTasks: number;
};

export function serializeRow(r: EmailListRow, opts: { showCosts: boolean }): EmailListItem {
  const { _count, ...rest } = r;
  return {
    ...rest,
    receivedAt: r.receivedAt.toISOString(),
    aiCostUsd: opts.showCosts ? Number(r.aiCostUsd) : 0,
    aiModels: opts.showCosts ? r.aiModels : [],
    openTasks: _count.tasks,
  };
}

export type EmailPage = { items: EmailListItem[]; nextCursor: string | null };

export async function listEmails(
  organizationId: string,
  f: InboxFilters,
  opts: { cursor?: string | null; limit?: number; showCosts: boolean },
): Promise<EmailPage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const conds: Prisma.Sql[] = [
    Prisma.sql`e."organizationId" = ${organizationId}`,
    Prisma.sql`e."deletedAt" IS NULL`,
    Prisma.sql`e."isArchived" = false`,
  ];

  // Status gilt für den Verlauf = Status seiner neuesten (passenden) E-Mail.
  // Deshalb wird er erst NACH der Auswahl der neuesten E-Mail je Verlauf gefiltert –
  // sonst stünde ein erledigter Verlauf mit neuer Antwort in „Offen“ UND „Erledigt“.
  const statusCond = f.status
    ? Prisma.sql`t.status = ${f.status}::"EmailStatus"`
    : f.view === "open"
      ? Prisma.sql`t.status <> 'DONE'`
      : f.view === "done"
        ? Prisma.sql`t.status = 'DONE'`
        : Prisma.sql`TRUE`;

  if (f.category) conds.push(Prisma.sql`c.key = ${f.category}`);
  if (f.priority) conds.push(Prisma.sql`e.priority = ${f.priority}::"Priority"`);
  if (f.mailbox) conds.push(Prisma.sql`e."mailboxId" = ${f.mailbox}`);
  if (f.from) {
    const like = `%${f.from.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(Prisma.sql`(e."fromEmail" ILIKE ${like} OR e."fromName" ILIKE ${like})`);
  }
  // Datumsgrenzen als Kalendertage in Europe/Berlin.
  if (f.after) conds.push(Prisma.sql`e."receivedAt" >= (${f.after}::date::timestamp AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC')`);
  if (f.before) conds.push(Prisma.sql`e."receivedAt" < ((${f.before}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC')`);
  if (f.review) conds.push(Prisma.sql`e."needsReview" = true`);
  if (f.phishing) conds.push(Prisma.sql`e."phishingSuspected" = true`);
  if (f.unread) conds.push(Prisma.sql`e."isRead" = false`);

  const bulk = effectiveBulk(f);
  if (bulk === "hide") conds.push(Prisma.sql`e."isCollapsed" = false`);
  if (bulk === "only") conds.push(Prisma.sql`e."isCollapsed" = true`);

  if (f.q) {
    const ts = toPrefixTsQuery(f.q);
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(
      ts
        ? Prisma.sql`(e."searchVector" @@ to_tsquery('german', ${ts}) OR e."searchVector" @@ to_tsquery('simple', ${ts}) OR e.subject ILIKE ${like} OR e."fromEmail" ILIKE ${like})`
        : Prisma.sql`(e.subject ILIKE ${like} OR e."fromEmail" ILIKE ${like})`,
    );
  }

  const rank = f.sort === "priority" ? PRIORITY_RANK : Prisma.sql`0`;
  const cursor = decodeCursor(opts.cursor);
  const cursorCond = cursor
    ? Prisma.sql`AND (t.rank > ${cursor.r} OR (t.rank = ${cursor.r} AND (t."receivedAt" < ${new Date(cursor.t)} OR (t."receivedAt" = ${new Date(cursor.t)} AND t.id < ${cursor.i}))))`
    : Prisma.empty;

  const rows = await db.$queryRaw<{ id: string; receivedAt: Date; rank: number }[]>`
    WITH f AS (
      SELECT e.id, e."threadId", e."receivedAt", e.status, (${rank})::int AS rank
      FROM "Email" e
      LEFT JOIN "Category" c ON c.id = e."categoryId"
      WHERE ${Prisma.join(conds, " AND ")}
    ),
    t AS (
      SELECT DISTINCT ON (COALESCE("threadId", id)) id, "receivedAt", status, rank
      FROM f
      ORDER BY COALESCE("threadId", id), "receivedAt" DESC, id DESC
    )
    SELECT t.id, t."receivedAt", t.rank FROM t
    WHERE ${statusCond} ${cursorCond}
    ORDER BY t.rank ASC, t."receivedAt" DESC, t.id DESC
    LIMIT ${limit + 1}`;

  const page = rows.slice(0, limit);
  const records = await db.email.findMany({ where: { id: { in: page.map((r) => r.id) } }, select: listSelect });
  const byId = new Map(records.map((r) => [r.id, r]));
  const items = page.map((r) => byId.get(r.id)).filter((r): r is EmailListRow => !!r).map((r) => serializeRow(r, opts));
  const last = page[page.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ r: last.rank, t: last.receivedAt.toISOString(), i: last.id }) : null,
  };
}

/** Kennzahlen für die Filterleiste. */
export async function inboxCounts(organizationId: string) {
  const base = { organizationId, deletedAt: null, isArchived: false, status: { not: "DONE" as const } };
  const [review, phishing, bulk, unread] = await Promise.all([
    db.email.count({ where: { ...base, needsReview: true } }),
    db.email.count({ where: { ...base, phishingSuspected: true } }),
    db.email.count({ where: { ...base, isCollapsed: true } }),
    db.email.count({ where: { ...base, isRead: false, isCollapsed: false } }),
  ]);
  return { review, phishing, bulk, unread };
}
