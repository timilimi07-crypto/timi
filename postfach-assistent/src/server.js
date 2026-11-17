// Web-Server: REST-API für die Oberfläche und Eingang für weitergeleitete Mails.
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { one, all, run, audit } from "./db.js";
import { hashPassword, verifyPassword, createSession, userFromToken, destroySession, parseCookies, encrypt } from "./auth.js";
import * as mail from "./mail.js";
import { providerName } from "./ai/index.js";
import { PROVIDERS, testImap, inboundAddress } from "./integrations.js";
import { CATEGORIES, CATEGORY_LABELS } from "./ai/local.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const httpError = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" });
    next();
  });
  app.use(express.static(path.join(here, "..", "public")));

  // Änderungen nur mit JSON-Body (schützt zusammen mit SameSite-Cookies vor CSRF).
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.is("application/json") && !req.path.startsWith("/inbound/")) {
      return next(httpError(415, "Bitte als JSON senden"));
    }
    next();
  });

  // ---------- Öffentlich ----------
  const attempts = new Map();
  app.post("/api/login", (req, res) => {
    const { email = "", password = "" } = req.body || {};
    const key = `${req.ip}|${email.toLowerCase()}`;
    const a = attempts.get(key) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 10) throw httpError(429, "Zu viele Versuche, bitte später erneut");
    const user = one(db, "SELECT * FROM users WHERE lower(email)=lower(?)", email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      a.n++; attempts.set(key, a);
      throw httpError(401, "E-Mail oder Passwort falsch");
    }
    attempts.delete(key);
    const token = createSession(db, user.id);
    res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    audit(db, user.company_id, user.id, "login");
    res.json({ ok: true });
  });

  // Selbst-Registrierung einer neuen Firma (legt Admin und Weiterleitungs-Postfach an).
  app.post("/api/register", (req, res) => {
    const { company, name, email, password } = req.body || {};
    if (!company || !name || !email || !password) throw httpError(400, "Alle Felder ausfüllen");
    if (String(password).length < 8) throw httpError(400, "Passwort muss mindestens 8 Zeichen haben");
    if (one(db, "SELECT 1 FROM users WHERE lower(email)=lower(?)", email)) throw httpError(409, "E-Mail ist bereits registriert");
    const slug = `${String(company).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomBytes(3).toString("hex")}`;
    const c = run(db, "INSERT INTO companies (name, slug, signature) VALUES (?,?,?)", company, slug, `${name}\n${company}`);
    const companyId = Number(c.lastInsertRowid);
    const u = run(db, "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?, 'admin')", companyId, name, email, hashPassword(password));
    run(db, "INSERT INTO mailboxes (company_id, name, address, kind, inbound_token) VALUES (?,?,?,?,?)",
      companyId, "Hauptpostfach", email, "webhook", crypto.randomBytes(18).toString("hex"));
    const token = createSession(db, Number(u.lastInsertRowid));
    res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 86400}`);
    audit(db, companyId, Number(u.lastInsertRowid), "firma_registriert", company);
    res.status(201).json({ ok: true });
  });

  // Eingang für Mails, die per Weiterleitung oder Mail-Dienst (z. B. Postmark, Mailgun) zugestellt werden.
  app.post("/api/inbound/:token", express.text({ type: "*/*" }), wrap(async (req, res) => {
    const mailbox = one(db, "SELECT * FROM mailboxes WHERE inbound_token=?", req.params.token);
    if (!mailbox) throw httpError(404, "Unbekannter Eingang");
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const fromAddr = b.from_addr || b.from || b.From || b.sender;
    if (!fromAddr) throw httpError(400, "Absender fehlt");
    const r = mail.ingestEmail(db, mailbox, {
      message_id: b.message_id || b.MessageID || b["Message-Id"], in_reply_to: b.in_reply_to || b["In-Reply-To"],
      from_name: b.from_name || b.FromName, from_addr: String(fromAddr).replace(/.*<(.+)>.*/, "$1"),
      to_addr: b.to || b.To || mailbox.address, subject: b.subject || b.Subject,
      body: b.text || b.body || b.TextBody || b["body-plain"] || "", received_at: b.date || b.Date,
    });
    if (!r.duplicate) await mail.processEmail(db, r.id);
    res.status(r.duplicate ? 200 : 201).json({ id: r.id, duplicate: r.duplicate });
  }));

  // ---------- Ab hier nur angemeldet ----------
  app.use("/api", (req, res, next) => {
    const token = parseCookies(req.headers.cookie).sid;
    req.user = userFromToken(db, token);
    req.token = token;
    if (!req.user) return next(httpError(401, "Bitte anmelden"));
    next();
  });
  const adminOnly = (req, res, next) => (req.user.role === "admin" ? next() : next(httpError(403, "Nur für Administratoren")));
  const cid = (req) => req.user.company_id;

  app.post("/api/logout", (req, res) => {
    destroySession(db, req.token);
    res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    res.json({ ok: true });
  });

  app.get("/api/me", (req, res) => {
    const company = one(db, "SELECT id, name, plan, tone, signature, knowledge, followup_hours FROM companies WHERE id=?", cid(req));
    res.json({ user: req.user, company, ai: providerName(), categories: CATEGORIES, category_labels: CATEGORY_LABELS });
  });

  // ----- E-Mails -----
  app.get("/api/emails", (req, res) => {
    const where = ["e.company_id=?", "e.direction='in'"], params = [cid(req)];
    const { status, category, priority, mailbox, q, mine, department } = req.query;
    if (status && status !== "all") { where.push("e.status=?"); params.push(status); }
    if (!status) where.push("e.status<>'spam'");
    if (category) { where.push("e.category=?"); params.push(category); }
    if (priority) { where.push("e.priority=?"); params.push(priority); }
    if (mailbox) { where.push("e.mailbox_id=?"); params.push(Number(mailbox)); }
    if (department) { where.push("e.department_id=?"); params.push(Number(department)); }
    if (mine === "1") { where.push("(e.assignee_id=? OR (e.assignee_id IS NULL AND e.department_id=?))"); params.push(req.user.id, req.user.department_id ?? -1); }
    if (q) { where.push("(e.subject LIKE ? OR e.body LIKE ? OR e.from_addr LIKE ? OR e.from_name LIKE ?)"); const like = `%${q}%`; params.push(like, like, like, like); }
    const rows = all(db, `SELECT e.id, e.thread_key, e.from_name, e.from_addr, e.subject, e.received_at, e.status, e.category, e.priority,
        e.sentiment, e.summary, e.assignee_id, e.department_id, e.mailbox_id, d.name AS department, u.name AS assignee, m.name AS mailbox,
        (SELECT count(*) FROM emails t WHERE t.company_id=e.company_id AND t.thread_key=e.thread_key) AS thread_count
        FROM emails e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN users u ON u.id=e.assignee_id
        JOIN mailboxes m ON m.id=e.mailbox_id
        WHERE ${where.join(" AND ")}
        ORDER BY CASE e.priority WHEN 'hoch' THEN 0 WHEN 'mittel' THEN 1 ELSE 2 END, e.received_at DESC LIMIT 500`, ...params);
    res.json(rows);
  });

  const loadEmail = (req) => {
    const e = one(db, `SELECT e.*, d.name AS department, u.name AS assignee, m.name AS mailbox FROM emails e
        LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN users u ON u.id=e.assignee_id JOIN mailboxes m ON m.id=e.mailbox_id
        WHERE e.id=? AND e.company_id=?`, Number(req.params.id), cid(req));
    if (!e) throw httpError(404, "E-Mail nicht gefunden");
    return e;
  };

  app.get("/api/emails/:id", (req, res) => {
    const e = loadEmail(req);
    const tasks = all(db, "SELECT * FROM tasks WHERE email_id=? AND company_id=?", e.id, cid(req));
    const thread = all(db, "SELECT id, direction, from_name, from_addr, subject, received_at, summary, body FROM emails WHERE company_id=? AND thread_key=? ORDER BY received_at", cid(req), e.thread_key);
    res.json({ ...e, tasks, thread });
  });

  app.patch("/api/emails/:id", (req, res) => {
    const e = loadEmail(req);
    const { status, assignee_id, department_id, draft, category, priority } = req.body || {};
    if (status && !["open", "answered", "done", "spam"].includes(status)) throw httpError(400, "Ungültiger Status");
    if (category && !CATEGORIES.includes(category)) throw httpError(400, "Ungültige Kategorie");
    if (priority && !["hoch", "mittel", "niedrig"].includes(priority)) throw httpError(400, "Ungültige Dringlichkeit");
    if (assignee_id && !one(db, "SELECT 1 FROM users WHERE id=? AND company_id=?", assignee_id, cid(req))) throw httpError(400, "Mitarbeiter gehört nicht zur Firma");
    if (department_id && !one(db, "SELECT 1 FROM departments WHERE id=? AND company_id=?", department_id, cid(req))) throw httpError(400, "Abteilung gehört nicht zur Firma");
    const set = [], p = [];
    for (const [k, v] of Object.entries({ status, assignee_id, department_id, draft, category, priority })) {
      if (v !== undefined) { set.push(`${k}=?`); p.push(v === "" ? null : v); }
    }
    if (set.length) run(db, `UPDATE emails SET ${set.join(", ")} WHERE id=? AND company_id=?`, ...p, e.id, cid(req));
    audit(db, cid(req), req.user.id, "mail_geaendert", `Mail ${e.id}: ${set.join(", ")}`);
    res.json(loadEmail(req));
  });

  app.post("/api/emails/:id/reanalyze", wrap(async (req, res) => {
    const e = loadEmail(req);
    res.json(await mail.processEmail(db, e.id));
  }));

  app.post("/api/emails/:id/reply", wrap(async (req, res) => {
    const e = loadEmail(req);
    res.json(await mail.sendReply(db, req.user, e.id, req.body?.body));
  }));

  app.get("/api/threads/:key", wrap(async (req, res) => {
    const t = await mail.threadView(db, cid(req), req.params.key);
    if (!t) throw httpError(404, "Verlauf nicht gefunden");
    res.json(t);
  }));

  // ----- Übersichten -----
  app.get("/api/stats", (req, res) => res.json(mail.stats(db, cid(req), req.query.period || "week", req.query.mailbox || null)));
  app.get("/api/digest", wrap(async (req, res) => {
    const mb = req.query.mailbox ? Number(req.query.mailbox) : null;
    if (mb && !one(db, "SELECT 1 FROM mailboxes WHERE id=? AND company_id=?", mb, cid(req))) throw httpError(404, "Postfach nicht gefunden");
    res.json(await mail.buildDigest(db, cid(req), req.query.period || "week", mb));
  }));
  app.get("/api/analytics", (req, res) => {
    const mb = req.query.mailbox ? Number(req.query.mailbox) : null;
    if (mb && !one(db, "SELECT 1 FROM mailboxes WHERE id=? AND company_id=?", mb, cid(req))) throw httpError(404, "Postfach nicht gefunden");
    res.json(mail.analytics(db, cid(req), req.query.period || "week", mb));
  });
  app.get("/api/followups", (req, res) => res.json(mail.followups(db, cid(req)).map((e) => ({
    id: e.id, subject: e.subject, from: e.from_name || e.from_addr, received_at: e.received_at, summary: e.summary, priority: e.priority,
  }))));

  // ----- Aufgaben -----
  app.get("/api/tasks", (req, res) => {
    const open = req.query.open !== "0";
    res.json(all(db, `SELECT t.*, e.subject, e.from_name, e.from_addr, u.name AS assignee FROM tasks t
        LEFT JOIN emails e ON e.id=t.email_id LEFT JOIN users u ON u.id=t.assignee_id
        WHERE t.company_id=? ${open ? "AND t.done=0" : ""} ORDER BY (t.due_date IS NULL), t.due_date, t.id`, cid(req)));
  });
  app.patch("/api/tasks/:id", (req, res) => {
    const t = one(db, "SELECT * FROM tasks WHERE id=? AND company_id=?", Number(req.params.id), cid(req));
    if (!t) throw httpError(404, "Aufgabe nicht gefunden");
    const { done, assignee_id, due_date } = req.body || {};
    if (assignee_id && !one(db, "SELECT 1 FROM users WHERE id=? AND company_id=?", assignee_id, cid(req))) throw httpError(400, "Mitarbeiter gehört nicht zur Firma");
    run(db, "UPDATE tasks SET done=coalesce(?,done), assignee_id=coalesce(?,assignee_id), due_date=coalesce(?,due_date) WHERE id=?",
      done === undefined ? null : (done ? 1 : 0), assignee_id ?? null, due_date ?? null, t.id);
    res.json(one(db, "SELECT * FROM tasks WHERE id=?", t.id));
  });

  // ----- Team -----
  app.get("/api/team", (req, res) => res.json({
    users: all(db, "SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.company_id=? ORDER BY u.name", cid(req)),
    departments: all(db, "SELECT * FROM departments WHERE company_id=? ORDER BY name", cid(req)),
  }));
  app.post("/api/team/users", adminOnly, (req, res) => {
    const { name, email, password, role = "member", department_id } = req.body || {};
    if (!name || !email || !password || password.length < 8) throw httpError(400, "Name, E-Mail und Passwort (min. 8 Zeichen) nötig");
    if (one(db, "SELECT 1 FROM users WHERE lower(email)=lower(?)", email)) throw httpError(409, "E-Mail existiert bereits");
    if (department_id && !one(db, "SELECT 1 FROM departments WHERE id=? AND company_id=?", department_id, cid(req))) throw httpError(400, "Abteilung gehört nicht zur Firma");
    const r = run(db, "INSERT INTO users (company_id, department_id, name, email, password_hash, role) VALUES (?,?,?,?,?,?)",
      cid(req), department_id || null, name, email, hashPassword(password), role === "admin" ? "admin" : "member");
    audit(db, cid(req), req.user.id, "nutzer_angelegt", email);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.post("/api/team/departments", adminOnly, (req, res) => {
    if (!req.body?.name) throw httpError(400, "Name fehlt");
    const r = run(db, "INSERT INTO departments (company_id, name) VALUES (?,?)", cid(req), req.body.name);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  // ----- Einstellungen (nur Admin) -----
  app.get("/api/settings", adminOnly, (req, res) => res.json(one(db, "SELECT name, plan, tone, signature, knowledge, followup_hours FROM companies WHERE id=?", cid(req))));
  app.put("/api/settings", adminOnly, (req, res) => {
    const { name, tone, signature, knowledge, followup_hours } = req.body || {};
    run(db, `UPDATE companies SET name=coalesce(?,name), tone=coalesce(?,tone), signature=coalesce(?,signature),
        knowledge=coalesce(?,knowledge), followup_hours=coalesce(?,followup_hours) WHERE id=?`,
      name ?? null, tone ?? null, signature ?? null, knowledge ?? null, followup_hours ? Number(followup_hours) : null, cid(req));
    audit(db, cid(req), req.user.id, "einstellungen_geaendert");
    res.json(one(db, "SELECT name, plan, tone, signature, knowledge, followup_hours FROM companies WHERE id=?", cid(req)));
  });

  app.get("/api/rules", (req, res) => res.json(all(db, `SELECT r.*, d.name AS department, u.name AS user FROM rules r
      LEFT JOIN departments d ON d.id=r.department_id LEFT JOIN users u ON u.id=r.user_id WHERE r.company_id=? ORDER BY r.id`, cid(req))));
  app.post("/api/rules", adminOnly, (req, res) => {
    const { category, keyword, department_id, user_id } = req.body || {};
    if (!category && !keyword) throw httpError(400, "Kategorie oder Stichwort angeben");
    if (category && !CATEGORIES.includes(category)) throw httpError(400, "Ungültige Kategorie");
    if (department_id && !one(db, "SELECT 1 FROM departments WHERE id=? AND company_id=?", department_id, cid(req))) throw httpError(400, "Abteilung gehört nicht zur Firma");
    if (user_id && !one(db, "SELECT 1 FROM users WHERE id=? AND company_id=?", user_id, cid(req))) throw httpError(400, "Mitarbeiter gehört nicht zur Firma");
    const r = run(db, "INSERT INTO rules (company_id, category, keyword, department_id, user_id) VALUES (?,?,?,?,?)",
      cid(req), category || null, keyword || null, department_id || null, user_id || null);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.delete("/api/rules/:id", adminOnly, (req, res) => {
    run(db, "DELETE FROM rules WHERE id=? AND company_id=?", Number(req.params.id), cid(req));
    res.json({ ok: true });
  });

  // ----- Postfächer -----
  const publicMailbox = (m) => ({
    id: m.id, name: m.name, address: m.address, kind: m.kind, imap_host: m.imap_host, imap_port: m.imap_port, imap_user: m.imap_user,
    smtp_host: m.smtp_host, smtp_port: m.smtp_port, smtp_user: m.smtp_user, last_sync_at: m.last_sync_at,
    has_imap_password: Boolean(m.imap_pass), has_smtp_password: Boolean(m.smtp_pass),
    inbound_url: m.inbound_token ? `/api/inbound/${m.inbound_token}` : null,
    inbound_email: inboundAddress(m), last_error: m.last_error,
  });
  app.get("/api/providers", (req, res) => res.json({ providers: PROVIDERS, inbound_domain: process.env.INBOUND_DOMAIN || null }));
  app.post("/api/mailboxes/test", adminOnly, wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.imap_host || !b.imap_user || !b.imap_pass) throw httpError(400, "IMAP-Server, Benutzer und Passwort angeben");
    res.json(await testImap(b));
  }));
  app.get("/api/mailboxes", (req, res) => {
    const rows = all(db, "SELECT * FROM mailboxes WHERE company_id=? ORDER BY id", cid(req)).map(publicMailbox);
    if (req.user.role !== "admin") rows.forEach((m) => { delete m.inbound_url; });
    res.json(rows);
  });
  app.post("/api/mailboxes", adminOnly, (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.address) throw httpError(400, "Name und Adresse nötig");
    const kind = b.imap_host ? "imap" : "webhook";
    const r = run(db, `INSERT INTO mailboxes (company_id, name, address, kind, imap_host, imap_port, imap_user, imap_pass,
        smtp_host, smtp_port, smtp_user, smtp_pass, inbound_token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      cid(req), b.name, b.address, kind, b.imap_host || null, b.imap_port || null, b.imap_user || null, encrypt(b.imap_pass),
      b.smtp_host || null, b.smtp_port || null, b.smtp_user || null, encrypt(b.smtp_pass), crypto.randomBytes(18).toString("hex"));
    audit(db, cid(req), req.user.id, "postfach_angelegt", b.address);
    res.status(201).json(publicMailbox(one(db, "SELECT * FROM mailboxes WHERE id=?", Number(r.lastInsertRowid))));
  });
  app.post("/api/mailboxes/:id/sync", adminOnly, wrap(async (req, res) => {
    const m = one(db, "SELECT * FROM mailboxes WHERE id=? AND company_id=?", Number(req.params.id), cid(req));
    if (!m) throw httpError(404, "Postfach nicht gefunden");
    if (m.kind !== "imap") throw httpError(400, "Nur IMAP-Postfächer können abgerufen werden");
    const n = await mail.syncImap(db, m);
    audit(db, cid(req), req.user.id, "postfach_abgerufen", `${m.address}: ${n} neue`);
    res.json({ new_emails: n });
  }));

  app.get("/api/audit", adminOnly, (req, res) => res.json(all(db,
    "SELECT a.*, u.name AS user FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.company_id=? ORDER BY a.id DESC LIMIT 200", cid(req))));

  // ----- Fehler -----
  app.use("/api", (req, res, next) => next(httpError(404, "Nicht gefunden")));
  app.use((err, req, res, next) => {
    const status = err.status || (err instanceof SyntaxError ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Interner Fehler" : err.message });
  });
  return app;
}
