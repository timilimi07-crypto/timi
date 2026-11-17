// Lokale Auswertung ohne KI-Dienst: Stichwortregeln für deutsche Geschäfts-Mails.
// Wird genutzt, wenn kein Claude-Zugang eingerichtet ist (Demo, Tests) und als
// Rückfallebene, falls der KI-Dienst nicht erreichbar ist.

export const CATEGORIES = ["anfrage", "reklamation", "rechnung", "termin", "bewerbung", "info", "spam"];
export const CATEGORY_LABELS = {
  anfrage: "Anfrage", reklamation: "Reklamation", rechnung: "Rechnung/Zahlung",
  termin: "Termin", bewerbung: "Bewerbung", info: "Info/Newsletter", spam: "Spam",
};

const KEYWORDS = {
  spam: ["gewonnen", "gewinner", "bitcoin", "krypto-gewinn", "klicken sie hier", "100% gratis", "casino",
    "nigerianisch", "erbschaft", "potenzmittel", "sofortkredit", "ihr konto wurde gesperrt", "verifizieren sie ihr konto"],
  reklamation: ["reklamation", "beschwerde", "defekt", "kaputt", "beschädigt", "funktioniert nicht", "mangel",
    "schaden", "rückerstattung", "erstattung", "umtausch", "falsch geliefert", "fehlt", "unzufrieden",
    "wasserschaden", "rohrbruch", "heizung ausgefallen", "schimmel", "undicht", "verspätet", "nicht angekommen",
    "immer noch nicht", "warte immer noch", "stornier", "geld zurück", "lärm", "belästigung", "zerbrochen", "kaputt"],
  rechnung: ["rechnung", "zahlung", "mahnung", "überweisung", "zahlungserinnerung", "gutschrift", "beleg",
    "belege", "lastschrift", "offener betrag", "offene posten", "nebenkostenabrechnung", "abrechnung", "kontoauszug", "steuerbescheid"],
  termin: ["termin", "besichtigung", "meeting", "verschieben", "absagen", "uhrzeit", "kalender", "treffen",
    "eigentümerversammlung", "rückruf"],
  bewerbung: ["bewerbung", "lebenslauf", "stellenanzeige", "ausbildungsplatz", "praktikum", "anschreiben"],
  info: ["newsletter", "abmelden", "unsubscribe", "pressemitteilung", "zur info", "zur kenntnis", "webinar",
    "automatisch generiert", "noreply", "no-reply", "versandbestätigung", "auftragsbestätigung"],
  anfrage: ["anfrage", "angebot", "preis", "kosten", "interesse", "interessiert", "möchte wissen", "verfügbar",
    "können sie", "könnten sie", "frage", "wie lange", "wann", "auskunft", "kostenvoranschlag"],
};

const URGENT = ["dringend", "sofort", "umgehend", "eilig", "notfall", "asap", "heute noch", "frist", "letzte mahnung",
  "rechtliche schritte", "anwalt", "inkasso", "wasserschaden", "rohrbruch", "heizung ausgefallen", "fristablauf",
  "säumniszuschlag", "so schnell wie möglich"];
const NEGATIVE = ["verärgert", "enttäuscht", "unzumutbar", "inakzeptabel", "ärgerlich", "frechheit", "unverschämt",
  "katastrophe", "nicht zufrieden", "unzufrieden", "zum wiederholten mal", "schon wieder", "echt enttäuscht", "verärgert"];
const POSITIVE = ["vielen dank", "danke", "super", "zufrieden", "begeistert", "toll", "hervorragend", "gerne wieder"];

const WEEKDAYS = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };

const lc = (s) => (s || "").toLowerCase();
const countHits = (text, words) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

// Entfernt Anrede, Grußformel, Signatur und zitierte Vorgänger-Mails.
export function cleanBody(body) {
  const lines = (body || "").replace(/\r/g, "").split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^>/.test(t)) continue;
    if (/^(am .* schrieb|-----\s*ursprüngliche nachricht|von:\s)/i.test(t)) break;
    if (/^(mit freundlichen grüßen|freundliche grüße|viele grüße|beste grüße|liebe grüße|mfg|gruß|grüße|herzliche grüße|lg)\b/i.test(t)) break;
    if (/^--\s*$/.test(t)) break;
    out.push(t);
  }
  let text = out.join(" ").replace(/\s+/g, " ").trim();
  // Anrede nur entfernen, wenn sie kurz ist und mit Komma/Ausrufezeichen endet (sonst bleibt der Text erhalten).
  text = text.replace(/^(sehr geehrte[rs]?|liebe[rs]?|hallo|guten tag|moin|servus|hi)\b[^,!?]{0,50}[,!]\s*/i, "")
    .replace(/^(hallo|hi|moin|servus|guten tag)\s+/i, "");
  return text;
}

