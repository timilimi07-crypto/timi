// Google-Anbindung: Kalender und Gmail
// Einmalige Anmeldung über OAuth; das Token liegt danach in data/google-token.json.

import { auth, calendar } from "@googleapis/calendar";
import { gmail } from "@googleapis/gmail";
import fs from "fs/promises";
import path from "path";
import { dataPath } from "./paths.js";

const TOKEN_FILE = dataPath("google-token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

let oauth = null;
let tokensLoaded = false;
let redirectUri = null;

export function configureGoogle(uri) {
  redirectUri = uri;
}

// Nach dem Ändern der Zugangsdaten in den Einstellungen neu aufbauen.
export function resetGoogle() {
  oauth = null;
  tokensLoaded = false;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function client() {
  if (!oauth) {
    oauth = new auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
    // Google schickt beim Auffrischen manchmal neue Tokens – immer mitspeichern.
    oauth.on("tokens", async (tokens) => {
      const merged = { ...oauth.credentials, ...tokens };
      await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
      await fs.writeFile(TOKEN_FILE, JSON.stringify(merged, null, 2));
    });
  }
  return oauth;
}

async function connectedClient() {
  if (!googleConfigured()) return null;
  const c = client();
  if (!tokensLoaded) {
    try {
      c.setCredentials(JSON.parse(await fs.readFile(TOKEN_FILE, "utf8")));
      tokensLoaded = true;
    } catch {
      return null;
    }
  }
  return c;
}

export async function googleConnected() {
  return Boolean(await connectedClient());
}

// Wurden neue Berechtigungen hinzugefügt (z. B. Gmail), muss einmal neu verbunden werden.
export async function googleNeedsReconnect() {
  const c = await connectedClient();
  if (!c) return false;
  const granted = c.credentials.scope ?? "";
  return SCOPES.some((s) => !granted.includes(s));
}

export function authUrl() {
  return client().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleCallback(code) {
  const c = client();
  const { tokens } = await c.getToken(code);
  c.setCredentials(tokens);
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  tokensLoaded = true;
}

export async function disconnect() {
  await fs.rm(TOKEN_FILE, { force: true });
  tokensLoaded = false;
  if (oauth) oauth.setCredentials({});
}

// ---------------------------------------------------------------------------
// Zeit-Hilfen: Das Modell nennt lokale Zeiten ("2026-10-10T15:00"), Google
// braucht für Abfragen einen Zeitpunkt mit Zeitzonen-Versatz.

function offsetFor(date, timeZone) {
  const name = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName").value; // z. B. "GMT+02:00" oder "GMT"
  return name === "GMT" ? "+00:00" : name.slice(3);
}

function toRFC3339(local, timeZone) {
  if (/([zZ]|[+-]\d\d:\d\d)$/.test(local)) return local;
  const base = local.length === 10 ? `${local}T00:00:00` : local.length === 16 ? `${local}:00` : local;
  // Versatz zweimal bestimmen, damit Tage mit Zeitumstellung stimmen.
  const guess = new Date(`${base}Z`);
  const offset = offsetFor(new Date(guess.getTime() - parseOffset(offsetFor(guess, timeZone))), timeZone);
  return `${base}${offset}`;
}

function parseOffset(o) {
  const sign = o.startsWith("-") ? -1 : 1;
  const [h, m] = o.slice(1).split(":").map(Number);
  return sign * (h * 60 + m) * 60000;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Werkzeuge

export const CALENDAR_TOOLS = [
  {
    name: "kalender_termine_abrufen",
    description:
      "Liest Termine aus allen Google-Kalendern des Nutzers im angegebenen Zeitraum. Zeiten als lokale Zeit im Format JJJJ-MM-TT oder JJJJ-MM-TTThh:mm.",
    input_schema: {
      type: "object",
      properties: {
        von: { type: "string", description: "Beginn des Zeitraums" },
        bis: { type: "string", description: "Ende des Zeitraums (ein reines Datum zählt bis Tagesende)" },
        suchbegriff: { type: "string", description: "Optional: nur Termine, die diesen Text enthalten" },
      },
      required: ["von", "bis"],
    },
  },
  {
    name: "kalender_termin_erstellen",
    description:
      "Trägt einen Termin in den Hauptkalender des Nutzers ein. Zeiten als lokale Zeit JJJJ-MM-TTThh:mm, bei ganztägigen Terminen nur JJJJ-MM-TT.",
    input_schema: {
      type: "object",
      properties: {
        titel: { type: "string" },
        start: { type: "string" },
        ende: { type: "string", description: "Optional; Standard ist eine Stunde nach Start bzw. ein Tag bei ganztägig" },
        ganztaegig: { type: "boolean" },
        ort: { type: "string" },
        beschreibung: { type: "string" },
      },
      required: ["titel", "start"],
    },
  },
  {
    name: "kalender_termin_loeschen",
    description:
      "Löscht einen Termin. Vorher immer beim Nutzer nachfragen. ID und kalender_id stammen aus kalender_termine_abrufen.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, kalender_id: { type: "string" } },
      required: ["id", "kalender_id"],
    },
  },
];

export const GMAIL_TOOLS = [
  {
    name: "mails_suchen",
    description:
      "Sucht E-Mails im Gmail-Konto des Nutzers. Ohne Suchanfrage kommen die neuesten Mails aus dem Posteingang. Unterstützt die Gmail-Suchsyntax, z. B. 'is:unread', 'from:anna', 'newer_than:2d'.",
    input_schema: {
      type: "object",
      properties: {
        suchanfrage: { type: "string" },
        anzahl: { type: "integer", description: "Wie viele Mails höchstens (Standard 10, maximal 25)" },
      },
    },
  },
  {
    name: "mail_lesen",
    description: "Liest den vollständigen Text einer E-Mail. Die ID stammt aus mails_suchen.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "mail_senden",
    description:
      "Sendet eine E-Mail im Namen des Nutzers. Vorher IMMER Empfänger, Betreff und Inhalt kurz vorlesen und ausdrücklich bestätigen lassen. Für Antworten antwort_auf_id angeben.",
    input_schema: {
      type: "object",
      properties: {
        an: { type: "string", description: "E-Mail-Adresse des Empfängers" },
        betreff: { type: "string" },
        text: { type: "string" },
        antwort_auf_id: { type: "string", description: "Optional: ID der Mail, auf die geantwortet wird" },
      },
      required: ["an", "betreff", "text"],
    },
  },
];

const NOT_CONNECTED = {
  fehler:
    "Google ist nicht verbunden. Der Nutzer soll im Fenster 'Verbindungen' Google verbinden.",
};

function header(msg, name) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(data) {
  return Buffer.from(data, "base64url").toString("utf8");
}

// Text aus einer (verschachtelten) MIME-Nachricht holen, Klartext bevorzugt.
function extractText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
  for (const p of part.parts ?? []) {
    const t = extractText(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBody(part.body.data)
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return "";
}

// Betreff-Zeilen mit Umlauten müssen kodiert werden.
function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

async function executeGmail(name, input, c) {
  const gm = gmail({ version: "v1", auth: c });
  switch (name) {
    case "mails_suchen": {
      const max = Math.min(Math.max(Number(input.anzahl) || 10, 1), 25);
      const { data } = await gm.users.messages.list({
        userId: "me",
        q: input.suchanfrage || undefined,
        labelIds: input.suchanfrage ? undefined : ["INBOX"],
        maxResults: max,
      });
      const mails = await Promise.all(
        (data.messages ?? []).map(async (m) => {
          const { data: msg } = await gm.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          });
          return {
            id: msg.id,
            von: header(msg, "From"),
            betreff: header(msg, "Subject"),
            datum: header(msg, "Date"),
            vorschau: msg.snippet,
            ungelesen: msg.labelIds?.includes("UNREAD") ?? false,
          };
        }),
      );
      return { mails };
    }
    case "mail_lesen": {
      const { data: msg } = await gm.users.messages.get({ userId: "me", id: input.id, format: "full" });
      const text = extractText(msg.payload);
      return {
        id: msg.id,
        von: header(msg, "From"),
        an: header(msg, "To"),
        betreff: header(msg, "Subject"),
        datum: header(msg, "Date"),
        text: text.length > 8000 ? text.slice(0, 8000) + "\n[…gekürzt]" : text,
      };
    }
    case "mail_senden": {
      const lines = [`To: ${input.an}`, `Subject: ${encodeHeader(input.betreff)}`];
      let threadId;
      if (input.antwort_auf_id) {
        const { data: orig } = await gm.users.messages.get({
          userId: "me",
          id: input.antwort_auf_id,
          format: "metadata",
          metadataHeaders: ["Message-ID"],
        });
        const ref = header(orig, "Message-ID");
        if (ref) lines.push(`In-Reply-To: ${ref}`, `References: ${ref}`);
        threadId = orig.threadId;
      }
      lines.push("Content-Type: text/plain; charset=UTF-8", "MIME-Version: 1.0", "", input.text);
      const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
      const { data } = await gm.users.messages.send({ userId: "me", requestBody: { raw, threadId } });
      return { ok: true, id: data.id };
    }
  }
  return { fehler: `Unbekanntes Werkzeug: ${name}` };
}

export async function executeGoogleTool(name, input, timeZone) {
  const c = await connectedClient();
  if (!c) return NOT_CONNECTED;
  if (!name.startsWith("kalender_")) {
    try {
      return await executeGmail(name, input, c);
    } catch (err) {
      return googleError(err);
    }
  }
  const cal = calendar({ version: "v3", auth: c });

  try {
    switch (name) {
      case "kalender_termine_abrufen": {
        const bis = input.bis.length === 10 ? addDays(input.bis, 1) : input.bis;
        const { data } = await cal.calendarList.list();
        const calendars = (data.items ?? []).filter((k) => k.selected !== false);
        const lists = await Promise.all(
          calendars.map(async (k) => {
            const res = await cal.events.list({
              calendarId: k.id,
              timeMin: toRFC3339(input.von, timeZone),
              timeMax: toRFC3339(bis, timeZone),
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 50,
              q: input.suchbegriff || undefined,
              timeZone,
            });
            return (res.data.items ?? []).map((e) => ({
              id: e.id,
              kalender_id: k.id,
              kalender: k.summaryOverride || k.summary,
              titel: e.summary ?? "(ohne Titel)",
              start: e.start?.dateTime ?? e.start?.date,
              ende: e.end?.dateTime ?? e.end?.date,
              ganztaegig: Boolean(e.start?.date),
              ort: e.location,
            }));
          }),
        );
        const termine = lists.flat().sort((a, b) => String(a.start).localeCompare(String(b.start)));
        return { termine };
      }
      case "kalender_termin_erstellen": {
        let start, end;
        if (input.ganztaegig) {
          const day = input.start.slice(0, 10);
          start = { date: day };
          end = { date: input.ende ? input.ende.slice(0, 10) : addDays(day, 1) };
        } else {
          const startIso = toRFC3339(input.start, timeZone);
          const endIso = input.ende
            ? toRFC3339(input.ende, timeZone)
            : new Date(new Date(startIso).getTime() + 3600000).toISOString();
          start = { dateTime: startIso, timeZone };
          end = { dateTime: endIso, timeZone };
        }
        const { data } = await cal.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: input.titel,
            location: input.ort,
            description: input.beschreibung,
            start,
            end,
          },
        });
        return { ok: true, id: data.id, kalender_id: "primary", start: data.start, ende: data.end };
      }
      case "kalender_termin_loeschen": {
        await cal.events.delete({ calendarId: input.kalender_id, eventId: input.id });
        return { ok: true };
      }
    }
  } catch (err) {
    return googleError(err);
  }
  return { fehler: `Unbekanntes Werkzeug: ${name}` };
}

function googleError(err) {
  console.error("Google:", err.message);
  if (err.response?.status === 401 || err.message?.includes("invalid_grant")) {
    return { fehler: "Die Verbindung zu Google ist abgelaufen. Der Nutzer muss Google in den Verbindungen neu verbinden." };
  }
  if (err.response?.status === 403) {
    return { fehler: "Keine Berechtigung. Der Nutzer muss Google in den Verbindungen neu verbinden." };
  }
  return { fehler: `Google meldet einen Fehler: ${err.message}` };
}
