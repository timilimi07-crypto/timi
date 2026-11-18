import { db } from "@/lib/db";
import { startOfBerlinDay } from "@/server/ai/time";
import { listEmails, type EmailListItem } from "@/server/queries/emails";

/**
 * Tages-Digest pro Person: „Was ist heute für mich wichtig?“
 * Läuft auch im Worker – daher kein "server-only".
 * Bewusst ohne KI-Aufruf: Die Inhalte (Zusammenfassungen, Prioritäten, Aufgaben)
 * liegen bereits vor; der Digest kostet so nichts und ist sofort fertig.
 */

const DAY = 24 * 3600_000;
const PRIO_DE: Record<string, string> = { URGENT: "Dringend", HIGH: "Hoch", NORMAL: "Normal", LOW: "Niedrig" };
const PRIO_COLOR: Record<string, string> = { URGENT: "#b91c1c", HIGH: "#c2410c", NORMAL: "#52525b", LOW: "#71717a" };
const longDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
const dueFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

export type DigestData = {
  user: { id: string; name: string; email: string };
  organizationName: string;
  date: Date;
  assigned: EmailListItem[];
  important: EmailListItem[];
  tasks: { id: string; title: string; dueDate: Date | null; overdue: boolean; mine: boolean; subject: string | null }[];
  counts: { newSinceYesterday: number; urgentOpen: number; review: number; phishing: number };
};

export async function collectDigest(userId: string, now = new Date()): Promise<DigestData> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: { select: { id: true, name: true } } } });
  const orgId = user.organizationId;
  const today = startOfBerlinDay(now);
  const open = { organizationId: orgId, deletedAt: null, isArchived: false, status: { not: "DONE" as const } };
  const base = { view: "open" as const, sort: "priority" as const, review: false, phishing: false, unread: false };

  const [assignedPage, importantPage, tasks, newSinceYesterday, urgentOpen, review, phishing] = await Promise.all([
    listEmails(orgId, { ...base, assignee: userId }, { limit: 10, showCosts: false }),
    listEmails(orgId, base, { limit: 30, showCosts: false }),
    db.task.findMany({
      where: { organizationId: orgId, status: "OPEN", dueDate: { lt: new Date(today.getTime() + DAY) }, OR: [{ assigneeId: userId }, { assigneeId: null }] },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { email: { select: { subject: true } } },
    }),
    db.email.count({ where: { organizationId: orgId, deletedAt: null, isCollapsed: false, receivedAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.email.count({ where: { ...open, priority: "URGENT" } }),
    db.email.count({ where: { ...open, needsReview: true } }),
    db.email.count({ where: { ...open, phishingSuspected: true } }),
  ]);
  const assignedIds = new Set(assignedPage.items.map((i) => i.id));
  return {
    user: { id: user.id, name: user.name, email: user.email },
    organizationName: user.organization.name,
    date: now,
    assigned: assignedPage.items,
    important: importantPage.items
      .filter((i) => !assignedIds.has(i.id) && (i.priority === "URGENT" || i.priority === "HIGH" || i.phishingSuspected))
      .slice(0, 5),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      overdue: !!t.dueDate && t.dueDate < today,
      mine: t.assigneeId === userId,
      subject: t.email?.subject ?? null,
    })),
    counts: { newSinceYesterday, urgentOpen, review, phishing },
  };
}