// Satztrennung, die Datumsangaben (28.11.), Beträge (1.284,50), Ordnungszahlen (2. OG)
// und Abkürzungen (Dr., Nr., z.B.) nicht zerschneidet.
const ABBREV = /(?:^|\s)(dr|nr|str|bzw|ca|inkl|evtl|ggf|z\.b|u\.a|d\.h|tel|vgl|abs|ff|st|hr|fr)\.$/i;
export function sentences(text) {
  const out = [];
  let cur = "";
  const parts = (text || "").split(/(?<=[.!?])\s+/);
  for (const part of parts) {
    cur = cur ? `${cur} ${part}` : part;
    const endsWithNumber = /(?:^|\s)\d{1,4}\.(\d{1,2}\.)?$/.test(cur);
    if (ABBREV.test(cur) || endsWithNumber) continue;
    out.push(cur.trim());
    cur = "";
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => s.length > 3);
}

export function classify(subject, body, fromAddr = "") {
  const text = lc(`${subject} ${body} ${fromAddr}`);
  const scores = {};
  for (const c of CATEGORIES) scores[c] = countHits(text, KEYWORDS[c]);
  // Betreff zählt doppelt.
  for (const c of CATEGORIES) scores[c] += countHits(lc(subject), KEYWORDS[c]);
  if (scores.spam >= 1 && scores.spam >= scores.anfrage) return "spam";
  let best = "anfrage", bestScore = 0;
  for (const c of ["reklamation", "rechnung", "bewerbung", "termin", "info", "anfrage"]) {
    if (scores[c] > bestScore) { best = c; bestScore = scores[c]; }
  }
  return best;
}

export function sentimentOf(text) {
  const t = lc(text);
  const neg = countHits(t, NEGATIVE), pos = countHits(t, POSITIVE);
  if (neg > pos) return "negativ";
  if (pos > neg) return "positiv";
  return "neutral";
}

export function priorityOf(category, text, sentiment) {
  const t = lc(text);
  if (category === "spam" || category === "info" || category === "bewerbung") return "niedrig";
  if (countHits(t, URGENT) > 0) return "hoch";
  if (category === "reklamation" && sentiment === "negativ") return "hoch";
  return "mittel";
}

const fmt = (d) => d.toISOString().slice(0, 10);

// Erkennt Fristen wie "bis Freitag", "bis zum 25.11.", "bis morgen", "innerhalb von 3 Tagen".
export function parseDeadline(sentence, baseIso) {
  const s = lc(sentence);
  const base = new Date(baseIso || Date.now());
  base.setUTCHours(12, 0, 0, 0);
  let m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
  if (m && /(bis|spätestens|zum|am|vor|frist)/.test(s)) {
    let year = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : base.getUTCFullYear();
    const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), 12));
    if (!m[3] && d < base) d.setUTCFullYear(year + 1);
    return fmt(d);
  }
  if (/\bheute\b/.test(s)) return fmt(base);
  if (/\bübermorgen\b/.test(s)) return fmt(new Date(base.getTime() + 2 * 864e5));
  if (/\bmorgen\b/.test(s)) return fmt(new Date(base.getTime() + 864e5));
  m = s.match(/innerhalb (?:von |der nächsten )?(\d+|zwei|drei|vier|fünf|sieben|zehn|14) (tag|tage|tagen|woche|wochen)/);
  if (m) {
    const words = { zwei: 2, drei: 3, vier: 4, "fünf": 5, sieben: 7, zehn: 10 };
    const n = Number(m[1]) || words[m[1]] || 1;
    return fmt(new Date(base.getTime() + n * (m[2].startsWith("woche") ? 7 : 1) * 864e5));
  }
  if (/ende (der|dieser) woche|bis zum wochenende/.test(s)) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7)); return fmt(d);
  }
  if (/ende (des|dieses) monats|monatsende/.test(s)) {
    return fmt(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 12)));
  }
  m = s.match(/(?:bis|spätestens|am|zum) (?:zum |kommenden |nächsten )?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)/);
  if (m) {
    const target = WEEKDAYS[m[1]];
    let diff = (target - base.getUTCDay() + 7) % 7; if (diff === 0) diff = 7;
    return fmt(new Date(base.getTime() + diff * 864e5));
  }
  return null;
}

const REQUEST = /(bitte|können sie|könnten sie|würden sie|ich benötige|wir benötigen|ich bitte um|wir bitten um|schicken sie|senden sie|melden sie sich|rufen sie|ich brauche|wir brauchen|erwarte[n]? ich|teilen sie mir|lassen sie mir|bis wann)/i;

