/**
 * Standard-Kategorien für neue Firmen. Die Beschreibung fließt später in den
 * KI-Prompt ein, damit das Modell die Kategorien der Firma versteht.
 * Kategorien sind pro Firma frei anpassbar.
 */
export const DEFAULT_CATEGORIES = [
  { key: "kunde", name: "Kunde", color: "blue", icon: "user-round", description: "Anfragen, Bestellungen, Rückfragen und Korrespondenz von Kunden." },
  { key: "rechnung", name: "Rechnung", color: "emerald", icon: "receipt", description: "Rechnungen, Mahnungen, Zahlungserinnerungen, Gutschriften." },
  { key: "bewerbung", name: "Bewerbung", color: "violet", icon: "briefcase", description: "Bewerbungen, Initiativbewerbungen, Rückfragen von Bewerbern." },
  { key: "support", name: "Support", color: "amber", icon: "life-buoy", description: "Störungen, Reklamationen, technische Probleme, Beschwerden." },
  { key: "lieferant", name: "Lieferant", color: "orange", icon: "truck", description: "Angebote, Lieferbestätigungen, Lieferverzögerungen von Lieferanten." },
  { key: "intern", name: "Intern", color: "cyan", icon: "building-2", description: "Nachrichten von Kolleginnen und Kollegen derselben Firma." },
  { key: "newsletter", name: "Newsletter", color: "slate", icon: "newspaper", description: "Newsletter, Werbung, Webinare, automatische Benachrichtigungen.", autoCollapse: true },
  { key: "spam", name: "Spam", color: "red", icon: "shield-alert", description: "Unerwünschte Werbung, Phishing, Betrugsversuche.", autoCollapse: true },
] as const;
