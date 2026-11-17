// Ende-zu-Ende-Tests gegen den echten Server mit den drei Testfirmen,
// einem lokalen SMTP-Server (Versand) und einem lokalen IMAP-Server (Abruf).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SMTPServer } from "smtp-server";
import hoodiecrow from "hoodiecrow-imap";
import { simpleParser } from "mailparser";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "postfach-test-"));
process.env.SECRET_FILE = path.join(tmp, "secret.key");
delete process.env.ANTHROPIC_API_KEY; // Tests laufen mit der lokalen Auswertung

const { openDb, one, all } = await import("../src/db.js");
const { createApp } = await import("../src/server.js");
const { seed, DEMO_PASSWORD, SEED_COMPANIES } = await import("../src/seed.js");

let db, server, base, smtp, imap, smtpPort, imapPort;
const received = []; // Mails, die beim lokalen SMTP-Server ankommen

class Client {
  constructor() { this.cookie = ""; }
  async req(method, url, body) {
    const res = await fetch(base + url, {
      method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
  get(u) { return this.req("GET", u); }
  post(u, b = {}) { return this.req("POST", u, b); }
  patch(u, b) { return this.req("PATCH", u, b); }
  put(u, b) { return this.req("PUT", u, b); }
}

async function login(email, password = DEMO_PASSWORD) {
  const c = new Client();
  const r = await c.post("/api/login", { email, password });
  assert.equal(r.status, 200, `Login ${email}`);
  return c;
}

const listen = (srv, ...args) => new Promise((res) => srv.listen(0, "127.0.0.1", ...args, () => res(srv.address().port)));

before(async () => {
  db = openDb(path.join(tmp, "test.db"));
  await seed(db);
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;

  smtp = new SMTPServer({
    authOptional: true, allowInsecureAuth: true, disabledCommands: ["STARTTLS"], logger: false,
    onAuth(auth, session, cb) { cb(null, { user: auth.username }); },
    onData(stream, session, cb) {
      let raw = ""; stream.on("data", (d) => (raw += d)); stream.on("end", () => { received.push({ to: session.envelope.rcptTo.map((r) => r.address), raw }); cb(); });
    },
  });
  smtpPort = await listen(smtp.server ?? smtp);

  const rawMail = (from, subject, body, id) => `From: ${from}\r\nTo: info@werkstatt.example\r\nSubject: ${subject}\r\nMessage-ID: <${id}@imap.test>\r\nDate: ${new Date().toUTCString()}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
  imap = hoodiecrow({
    plugins: ["ID", "UIDPLUS", "ENABLE", "LITERALPLUS", "SPECIAL-USE", "IDLE", "UNSELECT"],
    users: { werkstatt: { password: "imap-geheim" } },
    storage: { INBOX: { messages: [
      { raw: rawMail("Kunde Eins <eins@kunde.example>", "Bremsen quietschen – Termin?", "Hallo,\nmeine Bremsen quietschen. Können Sie mir bis Freitag einen Termin geben?\nGruß", "m1") },
      { raw: rawMail("Lieferant <rechnung@teile.example>", "Rechnung 4711", "Anbei die Rechnung 4711 über 980 EUR. Zahlbar bis zum 30.11.", "m2") },
    ] } },
  });
  imapPort = await listen(imap);
});

after(() => {
  server?.close(); smtp?.close(); imap?.close?.();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------

test("Testfirmen sind angelegt und alle Mails ausgewertet", () => {
  assert.equal(one(db, "SELECT count(*) n FROM companies").n, 3);
  const total = SEED_COMPANIES.reduce((n, c) => n + c.emails.length, 0);
  assert.equal(one(db, "SELECT count(*) n FROM emails WHERE direction='in'").n, total);
  assert.equal(one(db, "SELECT count(*) n FROM emails WHERE direction='in' AND category IS NULL").n, 0, "jede Mail hat eine Kategorie");
  assert.equal(one(db, "SELECT count(*) n FROM emails WHERE status='spam'").n, 2, "beide Spam-Mails aussortiert");
});

test("Ohne Anmeldung kein Zugriff, falsches Passwort wird abgelehnt", async () => {
  const c = new Client();
  assert.equal((await c.get("/api/emails")).status, 401);
  assert.equal((await c.post("/api/login", { email: "petra@sonnenhof-hv.example", password: "falsch" })).status, 401);
});

test("Jede Firma sieht nur ihre eigenen E-Mails", async () => {
  const petra = await login("petra@sonnenhof-hv.example");
  const svenja = await login("svenja@nordlicht-versand.example");
  const a = (await petra.get("/api/emails?status=all")).data;
  const b = (await svenja.get("/api/emails?status=all")).data;
  assert.ok(a.length > 5 && b.length > 5);
  assert.ok(a.every((e) => !/nordlicht|Vase|Bestellung #/.test(e.subject)), "Sonnenhof sieht keine Nordlicht-Mails");
  const foreign = b[0].id;
  assert.equal((await petra.get(`/api/emails/${foreign}`)).status, 404, "fremde Mail nicht abrufbar");
  assert.equal((await petra.patch(`/api/emails/${foreign}`, { status: "done" })).status, 404, "fremde Mail nicht änderbar");
  assert.equal((await petra.post(`/api/emails/${foreign}/reply`, { body: "hack" })).status, 404, "auf fremde Mail nicht antworten");
  const foreignThread = one(db, "SELECT thread_key FROM emails WHERE id=?", foreign).thread_key;
  assert.equal((await petra.get(`/api/threads/${foreignThread}`)).status, 404, "fremder Verlauf nicht abrufbar");
  // Zuweisung an Mitarbeiter einer anderen Firma wird verhindert
  const ole = one(db, "SELECT id FROM users WHERE email='ole@nordlicht-versand.example'").id;
  assert.equal((await petra.patch(`/api/emails/${a[0].id}`, { assignee_id: ole })).status, 400);
  const nordMailbox = one(db, "SELECT m.id FROM mailboxes m JOIN companies c ON c.id=m.company_id WHERE c.slug='nordlicht'").id;
  assert.equal((await petra.get(`/api/digest?mailbox=${nordMailbox}`)).status, 404, "fremdes Postfach nicht zusammenfassbar");
});

test("Zuweisung nach Regeln: Reklamation → Technik, Nebenkosten → Buchhaltung, Händler → Einkauf", async () => {
  const dept = (subject) => one(db, "SELECT d.name FROM emails e JOIN departments d ON d.id=e.department_id WHERE e.subject=?", subject)?.name;
  assert.equal(dept("DRINGEND: Wasserschaden im Bad, Wohnung 3.OG links"), "Technik");
  assert.equal(dept("Frage zur Nebenkostenabrechnung 2025"), "Buchhaltung");
  assert.equal(dept("Händleranfrage: 200 Duftkerzen"), "Einkauf");
  assert.equal(dept("Neue Aushilfe ab 1. Dezember – Lohnabrechnung"), "Lohnbuchhaltung");
  assert.equal(dept("Bewerbung Lagermitarbeiter"), "Personal");
});

test("Dringende Mails werden erkannt", () => {
  const prio = (subject) => one(db, "SELECT priority FROM emails WHERE subject=?", subject).priority;
  assert.equal(prio("DRINGEND: Wasserschaden im Bad, Wohnung 3.OG links"), "hoch");
  assert.equal(prio("Heizung ausgefallen – schon wieder!"), "hoch");
  assert.equal(prio("Letzte Mahnung – offene Posten Oktober"), "hoch");
  assert.equal(prio("Steuerbescheid – Nachzahlung 8.400 Euro?!"), "hoch");
  assert.equal(prio("Newsletter: Neue Urteile im Mietrecht"), "niedrig");
});

test("Alle E-Mails zusammenfassen – für jede Testfirma", async () => {
  for (const email of ["petra@sonnenhof-hv.example", "anna@berger-steuer.example", "svenja@nordlicht-versand.example"]) {
    const c = await login(email);
    const d = (await c.get("/api/digest?period=all")).data;
    const companyId = one(db, "SELECT company_id FROM users WHERE email=?", email).company_id;
    const expected = one(db, "SELECT count(*) n FROM emails WHERE company_id=? AND direction='in'", companyId).n;
    assert.equal(d.stats.total, expected, `${email}: alle Mails gezählt`);
    assert.ok(d.headline.length > 10, "Überschrift vorhanden");
    assert.match(d.overview, new RegExp(`${expected} E-Mails eingegangen`));
    assert.ok(d.topics.length >= 2, "Themen aufgelistet");
    assert.ok(d.urgent.length >= 1, "dringende Mails aufgelistet");
    assert.ok(d.actions.length >= 1, "To-dos vorhanden");
  }
  // Zeitraum und einzelnes Postfach
  const svenja = await login("svenja@nordlicht-versand.example");
  const today = (await svenja.get("/api/digest?period=today")).data;
  const all7 = (await svenja.get("/api/digest?period=all")).data;
  assert.ok(today.stats.total < all7.stats.total, "Heute enthält weniger Mails als alles");
  const mbs = (await svenja.get("/api/mailboxes")).data;
  assert.equal(mbs.length, 3);
  const buch = mbs.find((m) => m.name === "Buchhaltung");
  const d = (await svenja.get(`/api/digest?period=all&mailbox=${buch.id}`)).data;
  assert.equal(d.stats.total, 3, "Buchhaltungs-Postfach hat 3 Mails");
});

test("Verlauf wird erkannt und zusammengefasst", async () => {
  const svenja = await login("svenja@nordlicht-versand.example");
  const list = (await svenja.get("/api/emails?q=Wo%20bleibt")).data;
  assert.equal(list.length, 2);
  assert.equal(list[0].thread_key, list[1].thread_key, "Nachfrage gehört zum selben Verlauf");
  const t = (await svenja.get(`/api/threads/${list[0].thread_key}`)).data;
  assert.equal(t.emails.length, 2);
  assert.match(t.summary, /2 Nachricht/);
  assert.match(t.summary, /wir sind am Zug/);
});

test("Antwort senden (Demo-Postfach): Mail landet im Verlauf, Status beantwortet", async () => {
  const petra = await login("petra@sonnenhof-hv.example");
  const mail = (await petra.get("/api/emails?q=Kaution")).data[0];
  const detail = (await petra.get(`/api/emails/${mail.id}`)).data;
  assert.ok(detail.draft.includes("Kaution"), "Entwurf nutzt Firmenwissen zur Kaution");
  const r = await petra.post(`/api/emails/${mail.id}/reply`, { body: detail.draft });
  assert.equal(r.status, 200);
  assert.match(r.data.delivery, /Demo/);
  const after = (await petra.get(`/api/emails/${mail.id}`)).data;
  assert.equal(after.status, "answered");
  assert.equal(after.thread.length, 2);
  assert.equal(after.thread[1].direction, "out");
  const log = (await petra.get("/api/audit")).data;
  assert.ok(log.some((l) => l.action === "antwort_gesendet"), "Versand im Protokoll");
});

test("Leere Antwort wird abgelehnt", async () => {
  const petra = await login("petra@sonnenhof-hv.example");
  const mail = (await petra.get("/api/emails")).data[0];
  assert.equal((await petra.post(`/api/emails/${mail.id}/reply`, { body: "  " })).status, 400);
});

test("Nachfassen: Kunden ohne Antwort nach Frist werden gelistet", async () => {
  const svenja = await login("svenja@nordlicht-versand.example");
  const f = (await svenja.get("/api/followups")).data;
  assert.ok(f.some((e) => e.subject === "Gutscheincode funktioniert nicht"));
  assert.ok(!f.some((e) => e.subject === "Super Service!"), "beantwortete Mail nicht dabei");
  assert.ok(!f.some((e) => /Konto wurde gesperrt/.test(e.subject)), "Spam nicht dabei");
});

test("Aufgaben: Liste und abhaken", async () => {
  const anna = await login("anna@berger-steuer.example");
  const tasks = (await anna.get("/api/tasks")).data;
  const fa = tasks.find((t) => /Unterlagen|Kontenblätter/.test(t.title));
  assert.ok(fa?.due_date, "Frist des Finanzamts erkannt");
  assert.equal((await anna.patch(`/api/tasks/${fa.id}`, { done: true })).status, 200);
  const after = (await anna.get("/api/tasks")).data;
  assert.ok(!after.some((t) => t.id === fa.id));
});

test("Rechte: Mitarbeiter dürfen keine Einstellungen ändern", async () => {
  const jonas = await login("jonas@sonnenhof-hv.example");
  assert.equal((await jonas.put("/api/settings", { tone: "x" })).status, 403);
  assert.equal((await jonas.post("/api/rules", { keyword: "x", department_id: 1 })).status, 403);
  const mine = (await jonas.get("/api/emails?mine=1")).data;
  assert.ok(mine.length >= 1 && mine.every((e) => e.department === "Technik"), "Nur meine = Technik-Mails");
});

test("Weiterleitungs-Eingang: neue Mail wird sofort ausgewertet, Duplikate ignoriert", async () => {
  const token = one(db, "SELECT inbound_token FROM mailboxes WHERE address='support@nordlicht-versand.example'").inbound_token;
  const msg = { from: "Erika Muster <erika@mail.example>", subject: "Lampe defekt", text: "Hallo, meine Lampe ist defekt angekommen. Bitte schickt mir bis Freitag Ersatz!", message_id: "<inbound-1@test>" };
  const c = new Client();
  const r = await c.post(`/api/inbound/${token}`, msg);
  assert.equal(r.status, 201);
  const e = one(db, "SELECT * FROM emails WHERE id=?", r.data.id);
  assert.equal(e.from_addr, "erika@mail.example");
  assert.equal(e.category, "reklamation");
  assert.ok(e.summary && e.draft);
  assert.equal((await c.post(`/api/inbound/${token}`, msg)).data.duplicate, true);
  assert.equal((await c.post("/api/inbound/falsch", msg)).status, 404);
});

test("Neue Firma registrieren: leeres, getrenntes Postfach", async () => {
  const c = new Client();
  const r = await c.post("/api/register", { company: "Bäckerei Krume", name: "Ben Krume", email: "ben@krume.example", password: "sicher123" });
  assert.equal(r.status, 201);
  assert.deepEqual((await c.get("/api/emails?status=all")).data, []);
  assert.equal((await c.get("/api/me")).data.company.name, "Bäckerei Krume");
  assert.equal((await c.post("/api/register", { company: "X", name: "Y", email: "ben@krume.example", password: "sicher123" })).status, 409);
});

test("Echtes Postfach: IMAP-Abruf und SMTP-Versand über lokale Mailserver", async () => {
  const c = new Client();
  await c.post("/api/register", { company: "Werkstatt Schraube", name: "Uwe Schraube", email: "uwe@werkstatt.example", password: "sicher123" });
  const created = await c.post("/api/mailboxes", {
    name: "Werkstatt", address: "info@werkstatt.example",
    imap_host: "127.0.0.1", imap_port: imapPort, imap_user: "werkstatt", imap_pass: "imap-geheim",
    smtp_host: "127.0.0.1", smtp_port: smtpPort, smtp_user: "werkstatt", smtp_pass: "smtp-geheim",
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.imap_pass, undefined, "Passwort wird nie ausgeliefert");
  const stored = one(db, "SELECT imap_pass, smtp_pass FROM mailboxes WHERE id=?", created.data.id);
  assert.match(stored.imap_pass, /^v1:/, "Passwort verschlüsselt gespeichert");
  assert.ok(!stored.imap_pass.includes("imap-geheim"));

  const sync = await c.post(`/api/mailboxes/${created.data.id}/sync`);
  assert.equal(sync.status, 200, JSON.stringify(sync.data));
  assert.equal(sync.data.new_emails, 2);
  assert.equal((await c.post(`/api/mailboxes/${created.data.id}/sync`)).data.new_emails, 0, "kein doppelter Abruf");

  const emails = (await c.get("/api/emails")).data;
  const bremse = emails.find((e) => /Bremsen/.test(e.subject));
  assert.equal(bremse.category, "termin");
  assert.equal(emails.find((e) => /Rechnung 4711/.test(e.subject)).category, "rechnung");

  const detail = (await c.get(`/api/emails/${bremse.id}`)).data;
  const r = await c.post(`/api/emails/${bremse.id}/reply`, { body: "Guten Tag,\nDonnerstag 10 Uhr passt.\nUwe Schraube" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.delivery, /versendet/);
  const sent = received.at(-1);
  assert.deepEqual(sent.to, ["eins@kunde.example"]);
  const parsed = await simpleParser(sent.raw);
  assert.equal(parsed.subject, "AW: Bremsen quietschen – Termin?");
  assert.equal(parsed.inReplyTo, detail.message_id, "Antwort hängt im Verlauf des Kunden");
  assert.match(parsed.text, /Donnerstag 10 Uhr passt/);
  assert.equal((await c.get(`/api/emails/${bremse.id}`)).data.status, "answered");
});

test("Diagramm-Daten: Tage, Abteilungen, Antwortzeit, Absender", async () => {
  const svenja = await login("svenja@nordlicht-versand.example");
  const a = (await svenja.get("/api/analytics?period=week")).data;
  assert.equal(a.days.length, 7);
  const total = a.days.reduce((n, d) => n + Object.values(d.by_category).reduce((x, y) => x + y, 0), 0);
  const stats = (await svenja.get("/api/stats?period=week")).data;
  assert.ok(total >= stats.total - 1 && total <= stats.total + 1, `Summe der Tage (${total}) passt zu den Kennzahlen (${stats.total})`);
  const ks = a.departments.find((d) => d.department === "Kundenservice");
  assert.ok(ks.open >= 4 && ks.urgent >= 2, "Kundenservice hat offene und dringende Mails");
  assert.equal(a.response, null, "bei Nordlicht wurde nur ein Lob (Info) beantwortet – zählt nicht als Antwortzeit");
  assert.equal(a.senders[0].sender, "Peter Schmitz", "häufigster Absender");
  assert.equal((await svenja.get("/api/analytics?period=month")).data.days.length, 30);
  const petra = await login("petra@sonnenhof-hv.example");
  const r = (await petra.get("/api/analytics?period=week")).data.response;
  assert.ok(r && r.count >= 1 && r.avg_hours > 0 && r.within_24h >= 0, "Antwortzeit bei Sonnenhof berechnet");
  const foreign = one(db, "SELECT m.id FROM mailboxes m JOIN companies c ON c.id=m.company_id WHERE c.slug='nordlicht'").id;
  assert.equal((await petra.get(`/api/analytics?mailbox=${foreign}`)).status, 404);
});

test("Einbinden: Anbieter-Vorlagen und Verbindungstest", async () => {
  const c = await login("uwe@werkstatt.example", "sicher123");
  const p = (await c.get("/api/providers")).data.providers;
  assert.ok(p.some((x) => x.id === "ionos" && x.imap_host === "imap.ionos.de"));
  assert.ok(p.find((x) => x.id === "m365").forwarding_only, "Microsoft 365 nur per Weiterleitung");
  const ok = (await c.post("/api/mailboxes/test", { imap_host: "127.0.0.1", imap_port: imapPort, imap_user: "werkstatt", imap_pass: "imap-geheim" })).data;
  assert.equal(ok.ok, true);
  const bad = (await c.post("/api/mailboxes/test", { imap_host: "127.0.0.1", imap_port: imapPort, imap_user: "werkstatt", imap_pass: "falsch" })).data;
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Anmeldung fehlgeschlagen/);
  const jonas = await login("jonas@sonnenhof-hv.example");
  assert.equal((await jonas.post("/api/mailboxes/test", { imap_host: "x", imap_user: "y", imap_pass: "z" })).status, 403);
});

test("Automatischer Abruf: neue Mail im IMAP-Postfach erscheint ohne Klick", async () => {
  const { startScheduler } = await import("../src/integrations.js");
  const companyId = one(db, "SELECT company_id FROM users WHERE email='uwe@werkstatt.example'").company_id;
  const before = one(db, "SELECT count(*) n FROM emails WHERE company_id=?", companyId).n;
  imap.appendMessage("INBOX", [], false, `From: Neukunde <neu@kunde.example>\r\nTo: info@werkstatt.example\r\nSubject: Reifenwechsel Angebot\r\nMessage-ID: <m3@imap.test>\r\n\r\nWas kostet ein Reifenwechsel? Bitte um ein Angebot.`);
  const s = startScheduler(db, 60);
  await s.tick(); s.stop();
  const after = one(db, "SELECT count(*) n FROM emails WHERE company_id=?", companyId).n;
  assert.equal(after, before + 1);
  assert.equal(one(db, "SELECT category FROM emails WHERE message_id='<m3@imap.test>'").category, "anfrage");
  assert.equal(one(db, "SELECT last_error FROM mailboxes WHERE company_id=? AND kind='imap'", companyId).last_error, null);
});

test("Weiterleitung per E-Mail: eigener Mail-Eingang nimmt weitergeleitete Mails an", async () => {
  const { startInboundSmtp } = await import("../src/integrations.js");
  const nodemailer = (await import("nodemailer")).default;
  const srv = await startInboundSmtp(db, { port: 0, host: "127.0.0.1" });
  const port = srv.server.address().port;
  const token = one(db, "SELECT inbound_token FROM mailboxes WHERE address='info@sonnenhof-hv.example'").inbound_token;
  const tx = nodemailer.createTransport({ host: "127.0.0.1", port, secure: false, ignoreTLS: true });
  await tx.sendMail({ from: "Mieterin Rosa <rosa@mail.example>", to: `${token}@eingang.example`, subject: "Fenster undicht", text: "Hallo, bei uns ist das Fenster undicht. Bitte schicken Sie bis Freitag jemanden vorbei.", messageId: "<fwd-1@test>" });
  const e = one(db, "SELECT e.*, c.slug FROM emails e JOIN companies c ON c.id=e.company_id WHERE message_id='<fwd-1@test>'");
  assert.equal(e.slug, "sonnenhof", "landet bei der richtigen Firma");
  assert.equal(e.category, "reklamation");
  assert.equal(one(db, "SELECT name FROM departments WHERE id=?", e.department_id).name, "Technik");
  await assert.rejects(tx.sendMail({ from: "x@y.example", to: "unbekannt@eingang.example", subject: "x", text: "x" }), /550|Unbekannter Empfänger/);
  srv.close();
});