export function extractTasks(subject, body, receivedAt, category) {
  if (category === "spam" || category === "info") return [];
  const tasks = [];
  for (const sent of sentences(cleanBody(body))) {
    if (!REQUEST.test(sent)) continue;
    let title = sent.replace(/^(und|außerdem|zudem|also)\s+/i, "").replace(/\s+/g, " ");
    if (title.length > 140) title = title.slice(0, 137).replace(/\s\S*$/, "") + " …";
    if (title.length < 45) title = `${(subject || "").replace(/^\s*((re|aw|wg|fwd?)\s*:\s*)+/i, "")}: ${title}`;
    tasks.push({ title, due_date: parseDeadline(sent, receivedAt) });
    if (tasks.length >= 3) break;
  }
  return tasks;
}

export function summarize(fromName, subject, body, category) {
  const name = fromName || "Absender";
  const text = cleanBody(body);
  const sents = sentences(text);
  if (category === "spam") return `Vermutlich Spam: „${subject}".`;
  if (!sents.length) return `${name} schreibt zum Thema „${subject}".`;
  // Wichtigste Sätze: Bitten/Fragen und Sätze mit Stichworten bevorzugen.
  const scored = sents.map((s, i) => ({
    s, i,
    score: (REQUEST.test(s) ? 3 : 0) + (s.includes("?") ? 2 : 0) + countHits(lc(s), URGENT) * 2 + (i === 0 ? 1.5 : 0),
  }));
  const picked = scored.sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i).map((x) => x.s);
  let summary = `${name}: ${picked.join(" ")}`;
  if (summary.length > 260) summary = summary.slice(0, 257).replace(/\s\S*$/, "") + " …";
  return summary;
}

// Sucht passende Zeilen im Firmenwissen (Format: "Thema: Information" pro Zeile).
// Passend ist eine Zeile, wenn ein Wort aus ihrem Thema (Text vor dem Doppelpunkt) in der Mail vorkommt.
const STOP = new Set(["oder", "und", "bei", "für", "nach", "der", "die", "das", "mit", "von"]);
export function relevantKnowledge(knowledge, text) {
  const t = lc(text);
  return (knowledge || "").split("\n").map((l) => l.trim()).filter(Boolean).filter((line) => {
    const topic = lc(line.includes(":") ? line.split(":")[0] : line);
    const stems = topic.split(/[^a-zäöüß0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w)).map((w) => w.slice(0, 6));
    return stems.some((st) => t.includes(st));
  }).slice(0, 3);
}

const OPENERS = {
  anfrage: "vielen Dank für Ihre Anfrage.",
  reklamation: "vielen Dank für Ihre Nachricht, und es tut uns leid, dass es Grund zur Beschwerde gibt.",
  rechnung: "vielen Dank für Ihre Nachricht zu Rechnung bzw. Zahlung.",
  termin: "vielen Dank für Ihre Nachricht zum Termin.",
  bewerbung: "vielen Dank für Ihre Bewerbung und Ihr Interesse an unserem Unternehmen.",
};
const CLOSERS = {
  anfrage: "Gerne senden wir Ihnen die fehlenden Details zu. Melden Sie sich bei weiteren Fragen jederzeit.",
  reklamation: "Wir prüfen den Vorgang umgehend und melden uns spätestens innerhalb von zwei Werktagen mit einer Lösung bei Ihnen.",
  rechnung: "Wir prüfen den Vorgang in unserer Buchhaltung und melden uns kurzfristig bei Ihnen.",
  termin: "Wir prüfen die Verfügbarkeit und bestätigen Ihnen den Termin in Kürze.",
  bewerbung: "Wir sehen uns Ihre Unterlagen sorgfältig an und melden uns innerhalb von zwei Wochen bei Ihnen.",
};

// Du-Form, wenn die Firma das im Tonfall so eingestellt hat.
const DU = [[/Ihre /g, "deine "], [/Ihr /g, "dein "], [/Ihnen/g, "dir"], [/Melden Sie sich/g, "Melde dich"], [/ bei Ihnen/g, " bei dir"]];
const toDu = (t) => DU.reduce((s, [a, b]) => s.replace(a, b), t).replace(/\n(dein|deine) /g, (m, w) => `\n${w[0].toUpperCase()}${w.slice(1)} `);

