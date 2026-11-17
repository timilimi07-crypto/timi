// Browser-Demo: ersetzt den Server. Fängt alle Aufrufe an /api/... ab und beantwortet sie
// aus den mitgelieferten Testfirmen-Daten. Logik entspricht src/server.js und src/mail.js.
import DATA from "./demo-data.js";
import { analyzeLocal, digestLocal, threadSummaryLocal, CATEGORIES, CATEGORY_LABELS } from "./local.js";

const PASSWORD = "demo1234";
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const todayStr = () => new Date().toISOString().slice(0, 10);

// Zeiten relativ zu "jetzt" wiederherstellen, damit die Demo immer aktuell wirkt.
const db = {
  companies: DATA.companies.map((c) => ({ ...c })),
  departments: DATA.departments.map((d) => ({ ...d })),
  users: DATA.users.map((u) => ({ ...u, password: PASSWORD })),
  mailboxes: DATA.mailboxes.map((m) => ({ ...m, last_sync_at: null, last_error: null })),
  rules: DATA.rules.map((r) => ({ ...r })),
  emails: DATA.emails.map(({ hours_ago, ...e }) => ({ ...e, received_at: iso(NOW - hours_ago * 3600e3) })),
  tasks: DATA.tasks.map(({ due_in_days, ...t }) => ({ ...t, due_date: due_in_days == null ? null : new Date(Date.parse(todayStr() + "T12:00:00Z") + due_in_days * 864e5).toISOString().slice(0, 10) })),
  audit: [],
};
const nextId = (arr) => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
let me = null;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const need = (cond, status, msg) => { if (!cond) throw new HttpError(status, msg); };

const company = () => db.companies.find((c) => c.id === me.company_id);
const mine = (arr) => arr.filter((x) => x.company_id === me.company_id);
const deptName = (id) => db.departments.find((d) => d.id === id)?.name ?? null;
const userName = (id) => db.users.find((u) => u.id === id)?.name ?? null;
const mbName = (id) => db.mailboxes.find((m) => m.id === id)?.name ?? null;
const audit = (action, detail = "") => db.audit.unshift({ id: db.audit.length + 1, company_id: me.company_id, user_id: me.id, user: me.name, action, detail, created_at: iso(Date.now()) });

const PERIODS = { today: { label: "Heute", hours: 24 }, week: { label: "Letzte 7 Tage", hours: 168 }, month: { label: "Letzte 30 Tage", hours: 720 }, all: { label: "Gesamter Zeitraum", hours: null } };
const since = (p) => (PERIODS[p] || PERIODS.week).hours ? iso(Date.now() - (PERIODS[p] || PERIODS.week).hours * 3600e3) : "0000";
const incoming = (mb) => mine(db.emails).filter((e) => e.direction === "in" && (!mb || e.mailbox_id === Number(mb)));

function followups() {
  const cutoff = iso(Date.now() - company().followup_hours * 3600e3);
  return mine(db.emails).filter((e) => e.direction === "in" && e.status === "open" && !["spam", "info"].includes(e.category) && e.received_at < cutoff &&
    !db.emails.some((o) => o.company_id === e.company_id && o.thread_key === e.thread_key && o.direction === "out" && o.received_at > e.received_at))
    .sort((a, b) => a.received_at.localeCompare(b.received_at));
}

function stats(period = "week", mb = null) {
  const items = incoming(mb).filter((e) => e.received_at >= since(period));
  const n = (f) => items.filter(f).length;
  const tasks = mine(db.tasks).filter((t) => !t.done);
  const byCat = {};
  for (const e of items) byCat[e.category || "unbearbeitet"] = (byCat[e.category || "unbearbeitet"] || 0) + 1;
  return {
    total: items.length, open: n((e) => e.status === "open"), answered: n((e) => e.status === "answered"), done: n((e) => e.status === "done"),
    spam: n((e) => e.status === "spam"), urgent_open: n((e) => e.status === "open" && e.priority === "hoch"), negative: n((e) => e.sentiment === "negativ" && e.status !== "spam"),
    overdue_followups: followups().filter((e) => !mb || e.mailbox_id === Number(mb)).length,
    tasks_open: tasks.length, tasks_due: tasks.filter((t) => t.due_date && t.due_date <= todayStr()).length, by_category: byCat,
  };
}

