/**
 * Phishing-Heuristik – läuft beim Abruf jeder E-Mail, also sofort und ohne KI.
 * Die KI-Vorsortierung (Haiku) gibt zusätzlich eine eigene Einschätzung ab;
 * die E-Mail wird markiert, wenn Heuristik ODER KI anschlagen.
 *
 * Bewusst konservativ: Erst ab mehreren Signalen (Punktzahl ≥ 3) wird
 * gewarnt, damit normale Newsletter oder Rechnungen nicht auffallen.
 */

export type PhishingCheck = { score: number; suspected: boolean; reasons: string[] };

export const PHISHING_THRESHOLD = 3;

const SUSPICIOUS_TLDS = ["xyz", "top", "click", "buzz", "rest", "cfd", "sbs", "icu", "cyou", "zip", "mov", "work", "loan", "gq", "tk", "ml", "cf", "ga"];
const DANGEROUS_EXT = /\.(zip|rar|7z|exe|scr|js|vbs|bat|cmd|iso|img|html?|hta|lnk|docm|xlsm|pptm|jar)$/i;
const BRAND_WORDS = /(bank|sparkasse|volksbank|paypal|amazon|microsoft|apple|dhl|post|telekom|finanzamt|sicherheit|kundenservice|support-team)/i;

const CREDENTIAL_PATTERNS: [RegExp, string][] = [
  [/(konto|zugang|account).{0,40}(gesperrt|eingeschränkt|deaktiviert|suspendiert)/i, "Behauptet gesperrtes Konto"],
  [/(bestätigen|verifizieren|aktualisieren) sie (jetzt |bitte )?(ihre|ihr) (identität|daten|konto|zugangsdaten|passwort)/i, "Fordert Bestätigung von Zugangsdaten/Identität"],
  [/(passwort|kennwort|pin|tan)\b.{0,40}(eingeben|bestätigen|angeben)/i, "Fragt Passwort/PIN/TAN ab"],
  [/(innerhalb|binnen) (von )?(24|48|72) stunden|letzte (aufforderung|warnung)|sofort(ige)? (handeln|zahlung)/i, "Erzeugt Zeitdruck"],
  [/(pfändung|inkasso|strafanzeige|gerichtlich)/i, "Droht mit rechtlichen Folgen"],
  [/(gewonnen|gewinner|ausgewählt).{0,60}(preis|gewinn|iphone|gutschein)/i, "Gewinnversprechen"],
];

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function tldOf(domain: string): string {
  return domain.split(".").pop() ?? "";
}

export function checkPhishing(m: {
  fromName?: string | null;
  fromEmail: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  attachments: { filename: string }[];
}): PhishingCheck {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  const domain = domainOf(m.fromEmail);
  if (SUSPICIOUS_TLDS.includes(tldOf(domain))) add(1, `Ungewöhnliche Absender-Domain (.${tldOf(domain)})`);
  if (m.fromName && BRAND_WORDS.test(m.fromName) && !BRAND_WORDS.test(domain)) {
    add(1, `Absendername „${m.fromName}“ passt nicht zur Domain ${domain}`);
  }
  if (m.replyTo && domainOf(m.replyTo) && domainOf(m.replyTo) !== domain) {
    add(1, `Antwortadresse (${domainOf(m.replyTo)}) weicht vom Absender ab`);
  }

  const haystack = `${m.subject}\n${m.text}`;
  for (const [re, reason] of CREDENTIAL_PATTERNS) if (re.test(haystack)) add(1, reason);

  const links = [...m.text.matchAll(/https?:\/\/([^\s/"'<>]+)/gi)].map((x) => x[1]!.toLowerCase());
  if (links.some((h) => /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(h))) add(2, "Link auf eine IP-Adresse");
  if (/http:\/\/[^\s]*(login|konto|verif|secure|sicher)/i.test(m.text)) add(1, "Unverschlüsselter Anmelde-Link");
  if (links.some((h) => SUSPICIOUS_TLDS.includes(tldOf(h.split(":")[0]!)))) add(1, "Link auf ungewöhnliche Domain");

  const dangerous = m.attachments.filter((a) => DANGEROUS_EXT.test(a.filename));
  if (dangerous.length) add(2, `Riskanter Anhang: ${dangerous.map((a) => a.filename).join(", ")}`);

  return { score, suspected: score >= PHISHING_THRESHOLD, reasons: [...new Set(reasons)] };
}