/** Lohnt sich ein Digest? Ohne Zugewiesenes, Wichtiges, Fälliges und Neues wird nichts verschickt. */
export function isDigestEmpty(d: DigestData): boolean {
  return d.assigned.length === 0 && d.important.length === 0 && d.tasks.length === 0 && d.counts.newSinceYesterday === 0;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailRowHtml(e: EmailListItem, appUrl: string): string {
  const prio = e.priority ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${PRIO_COLOR[e.priority]}">${PRIO_DE[e.priority]}</span> ` : "";
  const phishing = e.phishingSuspected
    ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:#dc2626">Möglicher Phishing-Versuch</span> `
    : "";
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
    <div style="font-size:13px;color:#18181b">${phishing}${prio}<strong>${esc(e.fromName ?? e.fromEmail)}</strong></div>
    <div style="font-size:14px;margin-top:2px"><a href="${appUrl}/inbox?view=all&amp;id=${e.id}" style="color:#4338ca;text-decoration:none">${esc(e.subject)}</a></div>
    ${e.summary ? `<div style="font-size:13px;color:#52525b;margin-top:2px">${esc(e.summary)}</div>` : ""}
  </td></tr>`;
}

export function renderDigest(d: DigestData, appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")) {
  const first = d.user.name.split(" ")[0];
  const headline = [
    d.assigned.length ? `${d.assigned.length} dir zugewiesen` : null,
    d.counts.urgentOpen ? `${d.counts.urgentOpen} dringend` : null,
    d.tasks.length ? `${d.tasks.length} Aufgabe${d.tasks.length === 1 ? "" : "n"} fällig` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const subject = `MailMind – dein Tag: ${headline || "nichts Dringendes"}`;

  const section = (title: string, body: string) =>
    `<h2 style="font-size:15px;margin:24px 0 4px;color:#18181b">${title}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${body}</table>`;

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:12px;padding:24px" cellspacing="0" cellpadding="0"><tr><td>
  <div style="font-size:13px;color:#71717a">${esc(d.organizationName)} · ${longDay.format(d.date)}</div>
  <h1 style="font-size:20px;margin:6px 0 2px;color:#18181b">Guten Morgen, ${esc(first)}</h1>
  <div style="font-size:14px;color:#3f3f46">${esc(headline || "Heute liegt nichts Dringendes an.")}</div>
  <div style="font-size:13px;color:#71717a;margin-top:6px">${d.counts.newSinceYesterday} neue E-Mails seit gestern${d.counts.review ? ` · ${d.counts.review} zu prüfen` : ""}</div>
  ${d.counts.phishing ? `<div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px"><strong>Achtung:</strong> ${d.counts.phishing} mögliche${d.counts.phishing === 1 ? "r" : ""} Phishing-Versuch${d.counts.phishing === 1 ? "" : "e"} im Posteingang – keine Links oder Anhänge öffnen.</div>` : ""}
  ${d.assigned.length ? section("Dir zugewiesen", d.assigned.map((e) => emailRowHtml(e, appUrl)).join("")) : ""}
  ${d.important.length ? section("Außerdem wichtig im Team", d.important.map((e) => emailRowHtml(e, appUrl)).join("")) : ""}
  ${
    d.tasks.length
      ? section(
          "Heute fällig",
          d.tasks
            .map(
              (t) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;color:#18181b">☐ ${esc(t.title)}
              <span style="font-size:12px;color:${t.overdue ? "#b91c1c" : "#71717a"}">${t.dueDate ? ` · ${t.overdue ? "überfällig seit " : ""}${dueFmt.format(t.dueDate)}` : ""}${t.mine ? "" : " · Team"}</span>
              ${t.subject ? `<div style="font-size:12px;color:#71717a">${esc(t.subject)}</div>` : ""}</td></tr>`,
            )
            .join(""),
        )
      : ""
  }
  <div style="margin-top:28px"><a href="${appUrl}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">MailMind öffnen</a></div>
  <div style="margin-top:20px;font-size:11px;color:#a1a1aa">Du bekommst diese Zusammenfassung, weil der Tages-Digest in deinem Konto aktiv ist. Abbestellen: ${appUrl}/settings/account</div>
</td></tr></table></td></tr></table></body></html>`;

  const line = (e: EmailListItem) => `- ${e.phishingSuspected ? "[PHISHING?] " : ""}${e.priority ? `[${PRIO_DE[e.priority]}] ` : ""}${e.fromName ?? e.fromEmail}: ${e.subject}${e.summary ? `\n  ${e.summary}` : ""}`;
  const text = [
    `Guten Morgen, ${first}!`,
    `${d.organizationName} · ${longDay.format(d.date)}`,
    headline || "Heute liegt nichts Dringendes an.",
    `${d.counts.newSinceYesterday} neue E-Mails seit gestern.`,
    ...(d.counts.phishing ? [`ACHTUNG: ${d.counts.phishing} möglicher Phishing-Versuch im Posteingang.`] : []),
    ...(d.assigned.length ? ["", "DIR ZUGEWIESEN", ...d.assigned.map(line)] : []),
    ...(d.important.length ? ["", "AUSSERDEM WICHTIG", ...d.important.map(line)] : []),
    ...(d.tasks.length ? ["", "HEUTE FÄLLIG", ...d.tasks.map((t) => `- ${t.title}${t.overdue ? " (überfällig)" : ""}`)] : []),
    "",
    `${appUrl}/dashboard`,
  ].join("\n");

  return { subject, html, text };
}