function analytics(period = "week", mb = null) {
  const days = { today: 7, week: 7, month: 30, all: 60 }[period] || 7;
  const start = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const items = incoming(mb);
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.parse(start + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    const by = {};
    for (const e of items) if (e.received_at.startsWith(d)) by[e.category || "unbearbeitet"] = (by[e.category || "unbearbeitet"] || 0) + 1;
    series.push({ date: d, by_category: by });
  }
  const dep = new Map();
  for (const e of items.filter((e) => e.status === "open" && !["spam", "info"].includes(e.category))) {
    const k = deptName(e.department_id) || "Nicht zugewiesen";
    const x = dep.get(k) || { department: k, urgent: 0, open: 0 };
    x.open++; if (e.priority === "hoch") x.urgent++;
    dep.set(k, x);
  }
  const answered = items.filter((e) => !["spam", "info"].includes(e.category)).map((e) => {
    const out = db.emails.filter((o) => o.company_id === e.company_id && o.thread_key === e.thread_key && o.direction === "out" && o.received_at > e.received_at).map((o) => o.received_at).sort()[0];
    return out ? (Date.parse(out + "Z") - Date.parse(e.received_at + "Z")) / 3600e3 : null;
  }).filter((h) => h != null).sort((a, b) => a - b);
  const response = answered.length ? {
    count: answered.length, avg_hours: Math.round(answered.reduce((s, h) => s + h, 0) / answered.length * 10) / 10,
    median_hours: Math.round(answered[Math.floor(answered.length / 2)] * 10) / 10, within_24h: Math.round(answered.filter((h) => h <= 24).length / answered.length * 100),
  } : null;
  const snd = new Map();
  for (const e of items.filter((e) => e.status !== "spam" && e.received_at >= start)) {
    const x = snd.get(e.from_addr) || { sender: e.from_name || e.from_addr, n: 0, last: "" };
    x.n++; x.last = e.received_at > x.last ? e.received_at : x.last; snd.set(e.from_addr, x);
  }
  const senders = [...snd.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 5).map(({ sender, n }) => ({ sender, n }));
  return { days: series, departments: [...dep.values()].sort((a, b) => b.open - a.open), response, senders };
}

function digest(period = "week", mb = null) {
  const items = incoming(mb).filter((e) => e.received_at >= since(period)).sort((a, b) => b.received_at.localeCompare(a.received_at));
  const s = stats(period, mb);
  const label = (PERIODS[period] || PERIODS.week).label;
  const result = digestLocal(company(), s, items, label);
  const urgent = items.filter((e) => e.status === "open" && e.priority === "hoch").map((e) => ({ id: e.id, subject: e.subject, from: e.from_name || e.from_addr, summary: e.summary }));
  return { ...result, period, period_label: label, stats: s, urgent, generated_by: "lokal", generated_at: iso(Date.now()), category_labels: CATEGORY_LABELS };
}

const withJoins = (e) => ({
  ...e, department: deptName(e.department_id), assignee: userName(e.assignee_id), mailbox: mbName(e.mailbox_id),
  thread_count: db.emails.filter((t) => t.company_id === e.company_id && t.thread_key === e.thread_key).length,
});
const loadEmail = (id) => { const e = mine(db.emails).find((x) => x.id === Number(id)); need(e, 404, "E-Mail nicht gefunden"); return e; };

function assign(e, category) {
  const rules = mine(db.rules).sort((a, b) => (a.keyword ? 0 : 1) - (b.keyword ? 0 : 1) || a.id - b.id);
  const text = `${e.subject} ${e.body}`.toLowerCase();
  for (const r of rules) if (r.keyword ? text.includes(r.keyword.toLowerCase()) : r.category === category) return { department_id: r.department_id, assignee_id: r.user_id };
  return { department_id: null, assignee_id: null };
}

