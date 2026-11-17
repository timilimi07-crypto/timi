// Einbau-Wege: Anbieter-Vorlagen, Verbindungstest, automatischer Abruf und
// ein eigener Mail-Eingang (SMTP) für Weiterleitungen aus Outlook, Gmail & Co.
import { simpleParser } from "mailparser";
import { one, all, run } from "./db.js";
import { ingestEmail, processEmail, syncImap } from "./mail.js";

// Bekannte Einstellungen deutscher und internationaler Anbieter (Stand Ende 2026, beim Anbieter prüfen).
export const PROVIDERS = [
  { id: "ionos", name: "IONOS (1&1)", imap_host: "imap.ionos.de", imap_port: 993, smtp_host: "smtp.ionos.de", smtp_port: 587, hint: "Normales E-Mail-Passwort." },
  { id: "strato", name: "STRATO", imap_host: "imap.strato.de", imap_port: 993, smtp_host: "smtp.strato.de", smtp_port: 465, hint: "Normales E-Mail-Passwort." },
  { id: "gmx", name: "GMX", imap_host: "imap.gmx.net", imap_port: 993, smtp_host: "mail.gmx.net", smtp_port: 587, hint: "Vorher in GMX unter Einstellungen → POP3/IMAP Abruf den Zugriff erlauben." },
  { id: "webde", name: "WEB.DE", imap_host: "imap.web.de", imap_port: 993, smtp_host: "smtp.web.de", smtp_port: 587, hint: "Vorher in WEB.DE unter Einstellungen → POP3/IMAP Abruf den Zugriff erlauben." },
  { id: "telekom", name: "Telekom (T-Online)", imap_host: "secureimap.t-online.de", imap_port: 993, smtp_host: "securesmtp.t-online.de", smtp_port: 465, hint: "Eigenes E-Mail-Passwort aus dem Telekom-Kundencenter verwenden, nicht das Login-Passwort." },
  { id: "mailboxorg", name: "mailbox.org", imap_host: "imap.mailbox.org", imap_port: 993, smtp_host: "smtp.mailbox.org", smtp_port: 465, hint: "Normales Passwort." },
  { id: "gmail", name: "Gmail (privat, mit App-Passwort)", imap_host: "imap.gmail.com", imap_port: 993, smtp_host: "smtp.gmail.com", smtp_port: 465, hint: "Bestätigung in zwei Schritten einschalten und unter myaccount.google.com → App-Passwörter ein Passwort erzeugen. Bei Google Workspace nur, wenn der Admin App-Passwörter erlaubt – sonst Weiterleitung nutzen." },
  { id: "m365", name: "Microsoft 365 / Outlook", forwarding_only: true, hint: "Microsoft erlaubt keine Anmeldung per Passwort mehr. Bitte die Weiterleitung nutzen (Anleitung unten)." },
  { id: "other", name: "Anderer Anbieter", hint: "IMAP- und SMTP-Daten stehen in der Hilfe deines Anbieters." },
];

export async function testImap({ imap_host, imap_port, imap_user, imap_pass }) {
  const { ImapFlow } = await import("imapflow");
  const local = /^(localhost|127\.)/.test(imap_host || "");
  const port = Number(imap_port) || 993;
  const client = new ImapFlow({
    host: imap_host, port, secure: port === 993, doSTARTTLS: local ? false : true,
    auth: { user: imap_user, pass: imap_pass }, logger: false, connectionTimeout: 10000, greetingTimeout: 8000,
  });
  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true });
    await client.logout();
    return { ok: true, messages: status.messages };
  } catch (err) {
    return { ok: false, error: err.authenticationFailed ? "Anmeldung fehlgeschlagen – Benutzer oder Passwort falsch" : (err.responseText || err.message) };
  }
}

// Ruft alle IMAP-Postfächer regelmäßig ab. Fehler werden am Postfach vermerkt.
export function startScheduler(db, minutes = Number(process.env.SYNC_MINUTES || 5)) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const m of all(db, "SELECT * FROM mailboxes WHERE kind='imap'")) {
        try {
          const n = await syncImap(db, m);
          run(db, "UPDATE mailboxes SET last_error=NULL WHERE id=?", m.id);
          if (n) console.log(`[Abruf] ${m.address}: ${n} neue E-Mails`);
        } catch (err) {
          run(db, "UPDATE mailboxes SET last_error=?, last_sync_at=? WHERE id=?", String(err.message).slice(0, 300), new Date().toISOString().slice(0, 19), m.id);
        }
      }
    } finally { running = false; }
  };
  const timer = setInterval(tick, Math.max(1, minutes) * 60e3);
  timer.unref();
  return { tick, stop: () => clearInterval(timer) };
}

// Eigener Mail-Eingang: Firmen leiten ihre Mails an <token>@INBOUND_DOMAIN weiter.
export async function startInboundSmtp(db, { port = Number(process.env.INBOUND_SMTP_PORT), host = "0.0.0.0" } = {}) {
  const { SMTPServer } = await import("smtp-server");
  const mailboxFor = (address) => {
    const token = String(address || "").split("@")[0].toLowerCase();
    return token ? one(db, "SELECT * FROM mailboxes WHERE inbound_token=?", token) : null;
  };
  const server = new SMTPServer({
    authOptional: true, disabledCommands: ["AUTH"], size: 15 * 1024 * 1024, logger: false,
    onRcptTo(address, session, cb) {
      return mailboxFor(address.address) ? cb() : cb(Object.assign(new Error("Unbekannter Empfänger"), { responseCode: 550 }));
    },
    onData(stream, session, cb) {
      simpleParser(stream).then(async (p) => {
        for (const rcpt of session.envelope.rcptTo) {
          const mailbox = mailboxFor(rcpt.address);
          if (!mailbox) continue;
          const from = p.from?.value?.[0] || {};
          const r = ingestEmail(db, mailbox, {
            message_id: p.messageId, in_reply_to: p.inReplyTo, from_name: from.name, from_addr: from.address || session.envelope.mailFrom?.address || "unbekannt",
            to_addr: mailbox.address, subject: p.subject, body: p.text || "", received_at: (p.date || new Date()).toISOString(),
          });
          if (!r.duplicate) await processEmail(db, r.id);
        }
        cb();
      }).catch((err) => cb(err));
    },
  });
  await new Promise((res) => server.listen(port, host, res));
  return server;
}

export const inboundAddress = (mailbox) =>
  process.env.INBOUND_DOMAIN && mailbox.inbound_token ? `${mailbox.inbound_token}@${process.env.INBOUND_DOMAIN}` : null;