export function draftReply(email, company, category, tasks) {
  if (category === "spam" || category === "info") return null;
  const du = /du-form|\bduzen\b|\bdu\b/i.test(company.tone || "");
  const name = email.from_name ? email.from_name.trim() : "";
  const first = name.split(/\s+/)[0];
  const greeting = du ? (first ? `Hallo ${first},` : "Hallo,") : name ? `Guten Tag ${name},` : "Guten Tag,";
  const facts = relevantKnowledge(company.knowledge, `${email.subject} ${email.body}`);
  const parts = [greeting, "", OPENERS[category] || OPENERS.anfrage];
  if (facts.length) {
    parts.push("", "Vorab die wichtigsten Informationen:");
    for (const f of facts) parts.push(`• ${f}`);
  }
  const due = tasks.find((t) => t.due_date);
  if (due) {
    const [y, m, d] = due.due_date.split("-");
    parts.push("", `Ihr Anliegen haben wir notiert und kümmern uns bis zum ${d}.${m}.${y} darum.`);
  }
  parts.push("", CLOSERS[category] || CLOSERS.anfrage, "", du ? "Viele Grüße" : "Mit freundlichen Grüßen", company.signature || company.name);
  const text = parts.join("\n");
  return du ? toDu(text) : text;
}

export function analyzeLocal(email, company, departments = []) {
  const text = `${email.subject} ${email.body}`;
  let category = classify(email.subject, email.body, email.from_addr);
  const sentiment = sentimentOf(text);
  let tasks = extractTasks(email.subject, email.body, email.received_at, category);
  // Reines Lob ohne Bitte oder Frage braucht keine Bearbeitung.
  if (category === "anfrage" && sentiment === "positiv" && !tasks.length && !text.includes("?")) { category = "info"; tasks = []; }
  let priority = priorityOf(category, text, sentiment);
  // Frist in den nächsten 2 Tagen macht eine Mail dringend.
  const soon = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  if (priority === "mittel" && tasks.some((t) => t.due_date && t.due_date <= soon)) priority = "hoch";
  return {
    category, priority, sentiment,
    summary: summarize(email.from_name, email.subject, email.body, category),
    department: null, // Zuständigkeit regelt bei der lokalen Auswertung die Regel-Tabelle
    tasks,
    draft: draftReply(email, company, category, tasks),
  };
}

// Zusammenfassung über viele Mails (Tages-/Wochenübersicht) ohne KI.
export function digestLocal(company, stats, items, periodLabel) {
  const open = items.filter((e) => e.status === "open" && e.category !== "spam");
  const urgent = open.filter((e) => e.priority === "hoch");
  const byCat = {};
  for (const e of items) byCat[e.category] = (byCat[e.category] || 0) + 1;
  const topCats = Object.entries(byCat).filter(([c]) => c !== "spam").sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, n]) => `${CATEGORY_LABELS[c] || c} (${n})`);
  const headline = urgent.length
    ? `${urgent.length} dringende E-Mail${urgent.length > 1 ? "s" : ""} warten auf Bearbeitung`
    : open.length ? `${open.length} offene E-Mails, nichts davon akut dringend` : "Postfach im Griff – keine offenen E-Mails";
  const overview = `${periodLabel}: ${stats.total} E-Mails eingegangen, davon ${stats.open} offen, ${stats.answered} beantwortet` +
    `${stats.spam ? ` und ${stats.spam} als Spam aussortiert` : ""}. Häufigste Themen: ${topCats.join(", ") || "–"}.` +
    `${stats.negative ? ` ${stats.negative} Absender wirken verärgert.` : ""}`;
  const topics = Object.entries(byCat).filter(([c]) => c !== "spam").sort((a, b) => b[1] - a[1]).map(([c]) => {
    const ex = items.filter((e) => e.category === c).slice(0, 3).map((e) => e.subject);
    return `${CATEGORY_LABELS[c] || c}: ${ex.join(" · ")}`;
  });
  const actions = [
    ...urgent.slice(0, 5).map((e) => `Dringend: „${e.subject}" von ${e.from_name || e.from_addr} beantworten`),
    ...(stats.overdue_followups ? [`${stats.overdue_followups} Kunden warten länger als ${company.followup_hours} Std. auf eine Antwort`] : []),
    ...(stats.tasks_due ? [`${stats.tasks_due === 1 ? "1 Aufgabe ist" : `${stats.tasks_due} Aufgaben sind`} heute fällig oder überfällig`] : []),
  ];
  return { headline, overview, topics, actions };
}

export function threadSummaryLocal(emails) {
  if (!emails.length) return "";
  const first = emails[0], last = emails[emails.length - 1];
  const lines = emails.map((e) => `• ${e.received_at.slice(0, 10)} ${e.direction === "out" ? "Wir" : (e.from_name || e.from_addr)}: ${e.summary || summarize(e.from_name, e.subject, e.body, e.category || "anfrage")}`);
  const state = last.direction === "out" ? "Zuletzt haben wir geantwortet – der Kunde ist am Zug." : "Die letzte Nachricht kam vom Kunden – wir sind am Zug.";
  return `Verlauf „${first.subject.replace(/^(re|aw|fwd|wg):\s*/i, "")}" mit ${emails.length} Nachricht(en). ${state}\n${lines.join("\n")}`;
}
