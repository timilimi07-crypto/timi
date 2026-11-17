// Kernlogik: E-Mails aufnehmen, auswerten, zuweisen, Verläufe, Übersichten, Antworten senden.
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { one, all, run, audit } from "./db.js";
import * as ai from "./ai/index.js";
import { CATEGORY_LABELS } from "./ai/local.js";
import { decrypt } from "./auth.js";

export const normSubject = (s) => (s || "").replace(/^\s*((re|aw|wg|fw|fwd|antw)\s*(\[\d+\])?\s*:\s*)+/i, "").trim().toLowerCase();
const nowIso = () => new Date().toISOString().slice(0, 19);

function threadKeyFor(db, companyId, { in_reply_to, subject, from_addr, to_addr, direction }) {
  if (in_reply_to) {
    const parent = one(db, "SELECT thread_key FROM emails WHERE company_id=? AND message_id=?", companyId, in_reply_to);
    if (parent) return parent.thread_key;
  }
  const external = (direction === "out" ? to_addr : from_addr).toLowerCase();
  return crypto.createHash("sha1").update(`${normSubject(subject)}|${external}`).digest("hex").slice(0, 16);
}

// Speichert eine eingehende Mail (doppelte Message-IDs werden ignoriert) und gibt ihre ID zurück.
export function ingestEmail(db, mailbox, mail) {
  const messageId = mail.message_id || `<${crypto.randomUUID()}@postfach.local>`;
  const existing = one(db, "SELECT id FROM emails WHERE mailbox_id=? AND message_id=?", mailbox.id, messageId);
  if (existing) return { id: existing.id, duplicate: true };
  const direction = mail.direction || "in";
  const rec = {
    in_reply_to: mail.in_reply_to || null, subject: mail.subject || "(ohne Betreff)",
    from_addr: mail.from_addr, to_addr: mail.to_addr || mailbox.address, direction,
  };
  const threadKey = threadKeyFor(db, mailbox.company_id, rec);
  const res = run(db, `INSERT INTO emails (company_id, mailbox_id, message_id, in_reply_to, thread_key, direction,
      from_name, from_addr, to_addr, subject, body, received_at, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    mailbox.company_id, mailbox.id, messageId, rec.in_reply_to, threadKey, direction,
    mail.from_name || null, rec.from_addr, rec.to_addr, rec.subject, mail.body || "",
    (mail.received_at || nowIso()).slice(0, 19), direction === "out" ? "answered" : "open");
  const id = Number(res.lastInsertRowid);
  if (direction === "out") {
    // Eine Antwort von uns markiert die offenen Mails im selben Verlauf als beantwortet.
    run(db, "UPDATE emails SET status='answered' WHERE company_id=? AND thread_key=? AND direction='in' AND status='open'", mailbox.company_id, threadKey);
  }
  return { id, duplicate: false };
}

function findDepartment(db, companyId, name) {
  if (!name) return null;
  return one(db, "SELECT id FROM departments WHERE company_id=? AND lower(name)=lower(?)", companyId, name)?.id ?? null;
}

// Zuweisung: Stichwort-Regeln vor Kategorie-Regeln, danach der Vorschlag der KI.
export function assign(db, email, category, aiDepartment) {
  const rules = all(db, "SELECT * FROM rules WHERE company_id=? ORDER BY (keyword IS NULL), id", email.company_id);
  const text = `${email.subject} ${email.body}`.toLowerCase();
  for (const r of rules) {
    const hit = r.keyword ? text.includes(r.keyword.toLowerCase()) : r.category === category;
    if (hit) return { department_id: r.department_id, assignee_id: r.user_id };
  }
  return { department_id: findDepartment(db, email.company_id, aiDepartment), assignee_id: null };
}

export async function processEmail(db, emailId) {
  const email = one(db, "SELECT * FROM emails WHERE id=?", emailId);
  if (!email || email.direction === "out") return null;
  const company = one(db, "SELECT * FROM companies WHERE id=?", email.company_id);
  const departments = all(db, "SELECT * FROM departments WHERE company_id=?", email.company_id);
  const history = all(db, "SELECT * FROM emails WHERE company_id=? AND thread_key=? AND id<>? ORDER BY received_at", email.company_id, email.thread_key, email.id);
  const { result: a, by } = await ai.analyze(email, company, departments, history);
  const { department_id, assignee_id } = assign(db, email, a.category, a.department);
  run(db, `UPDATE emails SET category=?, priority=?, sentiment=?, summary=?, draft=?, department_id=?, assignee_id=?, analyzed_by=?,
      status=CASE WHEN ?='spam' THEN 'spam' ELSE status END WHERE id=?`,
    a.category, a.priority, a.sentiment, a.summary, a.draft, department_id, assignee_id, by, a.category, email.id);
  run(db, "DELETE FROM tasks WHERE email_id=? AND done=0", email.id);
  for (const t of a.tasks || []) {
    const due = /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || "") ? t.due_date : null;
    run(db, "INSERT INTO tasks (company_id, email_id, title, due_date, assignee_id) VALUES (?,?,?,?,?)",
      email.company_id, email.id, t.title, due, assignee_id);
  }
  return one(db, "SELECT * FROM emails WHERE id=?", email.id);
}

export async function processPending(db, companyId = null) {
  const rows = companyId
    ? all(db, "SELECT id FROM emails WHERE company_id=? AND direction='in' AND category IS NULL ORDER BY received_at", companyId)
    : all(db, "SELECT id FROM emails WHERE direction='in' AND category IS NULL ORDER BY received_at");
  for (const r of rows) await processEmail(db, r.id);
  return rows.length;
}

// ---------- Übersichten ----------

export const PERIODS = {
  today: { label: "Heute", hours: 24 },
  week: { label: "Letzte 7 Tage", hours: 24 * 7 },
  month: { label: "Letzte 30 Tage", hours: 24 * 30 },
  all: { label: "Gesamter Zeitraum", hours: null },
};

function sinceFor(period) {
  const p = PERIODS[period] || PERIODS.week;
  return p.hours ? new Date(Date.now() - p.hours * 3600e3).toISOString().slice(0, 19) : "0000";
}

export function followups(db, companyId) {
  const company = one(db, "SELECT followup_hours FROM companies WHERE id=?", companyId);
  const cutoff = new Date(Date.now() - company.followup_hours * 3600e3).toISOString().slice(0, 19);
  return all(db, `SELECT e.* FROM emails e WHERE e.company_id=? AND e.direction='in' AND e.status='open'
      AND e.category NOT IN ('spam','info') AND e.received_at < ?
      AND NOT EXISTS (SELECT 1 FROM emails o WHERE o.company_id=e.company_id AND o.thread_key=e.thread_key AND o.direction='out' AND o.received_at > e.received_at)
      ORDER BY e.received_at`, companyId, cutoff);
}

export function stats(db, companyId, period = "week", mailboxId = null) {
  const since = sinceFor(period);
  const mb = mailboxId ? " AND mailbox_id=" + Number(mailboxId) : "";
  const q = (cond) => one(db, `SELECT count(*) n FROM emails WHERE company_id=? AND direction='in' AND received_at>=?${mb} ${cond}`, companyId, since).n;
  const today = new Date().toISOString().slice(0, 10);
  const byCategory = all(db, `SELECT category, count(*) n FROM emails WHERE company_id=? AND direction='in' AND received_at>=?${mb} GROUP BY category`, companyId, since);
  return {
    total: q(""), open: q("AND status='open'"), answered: q("AND status='answered'"), done: q("AND status='done'"),
    spam: q("AND status='spam'"), urgent_open: q("AND status='open' AND priority='hoch'"), negative: q("AND sentiment='negativ' AND status<>'spam'"),
    overdue_followups: followups(db, companyId).filter((e) => !mailboxId || e.mailbox_id === Number(mailboxId)).length,
    tasks_open: one(db, "SELECT count(*) n FROM tasks WHERE company_id=? AND done=0", companyId).n,
    tasks_due: one(db, "SELECT count(*) n FROM tasks WHERE company_id=? AND done=0 AND due_date<=?", companyId, today).n,
    by_category: Object.fromEntries(byCategory.map((r) => [r.category || "unbearbeitet", r.n])),
  };
}

// "Alle E-Mails zusammenfassen": Übersicht über einen Zeitraum, optional für ein Postfach.
export async function buildDigest(db, companyId, period = "week", mailboxId = null) {
  const company = one(db, "SELECT * FROM companies WHERE id=?", companyId);
  const since = sinceFor(period);
  const mb = mailboxId ? " AND mailbox_id=" + Number(mailboxId) : "";
  const items = all(db, `SELECT * FROM emails WHERE company_id=? AND direction='in' AND received_at>=?${mb} ORDER BY received_at DESC`, companyId, since);
  const s = stats(db, companyId, period, mailboxId);
  const label = (PERIODS[period] || PERIODS.week).label;
  const { result, by } = await ai.digest(company, s, items, label);
  const urgent = items.filter((e) => e.status === "open" && e.priority === "hoch")
    .map((e) => ({ id: e.id, subject: e.subject, from: e.from_name || e.from_addr, summary: e.summary }));
  const digest = { ...result, period, period_label: label, stats: s, urgent, generated_by: by, generated_at: nowIso(),
    category_labels: CATEGORY_LABELS };
  run(db, "INSERT INTO digests (company_id, scope, content) VALUES (?,?,?)", companyId, `${period}${mailboxId ? ":" + mailboxId : ""}`, JSON.stringify(digest));
  return digest;
}

// Zahlen für die Diagramme der Übersicht.
export function analytics(db, companyId, period = "week", mailboxId = null) {
  const days = { today: 7, week: 7, month: 30, all: 60 }[period] || 7;
  const start = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const mb = mailboxId ? " AND e.mailbox_id=" + Number(mailboxId) : "";
  const rows = all(db, `SELECT substr(e.received_at,1,10) d, coalesce(e.category,'unbearbeitet') c, count(*) n FROM emails e
      WHERE e.company_id=? AND e.direction='in' AND e.received_at>=?${mb} GROUP BY d, c`, companyId, start);
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.parse(start + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    series.push({ date: d, by_category: Object.fromEntries(rows.filter((r) => r.d === d).map((r) => [r.c, r.n])) });
  }
  const departments = all(db, `SELECT coalesce(d.name,'Nicht zugewiesen') department,
      sum(CASE WHEN e.priority='hoch' THEN 1 ELSE 0 END) urgent, count(*) open
      FROM emails e LEFT JOIN departments d ON d.id=e.department_id
      WHERE e.company_id=? AND e.direction='in' AND e.status='open' AND e.category NOT IN ('spam','info')${mb}
      GROUP BY department ORDER BY open DESC`, companyId);
  // Antwortzeit: Zeit von Eingang bis zur ersten eigenen Antwort im selben Verlauf.
  const answered = all(db, `SELECT e.received_at r, (SELECT min(o.received_at) FROM emails o WHERE o.company_id=e.company_id
      AND o.thread_key=e.thread_key AND o.direction='out' AND o.received_at>e.received_at) a
      FROM emails e WHERE e.company_id=? AND e.direction='in' AND e.category NOT IN ('spam','info')${mb}`, companyId)
    .filter((x) => x.a).map((x) => (Date.parse(x.a + "Z") - Date.parse(x.r + "Z")) / 3600e3).sort((a, b) => a - b);
  const response = answered.length ? {
    count: answered.length,
    avg_hours: Math.round((answered.reduce((s, h) => s + h, 0) / answered.length) * 10) / 10,
    median_hours: Math.round(answered[Math.floor(answered.length / 2)] * 10) / 10,
    within_24h: Math.round((answered.filter((h) => h <= 24).length / answered.length) * 100),
  } : null;
  const senders = all(db, `SELECT coalesce(e.from_name, e.from_addr) sender, count(*) n FROM emails e
      WHERE e.company_id=? AND e.direction='in' AND e.status<>'spam' AND e.received_at>=?${mb} GROUP BY e.from_addr ORDER BY n DESC, max(e.received_at) DESC LIMIT 5`, companyId, start);
  return { days: series, departments, response, senders };
}

export async function threadView(db, companyId, threadKey) {
  const emails = all(db, "SELECT * FROM emails WHERE company_id=? AND thread_key=? ORDER BY received_at", companyId, threadKey);
  if (!emails.length) return null;
  const { result } = await ai.threadSummary(emails);
  return { thread_key: threadKey, summary: result, emails };
}

// ---------- Senden ----------

const isLocalHost = (h) => /^(localhost|127\.\d+\.\d+\.\d+|::1)$/.test(h || "");

export function transportFor(mailbox) {
  if (!mailbox.smtp_host) return null; // Demo-Postfach: Antwort wird nur gespeichert
  const port = mailbox.smtp_port || 587;
  return nodemailer.createTransport({
    host: mailbox.smtp_host, port, secure: port === 465,
    requireTLS: !isLocalHost(mailbox.smtp_host), // Passwörter nie unverschlüsselt über das Internet senden
    auth: mailbox.smtp_user ? { user: mailbox.smtp_user, pass: decrypt(mailbox.smtp_pass) } : undefined,
  });
}

export async function sendReply(db, user, emailId, body) {
  const email = one(db, "SELECT * FROM emails WHERE id=? AND company_id=?", emailId, user.company_id);
  if (!email) throw Object.assign(new Error("E-Mail nicht gefunden"), { status: 404 });
  if (!body || !body.trim()) throw Object.assign(new Error("Antworttext fehlt"), { status: 400 });
  const mailbox = one(db, "SELECT * FROM mailboxes WHERE id=?", email.mailbox_id);
  const subject = /^(re|aw):/i.test(email.subject) ? email.subject : `AW: ${email.subject}`;
  const messageId = `<${crypto.randomUUID()}@${mailbox.address.split("@")[1] || "postfach.local"}>`;
  const transport = transportFor(mailbox);
  let delivery = "gespeichert (Demo-Postfach, kein Versand)";
  if (transport) {
    const info = await transport.sendMail({
      from: mailbox.address, to: email.from_addr, subject, text: body, messageId,
      inReplyTo: email.message_id, references: email.message_id,
    });
    delivery = `versendet (${info.messageId || messageId})`;
  }
  const { id } = ingestEmail(db, mailbox, {
    message_id: messageId, in_reply_to: email.message_id, direction: "out",
    from_name: user.name, from_addr: mailbox.address, to_addr: email.from_addr, subject, body,
  });
  run(db, "UPDATE emails SET status='answered' WHERE id=?", email.id);
  audit(db, user.company_id, user.id, "antwort_gesendet", `Mail ${email.id}: ${delivery}`);
  return { id, delivery };
}

// ---------- IMAP-Abruf ----------

export async function syncImap(db, mailbox) {
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const port = mailbox.imap_port || 993;
  const client = new ImapFlow({
    host: mailbox.imap_host, port, secure: port === 993,
    doSTARTTLS: isLocalHost(mailbox.imap_host) ? false : true, // außer lokal (Tests) immer verschlüsselt
    auth: { user: mailbox.imap_user, pass: decrypt(mailbox.imap_pass) }, logger: false,
  });
  await client.connect();
  const ids = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    let maxUid = mailbox.last_uid;
    for await (const msg of client.fetch(`${mailbox.last_uid + 1}:*`, { uid: true, source: true }, { uid: true })) {
      if (msg.uid <= mailbox.last_uid) continue;
      const p = await simpleParser(msg.source);
      const from = p.from?.value?.[0] || {};
      const r = ingestEmail(db, mailbox, {
        message_id: p.messageId, in_reply_to: p.inReplyTo, from_name: from.name, from_addr: from.address || "unbekannt",
        to_addr: p.to?.value?.[0]?.address || mailbox.address, subject: p.subject, body: p.text || "",
        received_at: (p.date || new Date()).toISOString(),
      });
      if (!r.duplicate) ids.push(r.id);
      maxUid = Math.max(maxUid, msg.uid);
    }
    run(db, "UPDATE mailboxes SET last_uid=?, last_sync_at=? WHERE id=?", maxUid, nowIso(), mailbox.id);
  } finally {
    lock.release();
    await client.logout();
  }
  for (const id of ids) await processEmail(db, id);
  return ids.length;
}