function reanalyze(e) {
  const a = analyzeLocal(e, company(), mine(db.departments));
  Object.assign(e, { category: a.category, priority: a.priority, sentiment: a.sentiment, summary: a.summary, draft: a.draft, analyzed_by: "lokal", ...assign(e, a.category) });
  if (a.category === "spam") e.status = "spam";
  db.tasks = db.tasks.filter((t) => !(t.email_id === e.id && !t.done));
  for (const t of a.tasks) db.tasks.push({ id: nextId(db.tasks), company_id: e.company_id, email_id: e.id, title: t.title, due_date: t.due_date, assignee_id: e.assignee_id, done: 0 });
  return e;
}

const ROUTES = [
  ["POST", /^\/api\/login$/, (b) => {
    const u = db.users.find((x) => x.email.toLowerCase() === String(b.email || "").toLowerCase());
    need(u && u.password === b.password, 401, "E-Mail oder Passwort falsch");
    me = u; return { ok: true };
  }, true],
  ["POST", /^\/api\/register$/, (b) => {
    need(b.company && b.name && b.email && b.password, 400, "Alle Felder ausfüllen");
    need(String(b.password).length >= 8, 400, "Passwort muss mindestens 8 Zeichen haben");
    need(!db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase()), 409, "E-Mail ist bereits registriert");
    const c = { id: nextId(db.companies), name: b.company, slug: "neu", plan: "start", tone: "freundlich und professionell, Sie-Form", signature: `${b.name}\n${b.company}`, knowledge: "", followup_hours: 48 };
    db.companies.push(c);
    const u = { id: nextId(db.users), company_id: c.id, department_id: null, name: b.name, email: b.email, role: "admin", password: b.password };
    db.users.push(u);
    db.mailboxes.push({ id: nextId(db.mailboxes), company_id: c.id, name: "Hauptpostfach", address: b.email, kind: "webhook", inbound_token: Math.random().toString(16).slice(2), last_sync_at: null, last_error: null });
    me = u; return [201, { ok: true }];
  }, true],
  ["POST", /^\/api\/logout$/, () => { me = null; return { ok: true }; }],
  ["GET", /^\/api\/me$/, () => ({
    user: { id: me.id, company_id: me.company_id, department_id: me.department_id, name: me.name, email: me.email, role: me.role },
    company: company(), ai: "Lokal (Regeln) · Demo", categories: CATEGORIES, category_labels: CATEGORY_LABELS,
  })],
  ["GET", /^\/api\/emails$/, (b, q) => {
    let list = incoming();
    if (q.status && q.status !== "all") list = list.filter((e) => e.status === q.status);
    if (!q.status) list = list.filter((e) => e.status !== "spam");
    if (q.category) list = list.filter((e) => e.category === q.category);
    if (q.priority) list = list.filter((e) => e.priority === q.priority);
    if (q.mailbox) list = list.filter((e) => e.mailbox_id === Number(q.mailbox));
    if (q.department) list = list.filter((e) => e.department_id === Number(q.department));
    if (q.mine === "1") list = list.filter((e) => e.assignee_id === me.id || (e.assignee_id == null && e.department_id === (me.department_id ?? -1)));
    if (q.q) { const t = q.q.toLowerCase(); list = list.filter((e) => [e.subject, e.body, e.from_addr, e.from_name].some((x) => (x || "").toLowerCase().includes(t))); }
    const rank = { hoch: 0, mittel: 1 };
    return list.sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || b.received_at.localeCompare(a.received_at)).map(withJoins);
  }],
  ["GET", /^\/api\/emails\/(\d+)$/, (b, q, [id]) => {
    const e = loadEmail(id);
    return { ...withJoins(e), tasks: mine(db.tasks).filter((t) => t.email_id === e.id),
      thread: mine(db.emails).filter((t) => t.thread_key === e.thread_key).sort((x, y) => x.received_at.localeCompare(y.received_at)) };
  }],
  ["PATCH", /^\/api\/emails\/(\d+)$/, (b, q, [id]) => {
    const e = loadEmail(id);
    if (b.status) need(["open", "answered", "done", "spam"].includes(b.status), 400, "Ungültiger Status");
    if (b.category) need(CATEGORIES.includes(b.category), 400, "Ungültige Kategorie");
    if (b.priority) need(["hoch", "mittel", "niedrig"].includes(b.priority), 400, "Ungültige Dringlichkeit");
    for (const k of ["status", "assignee_id", "department_id", "draft", "category", "priority"]) if (b[k] !== undefined) e[k] = b[k] === "" ? null : b[k];
    audit("mail_geaendert", `Mail ${e.id}`);
    return withJoins(e);
  }],
  ["POST", /^\/api\/emails\/(\d+)\/reanalyze$/, (b, q, [id]) => withJoins(reanalyze(loadEmail(id)))],
  ["POST", /^\/api\/emails\/(\d+)\/reply$/, (b, q, [id]) => {
    const e = loadEmail(id);
    need(b.body && b.body.trim(), 400, "Antworttext fehlt");
    const mb = db.mailboxes.find((m) => m.id === e.mailbox_id);
    const subject = /^(re|aw):/i.test(e.subject) ? e.subject : `AW: ${e.subject}`;
    db.emails.push({ id: nextId(db.emails), company_id: e.company_id, mailbox_id: e.mailbox_id, message_id: `<demo-${Date.now()}>`, in_reply_to: e.message_id, thread_key: e.thread_key,
      direction: "out", from_name: me.name, from_addr: mb.address, to_addr: e.from_addr, subject, body: b.body, received_at: iso(Date.now()), status: "answered" });
    for (const x of mine(db.emails)) if (x.thread_key === e.thread_key && x.direction === "in" && x.status === "open") x.status = "answered";
    e.status = "answered";
    audit("antwort_gesendet", `Mail ${e.id}: Demo`);
    return { id: nextId(db.emails) - 1, delivery: "gespeichert (Demo, kein echter Versand)" };
  }],
  ["GET", /^\/api\/threads\/([\w-]+)$/, (b, q, [key]) => {
    const emails = mine(db.emails).filter((e) => e.thread_key === key).sort((x, y) => x.received_at.localeCompare(y.received_at));
    need(emails.length, 404, "Verlauf nicht gefunden");
    return { thread_key: key, summary: threadSummaryLocal(emails), emails };
  }],
  ["GET", /^\/api\/stats$/, (b, q) => stats(q.period, q.mailbox)],
  ["GET", /^\/api\/digest$/, (b, q) => digest(q.period, q.mailbox)],
  ["GET", /^\/api\/analytics$/, (b, q) => analytics(q.period, q.mailbox)],
  ["GET", /^\/api\/followups$/, () => followups().map((e) => ({ id: e.id, subject: e.subject, from: e.from_name || e.from_addr, received_at: e.received_at, summary: e.summary, priority: e.priority }))],
  ["GET", /^\/api\/tasks$/, (b, q) => mine(db.tasks).filter((t) => q.open === "0" || !t.done).map((t) => {
    const e = db.emails.find((x) => x.id === t.email_id) || {};
    return { ...t, subject: e.subject, from_name: e.from_name, from_addr: e.from_addr, assignee: userName(t.assignee_id) };
  }).sort((a, b) => (a.due_date == null) - (b.due_date == null) || String(a.due_date).localeCompare(String(b.due_date)) || a.id - b.id)],
  ["PATCH", /^\/api\/tasks\/(\d+)$/, (b, q, [id]) => {
    const t = mine(db.tasks).find((x) => x.id === Number(id)); need(t, 404, "Aufgabe nicht gefunden");
    if (b.done !== undefined) t.done = b.done ? 1 : 0;
    if (b.assignee_id) t.assignee_id = b.assignee_id;
    if (b.due_date) t.due_date = b.due_date;
    return t;
  }],
  ["GET", /^\/api\/team$/, () => ({
    users: mine(db.users).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, department_id: u.department_id, department: deptName(u.department_id) })).sort((a, b) => a.name.localeCompare(b.name)),
    departments: mine(db.departments).sort((a, b) => a.name.localeCompare(b.name)),
  })],
  ["POST", /^\/api\/team\/users$/, (b) => {
    need(me.role === "admin", 403, "Nur für Administratoren");
    need(b.name && b.email && b.password && b.password.length >= 8, 400, "Name, E-Mail und Passwort (min. 8 Zeichen) nötig");
    need(!db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase()), 409, "E-Mail existiert bereits");
    const u = { id: nextId(db.users), company_id: me.company_id, department_id: b.department_id || null, name: b.name, email: b.email, role: b.role === "admin" ? "admin" : "member", password: b.password };
    db.users.push(u); return [201, { id: u.id }];
  }],
  ["POST", /^\/api\/team\/departments$/, (b) => {
    need(me.role === "admin", 403, "Nur für Administratoren"); need(b.name, 400, "Name fehlt");
    const d = { id: nextId(db.departments), company_id: me.company_id, name: b.name }; db.departments.push(d); return [201, { id: d.id }];
  }],
  ["GET", /^\/api\/settings$/, () => { need(me.role === "admin", 403, "Nur für Administratoren"); return company(); }],
  ["PUT", /^\/api\/settings$/, (b) => {
    need(me.role === "admin", 403, "Nur für Administratoren");
    const c = company();
    for (const k of ["name", "tone", "signature", "knowledge"]) if (b[k] != null) c[k] = b[k];
    if (b.followup_hours) c.followup_hours = Number(b.followup_hours);
    return c;
  }],
  ["GET", /^\/api\/rules$/, () => mine(db.rules).map((r) => ({ ...r, department: deptName(r.department_id), user: userName(r.user_id) }))],
  ["POST", /^\/api\/rules$/, (b) => {
    need(me.role === "admin", 403, "Nur für Administratoren"); need(b.category || b.keyword, 400, "Kategorie oder Stichwort angeben");
    const r = { id: nextId(db.rules), company_id: me.company_id, category: b.category || null, keyword: b.keyword || null, department_id: b.department_id || null, user_id: b.user_id || null };
    db.rules.push(r); return [201, { id: r.id }];
  }],
  ["DELETE", /^\/api\/rules\/(\d+)$/, (b, q, [id]) => { need(me.role === "admin", 403, "Nur für Administratoren"); db.rules = db.rules.filter((r) => !(r.id === Number(id) && r.company_id === me.company_id)); return { ok: true }; }],
  ["GET", /^\/api\/mailboxes$/, () => mine(db.mailboxes).map((m) => ({ ...m, inbound_url: m.kind === "demo" ? null : `/api/inbound/${m.inbound_token}`, inbound_email: m.kind === "demo" ? null : `${m.inbound_token}@eingang.beispiel.de` }))],
  ["POST", /^\/api\/mailboxes$/, (b) => {
    need(me.role === "admin", 403, "Nur für Administratoren"); need(b.name && b.address, 400, "Name und Adresse nötig");
    const m = { id: nextId(db.mailboxes), company_id: me.company_id, name: b.name, address: b.address, kind: b.imap_host ? "imap" : "webhook", inbound_token: Math.random().toString(16).slice(2), last_sync_at: null, last_error: b.imap_host ? "In der Demo wird kein echtes Postfach abgerufen" : null };
    db.mailboxes.push(m); return [201, m];
  }],
  ["POST", /^\/api\/mailboxes\/test$/, () => ({ ok: false, error: "In der Demo nicht verfügbar – in der echten Version wird hier die Anmeldung beim Postfach geprüft." })],
  ["POST", /^\/api\/mailboxes\/(\d+)\/sync$/, () => { throw new HttpError(400, "In der Demo werden keine echten Postfächer abgerufen."); }],
  ["GET", /^\/api\/providers$/, () => ({ providers: DATA.providers, inbound_domain: "eingang.beispiel.de" })],
  ["GET", /^\/api\/audit$/, () => mine(db.audit)],
];

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  if (!url.pathname.includes("/api/")) return realFetch(input, init);
  const apiPath = url.pathname.slice(url.pathname.indexOf("/api/"));
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const query = Object.fromEntries(url.searchParams);
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  for (const [m, re, fn, isPublic] of ROUTES) {
    const match = apiPath.match(re);
    if (m !== method || !match) continue;
    try {
      if (!isPublic && !me) throw new HttpError(401, "Bitte anmelden");
      const out = fn(body, query, match.slice(1));
      return Array.isArray(out) && typeof out[0] === "number" ? reply(out[0], out[1]) : reply(200, out);
    } catch (err) {
      return reply(err.status || 500, { error: err.status ? err.message : "Interner Fehler" });
    }
  }
  return reply(404, { error: "Nicht gefunden" });
};
