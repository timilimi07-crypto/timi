/**
 * Demo-E-Mails für den Demo-Modus (ohne echtes Postfach).
 *
 * Zeitangaben sind relativ zum Anlegen des Demo-Postfachs (`minutesAgo`):
 *  - positive Werte: E-Mail lag beim ersten Abruf schon im Postfach
 *  - negative Werte: E-Mail „trifft erst später ein“ (z. B. -25 = 25 Minuten
 *    nach dem Anlegen) – so lässt sich der automatische Abruf beobachten
 *  - E-Mails älter als 30 Tage demonstrieren das Abruf-Zeitfenster: Sie werden
 *    beim ersten Sync übersprungen (Standard: letzte 30 Tage).
 *
 * `inReplyTo` verweist auf eine andere Demo-E-Mail und bildet Threads.
 * Alle Firmen, Personen, Telefonnummern und IBANs sind frei erfunden.
 */

export type DemoSet = "info" | "buchhaltung" | "dispo";

export type DemoEmail = {
  id: string;
  set: DemoSet;
  minutesAgo: number;
  from: { name: string; email: string };
  cc?: { name: string; email: string }[];
  subject: string;
  text: string;
  inReplyTo?: string;
  isRead?: boolean;
  attachments?: { filename: string; mimeType: string; size: number }[];
};

const PDF = "application/pdf";
const JPG = "image/jpeg";
const DAY = 24 * 60;

export const DEMO_RECIPIENTS: Record<DemoSet, { name: string; email: string }> = {
  info: { name: "Müller & Partner Info", email: "info@mueller-partner.de" },
  buchhaltung: { name: "Müller & Partner Buchhaltung", email: "buchhaltung@mueller-partner.de" },
  dispo: { name: "Nordlicht Disposition", email: "dispo@nordlicht-logistik.de" },
};

export const DEMO_EMAILS: DemoEmail[] = [
  // ---------------------------------------------------------------------------
  // Postfach „Info“ – Müller & Partner GmbH (Anlagenbau & Service)
  // ---------------------------------------------------------------------------
  {
    id: "info-01",
    set: "info",
    minutesAgo: 35,
    from: { name: "Dr. Michael Brandt", email: "m.brandt@stadtwerke-kassel.de" },
    subject: "DRINGEND: Anlage 3 ausgefallen – Produktionsstillstand",
    text: `Sehr geehrte Damen und Herren,

seit heute 6:40 Uhr steht unsere Druckerhöhungsanlage 3 (Wartungsvertrag WV-2024-118) still. Die Steuerung zeigt Fehler E-501 und lässt sich nicht neu starten. Damit ist die Versorgung im Ortsteil Bettenhausen nur noch über die Notversorgung gesichert.

Wir benötigen HEUTE noch einen Techniker vor Ort. Laut Vertrag gilt eine Reaktionszeit von 4 Stunden – ich erwarte, dass diese eingehalten wird.

Bitte bestätigen Sie mir umgehend, wann jemand bei uns ist.

Mit freundlichen Grüßen
Dr. Michael Brandt
Leiter Netzbetrieb
Stadtwerke Kassel AG
Tel. 0561 782-4410 | Mobil 0171 4459 812`,
  },
  {
    id: "info-02",
    set: "info",
    minutesAgo: 80,
    from: { name: "Sandra Hoffmann", email: "einkauf@hoffmann-verpackung.de" },
    subject: "Bestellung PO-2026-8841 – 20 Ersatzfilter FX-200",
    text: `Guten Morgen,

hiermit bestellen wir verbindlich:

- 20 × Ersatzfilter FX-200 (Art.-Nr. 40-2200) zu je 89,50 € netto
- 2 × Dichtungssatz DS-14 (Art.-Nr. 40-1414) zu je 34,00 € netto

Bestellnummer: PO-2026-8841
Gewünschter Liefertermin: spätestens 27.11.2026
Lieferadresse: Hoffmann Verpackung GmbH, Werk 2, Industriestraße 14, 34123 Kassel

Bitte senden Sie uns eine Auftragsbestätigung.

Freundliche Grüße
Sandra Hoffmann
Einkauf
Hoffmann Verpackung GmbH`,
    attachments: [{ filename: "Bestellung_PO-2026-8841.pdf", mimeType: PDF, size: 84_211 }],
  },
  {
    id: "info-03",
    set: "info",
    minutesAgo: 125,
    from: { name: "Thomas Schmitt", email: "t.schmitt@baeckerei-schmitt.de" },
    subject: "Anfrage Wartungsvertrag für drei Filialen",
    text: `Hallo zusammen,

wir betreiben drei Filialen (Kassel-Mitte, Vellmar, Baunatal) mit jeweils einer Kälteanlage, die bisher von verschiedenen Firmen gewartet werden. Wir würden das gerne bündeln.

Könnten Sie uns ein Angebot für einen jährlichen Wartungsvertrag inkl. 24h-Notdienst machen? Eine Rückmeldung bis Ende nächster Woche wäre super, da unser aktueller Vertrag zum Jahresende ausläuft.

Gerne können wir dafür auch einen Vor-Ort-Termin vereinbaren.

Viele Grüße
Thomas Schmitt
Bäckerei Schmitt GmbH & Co. KG
Tel. 0561 99 31 20`,
  },
  // Thread A: Logistik Weber – Rückfragen zum Angebot
  {
    id: "info-04a",
    set: "info",
    minutesAgo: 2 * DAY + 260,
    isRead: true,
    from: { name: "Katrin Weber", email: "k.weber@logistik-weber.de" },
    subject: "Angebot A-2026-117 – Rückfragen",
    text: `Sehr geehrter Herr Becker,

vielen Dank für Ihr Angebot A-2026-117 über die Modernisierung unserer Förderanlage (Gesamtsumme 148.600 € netto).

Wir hätten noch zwei Fragen:
1. Ist die Demontage der Altanlage im Preis enthalten?
2. Können Sie die Umsetzung in den Betriebsferien (22.12.–06.01.) garantieren?

Mit freundlichen Grüßen
Katrin Weber
Geschäftsführerin
Logistik Weber GmbH`,
  },
  {
    id: "info-04b",
    set: "info",
    minutesAgo: DAY + 90,
    inReplyTo: "info-04a",
    from: { name: "Katrin Weber", email: "k.weber@logistik-weber.de" },
    subject: "AW: Angebot A-2026-117 – Rückfragen",
    text: `Sehr geehrter Herr Becker,

haben Sie meine Nachricht von vorgestern erhalten? Ich habe leider noch keine Rückmeldung.

Mit freundlichen Grüßen
Katrin Weber`,
  },
  {
    id: "info-04c",
    set: "info",
    minutesAgo: 200,
    inReplyTo: "info-04b",
    from: { name: "Katrin Weber", email: "k.weber@logistik-weber.de" },
    cc: [{ name: "Frank Weber", email: "f.weber@logistik-weber.de" }],
    subject: "AW: AW: Angebot A-2026-117 – Rückfragen",
    text: `Herr Becker,

ich muss leider nochmals nachhaken. Unser Beirat entscheidet am Donnerstag über die Investition. Ohne Antwort auf meine beiden Fragen können wir Ihr Angebot nicht berücksichtigen – ein Wettbewerber hat uns bereits alle Details geliefert.

Bitte melden Sie sich bis spätestens Mittwoch, 12 Uhr.

Katrin Weber`,
  },
  {
    id: "info-05",
    set: "info",
    minutesAgo: 260,
    from: { name: "Markus Neumann", email: "m.neumann@neumann-metallbau.de" },
    subject: "Reklamation: Lieferung beschädigt angekommen (Lieferschein LS-77310)",
    text: `Guten Tag,

die gestrige Lieferung (Lieferschein LS-77310) ist beschädigt bei uns angekommen. Das Gehäuse der Steuereinheit SE-40 ist eingedrückt, ein Display gebrochen. Fotos anbei.

Wir haben die Annahme unter Vorbehalt quittiert. Bitte schicken Sie uns kurzfristig Ersatz – wir brauchen die Einheit für die Inbetriebnahme beim Kunden am 25.11.

Das ist jetzt schon die zweite beschädigte Lieferung in diesem Jahr. Bitte prüfen Sie Ihre Verpackung.

Gruß
Markus Neumann
Neumann Metallbau e.K.
Tel. 05661 3388-0`,
    attachments: [
      { filename: "Schaden_1.jpg", mimeType: JPG, size: 1_840_330 },
      { filename: "Schaden_2.jpg", mimeType: JPG, size: 2_011_874 },
      { filename: "Lieferschein_LS-77310.pdf", mimeType: PDF, size: 61_002 },
    ],
  },
  {
    id: "info-06",
    set: "info",
    minutesAgo: 400,
    from: { name: "Julia Krämer", email: "technik@hotel-am-park-kassel.de" },
    subject: "Frage zu Fehlercode E-214 an der Lüftungsanlage",
    text: `Hallo,

unsere Lüftungsanlage (Modell VL-800, Seriennummer VL8-2291) zeigt seit gestern Abend sporadisch den Fehlercode E-214 an. Die Anlage läuft aber weiter.

In der Bedienungsanleitung finde ich dazu nichts. Müssen wir etwas unternehmen oder kann das bis zur regulären Wartung im Januar warten?

Danke und viele Grüße
Julia Krämer
Haustechnik, Hotel am Park`,
  },
  {
    id: "info-07",
    set: "info",
    minutesAgo: DAY + 160,
    isRead: true,
    from: { name: "Andreas Vogel", email: "a.vogel@klinikum-nordstadt.de" },
    subject: "Dankeschön für den schnellen Einsatz",
    text: `Liebes Team von Müller & Partner,

ich möchte mich ausdrücklich für den schnellen Einsatz am Wochenende bedanken. Ihr Techniker, Herr Wagner, war innerhalb von zwei Stunden vor Ort und hat die Kälteversorgung der OP-Säle souverän wiederhergestellt.

So stellen wir uns Partnerschaft vor. Bitte richten Sie Herrn Wagner meinen Dank aus!

Herzliche Grüße
Andreas Vogel
Technische Leitung
Klinikum Nordstadt`,
  },
  {
    id: "info-08",
    set: "info",
    minutesAgo: 300,
    from: { name: "Kevin Bauer", email: "kevin.bauer93@mailbox.org" },
    subject: "Initiativbewerbung als Servicetechniker (Mechatroniker)",
    text: `Sehr geehrte Damen und Herren,

über die Empfehlung eines Bekannten bin ich auf Ihr Unternehmen aufmerksam geworden und bewerbe mich initiativ als Servicetechniker.

Ich bin ausgebildeter Mechatroniker mit 6 Jahren Berufserfahrung im Kundendienst für Kälte- und Klimatechnik, besitze die Kältescheine Kat. I und den Führerschein Klasse B. Ein Wechsel wäre zum 01.02.2027 möglich.

Meinen Lebenslauf und meine Zeugnisse finden Sie im Anhang. Über eine Einladung zu einem persönlichen Gespräch freue ich mich sehr.

Mit freundlichen Grüßen
Kevin Bauer
Tel. 0176 2234 5590`,
    attachments: [
      { filename: "Lebenslauf_Kevin_Bauer.pdf", mimeType: PDF, size: 312_400 },
      { filename: "Zeugnisse_Kevin_Bauer.pdf", mimeType: PDF, size: 1_204_880 },
    ],
  },
  {
    id: "info-09",
    set: "info",
    minutesAgo: DAY + 300,
    from: { name: "Laura Fischer", email: "laura.fischer@posteo.de" },
    subject: "Bewerbung als Kauffrau für Büromanagement (Ref. 2026-14)",
    text: `Sehr geehrte Frau Müller,

mit großem Interesse habe ich Ihre Stellenanzeige (Referenz 2026-14) gelesen und bewerbe mich hiermit als Kauffrau für Büromanagement in Vollzeit.

Derzeit bin ich bei einem Handwerksbetrieb in Fulda für Auftragsabwicklung und Rechnungsstellung zuständig. Ich arbeite sicher mit DATEV und MS Office. Meine Kündigungsfrist beträgt einen Monat zum Monatsende.

Mit freundlichen Grüßen
Laura Fischer`,
    attachments: [{ filename: "Bewerbung_Laura_Fischer.pdf", mimeType: PDF, size: 845_002 }],
  },
  {
    id: "info-10",
    set: "info",
    minutesAgo: 2 * DAY + 600,
    isRead: true,
    from: { name: "Simon Lehmann", email: "simon.lehmann@web.de" },
    subject: "Nachfrage zum Stand meiner Bewerbung",
    text: `Guten Tag,

vor drei Wochen habe ich mich als Projektingenieur beworben (Ref. 2026-11). Können Sie mir einen Zwischenstand zum Bewerbungsprozess geben?

Vielen Dank und freundliche Grüße
Simon Lehmann`,
  },
  {
    id: "info-11",
    set: "info",
    minutesAgo: 500,
    from: { name: "Petra Lang", email: "vertrieb@rhein-komponenten.de" },
    subject: "Lieferverzögerung Auftrag AB-55721 – neuer Termin KW 50",
    text: `Sehr geehrte Damen und Herren,

leider müssen wir Ihnen mitteilen, dass sich die Lieferung zu Ihrem Auftrag AB-55721 (40 × Frequenzumrichter FU-7,5kW) aufgrund eines Engpasses bei Halbleitern von KW 48 auf KW 50 verschiebt.

Eine Teillieferung von 15 Stück wäre bereits in KW 48 möglich. Bitte teilen Sie uns bis Freitag mit, ob Sie diese wünschen.

Wir bitten um Ihr Verständnis.

Mit freundlichen Grüßen
Petra Lang
Rhein-Komponenten GmbH, Innendienst
Tel. 0221 4470-212`,
  },
  {
    id: "info-12",
    set: "info",
    minutesAgo: DAY + 520,
    from: { name: "Rhein-Komponenten GmbH", email: "info@rhein-komponenten.de" },
    subject: "Preisanpassung zum 01.01.2027",
    text: `Sehr geehrte Kundin, sehr geehrter Kunde,

aufgrund gestiegener Material- und Energiekosten passen wir unsere Listenpreise zum 01.01.2027 um durchschnittlich 6,5 % an. Bis zum 31.12.2026 eingehende Bestellungen werden noch zu den aktuellen Konditionen abgerechnet.

Die neue Preisliste finden Sie im Anhang.

Mit freundlichen Grüßen
Ihr Team der Rhein-Komponenten GmbH`,
    attachments: [{ filename: "Preisliste_2027.pdf", mimeType: PDF, size: 520_330 }],
  },
  {
    id: "info-13",
    set: "info",
    minutesAgo: 2 * DAY + 100,
    isRead: true,
    from: { name: "Auftragsbearbeitung Kältetechnik Nord", email: "auftrag@kaeltetechnik-nord.de" },
    subject: "Auftragsbestätigung AB-2026-3391",
    text: `Sehr geehrte Damen und Herren,

vielen Dank für Ihren Auftrag. Anbei erhalten Sie die Auftragsbestätigung AB-2026-3391 über 6 × Verdichter KV-12 zum Gesamtpreis von 9.870,00 € netto. Liefertermin: 04.12.2026.

Mit freundlichen Grüßen
Kältetechnik Nord GmbH`,
    attachments: [{ filename: "AB-2026-3391.pdf", mimeType: PDF, size: 98_120 }],
  },
  {
    id: "info-14",
    set: "info",
    minutesAgo: 150,
    from: { name: "Jonas Becker", email: "manager@mueller-partner.de" },
    subject: "Teammeeting Donnerstag verschoben auf 14 Uhr",
    text: `Hallo zusammen,

das Teammeeting am Donnerstag verschiebt sich von 10 auf 14 Uhr (gleicher Raum). Bitte bringt eure Zahlen zur Auslastung im Dezember mit.

Danke & Gruß
Jonas`,
  },
  {
    id: "info-15",
    set: "info",
    minutesAgo: DAY + 10,
    from: { name: "Personalabteilung", email: "personal@mueller-partner.de" },
    subject: "Urlaubsplanung Weihnachten – Anträge bis 30.11.",
    text: `Liebe Kolleginnen und Kollegen,

bitte tragt eure Urlaubswünsche für den Zeitraum 21.12.2026 bis 06.01.2027 bis spätestens 30.11. im Personalportal ein. Für den Notdienst brauchen wir pro Woche mindestens zwei Techniker.

Viele Grüße
Eure Personalabteilung`,
  },
  {
    id: "info-16",
    set: "info",
    minutesAgo: DAY + 800,
    isRead: true,
    from: { name: "IT-Service", email: "it@mueller-partner.de" },
    subject: "Wartungsfenster Samstag 22:00–02:00 Uhr",
    text: `Hallo zusammen,

am Samstag führen wir zwischen 22:00 und 02:00 Uhr Updates an Server und Firewall durch. In dieser Zeit sind ERP, Dateiserver und VPN nicht erreichbar. Der Notdienst ist über die Mobiltelefone weiterhin erreichbar.

Euer IT-Service`,
  },
  {
    id: "info-17",
    set: "info",
    minutesAgo: 2 * DAY + 400,
    from: { name: "Anna Müller", email: "admin@mueller-partner.de" },
    subject: "Q3-Zahlen – bitte Feedback bis Freitag",
    text: `Hallo Jonas, hallo Lea,

anbei die Präsentation mit den Q3-Zahlen für die Gesellschafterversammlung. Bitte schaut euch insbesondere die Folien 7–9 (Servicegeschäft) an und gebt mir bis Freitag Feedback.

Danke!
Anna`,
    attachments: [{ filename: "Q3_2026_Gesellschafter.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 4_200_118 }],
  },
  {
    id: "info-18",
    set: "info",
    minutesAgo: 600,
    from: { name: "Industrie 4.0 Insights", email: "newsletter@industrie40-insights.de" },
    subject: "Industrie 4.0 Insights – Ausgabe November",
    text: `Die Themen dieser Ausgabe:

▸ KI in der Instandhaltung: Wo sie heute schon wirkt
▸ Fachkräftemangel: 5 Strategien für Servicebetriebe
▸ Neue EU-Maschinenverordnung – was ab 2027 gilt

Jetzt lesen auf industrie40-insights.de

Sie erhalten diesen Newsletter, weil Sie sich angemeldet haben. Abmelden`,
  },
  {
    id: "info-19",
    set: "info",
    minutesAgo: DAY + 400,
    from: { name: "IndustrieTage 2027", email: "tickets@industrietage-messe.de" },
    subject: "Nur noch 3 Tage: 30 % Frühbucherrabatt für die IndustrieTage 2027",
    text: `Sichern Sie sich jetzt Ihr Ausstellerpaket für die IndustrieTage 2027 in Hannover (16.–18. März) mit 30 % Frühbucherrabatt.

Das Angebot gilt nur noch bis Freitag!

Jetzt buchen →

Abmelden | Impressum`,
  },
  {
    id: "info-20",
    set: "info",
    minutesAgo: 3 * DAY + 200,
    from: { name: "Akademie Technik & Wartung", email: "events@akademie-tw.de" },
    subject: "Einladung zum Webinar: Predictive Maintenance in der Praxis",
    text: `Kostenloses Webinar am 02.12.2026, 10:00–11:00 Uhr

Erfahren Sie, wie mittelständische Servicebetriebe mit Sensordaten Ausfälle vorhersagen und Einsätze planen.

Jetzt kostenlos anmelden.

Sie möchten keine Einladungen mehr erhalten? Hier abmelden.`,
  },
  {
    id: "info-21",
    set: "info",
    minutesAgo: 4 * DAY + 100,
    isRead: true,
    from: { name: "Technik-Heute Branchenportal", email: "digest@technik-heute.de" },
    subject: "Ihre Wochenübersicht: 12 neue Ausschreibungen in Ihrer Region",
    text: `Hallo Müller & Partner GmbH,

diese Woche gibt es 12 neue Ausschreibungen im Bereich Gebäude- und Anlagentechnik in Nordhessen.

Alle Ausschreibungen ansehen →

Benachrichtigungseinstellungen ändern`,
  },
  {
    id: "info-22",
    set: "info",
    minutesAgo: 700,
    from: { name: "Gewinnspiel-Team", email: "gewinner@super-preise-24.xyz" },
    subject: "Herzlichen Glückwunsch!!! Sie haben ein iPhone 17 Pro gewonnen",
    text: `Sie wurden als Gewinner ausgewählt!!!

Um Ihren Preis zu erhalten, bestätigen Sie jetzt Ihre Daten und zahlen Sie nur 1,95 € Versandkosten.

>>> JETZT GEWINN SICHERN <<<

Angebot nur heute gültig.`,
  },
  {
    id: "info-23",
    set: "info",
    minutesAgo: DAY + 1000,
    from: { name: "Kundenservice Ihre Bank", email: "sicherheit@konto-verifizierung-online.top" },
    subject: "Ihr Konto wurde vorübergehend gesperrt",
    text: `Sehr geehrter Kunde,

aufgrund ungewöhnlicher Aktivitäten wurde Ihr Online-Banking vorübergehend gesperrt. Bitte bestätigen Sie innerhalb von 24 Stunden Ihre Identität, sonst wird Ihr Konto dauerhaft deaktiviert:

http://konto-verifizierung-online.top/login

Ihr Sicherheitsteam`,
  },
  {
    id: "info-24",
    set: "info",
    minutesAgo: 3 * DAY + 900,
    from: { name: "Max SEO-Experte", email: "max@rank-booster-agentur.net" },
    subject: "Platz 1 bei Google – garantiert in 30 Tagen",
    text: `Hallo,

ich habe Ihre Website analysiert und 27 kritische Fehler gefunden. Mit unserem Premium-Paket bringen wir Sie garantiert auf Platz 1 bei Google.

Antworten Sie einfach mit "JA" für eine kostenlose Analyse.

Max`,
  },
  {
    id: "info-25",
    set: "info",
    minutesAgo: 900,
    from: { name: "Andreas Vogel", email: "a.vogel@klinikum-nordstadt.de" },
    subject: "Terminbestätigung Jahreswartung 03.12. um 9 Uhr",
    text: `Hallo Frau Schneider,

für die Jahreswartung der Kälteanlagen schlagen wir Donnerstag, den 03.12.2026, ab 9:00 Uhr vor. Bitte bestätigen Sie den Termin bis Ende der Woche, damit wir die OP-Planung anpassen können.

Ansprechpartner vor Ort ist Herr Kessler (Tel. 0561 980-3301).

Viele Grüße
Andreas Vogel`,
  },
  {
    id: "info-26",
    set: "info",
    minutesAgo: DAY + 200,
    from: { name: "Bernd Hartmann", email: "b.hartmann@hartmann-logistik.de" },
    subject: "Wir prüfen die Kündigung unseres Wartungsvertrags",
    text: `Sehr geehrte Damen und Herren,

zum dritten Mal in diesem Quartal wurde ein vereinbarter Wartungstermin kurzfristig abgesagt – zuletzt am Montag ohne jede Vorankündigung. Unsere Mitarbeiter standen umsonst bereit.

Ich erwarte bis Ende der Woche ein Gespräch mit der Geschäftsführung. Andernfalls werden wir den Wartungsvertrag WV-2023-044 fristgerecht zum 31.12. kündigen.

Bernd Hartmann
Geschäftsführer, Hartmann Logistik GmbH`,
  },
  // Thread B: Ersatzteil-Anfrage Pumpe
  {
    id: "info-27a",
    set: "info",
    minutesAgo: 3 * DAY + 400,
    isRead: true,
    from: { name: "Ralf Ziegler", email: "r.ziegler@ziegler-lebensmittel.de" },
    subject: "Ersatzteil-Anfrage Pumpe P-300",
    text: `Hallo,

wir benötigen für unsere Pumpe P-300 (Baujahr 2019) eine neue Gleitringdichtung sowie ein Laufrad. Können Sie uns ein Angebot inkl. Einbau schicken?

Gruß
Ralf Ziegler
Ziegler Lebensmittel GmbH`,
  },
  {
    id: "info-27b",
    set: "info",
    minutesAgo: DAY + 600,
    inReplyTo: "info-27a",
    from: { name: "Ralf Ziegler", email: "r.ziegler@ziegler-lebensmittel.de" },
    subject: "AW: Ersatzteil-Anfrage Pumpe P-300",
    text: `Hallo Herr Wagner,

danke für das schnelle Angebot (AN-2026-902, 1.240 € netto inkl. Einbau). Passt für uns – wir bestellen hiermit zwei Sätze, einen davon als Reserve. Einbau gerne in KW 49, am besten dienstags.

Beste Grüße
Ralf Ziegler`,
  },
  {
    id: "info-28",
    set: "info",
    minutesAgo: 4 * DAY + 300,
    from: { name: "Monika Roth", email: "m.roth@roth-galvanik.de" },
    subject: "Schulung für 8 Mitarbeiter im Januar?",
    text: `Guten Tag,

wir möchten 8 Mitarbeiter aus der Instandhaltung in der Bedienung und Grundwartung unserer neuen Absauganlage schulen lassen. Wäre eine eintägige Schulung bei uns vor Ort im Januar möglich? Bitte nennen Sie uns mögliche Termine und die Kosten.

Freundliche Grüße
Monika Roth`,
  },
  {
    id: "info-29",
    set: "info",
    minutesAgo: 5 * DAY + 100,
    isRead: true,
    from: { name: "Christian Engel", email: "c.engel@engel-immobilien.de" },
    subject: "Dürfen wir Sie als Referenz nennen?",
    text: `Hallo Frau Müller,

wir sind mit der Sanierung der Haustechnik in unserem Objekt Wilhelmshöher Allee sehr zufrieden. Wir würden Ihr Unternehmen gerne in unserer Broschüre als Partner und Referenz nennen. Wären Sie damit einverstanden?

Herzliche Grüße
Christian Engel`,
  },
  {
    id: "info-30",
    set: "info",
    minutesAgo: 6 * DAY + 300,
    from: { name: "Gerd Albrecht", email: "service@albrecht-druck.de" },
    subject: "Garantieanfrage Steuerung SN-4471-22",
    text: `Sehr geehrte Damen und Herren,

die Steuerung mit der Seriennummer SN-4471-22 (gekauft am 14.03.2025, Rechnung AR-2025-0312) startet nicht mehr. Wir gehen von einem Garantiefall aus. Wie ist das weitere Vorgehen? Sollen wir das Gerät einschicken?

Mit freundlichen Grüßen
Gerd Albrecht
Albrecht Druck GmbH`,
  },
  {
    id: "info-31",
    set: "info",
    minutesAgo: 20,
    from: { name: "Sandra Hoffmann", email: "einkauf@hoffmann-verpackung.de" },
    subject: "Änderung Lieferadresse zu PO-2026-8841",
    text: `Hallo nochmal,

kleine Korrektur zu unserer Bestellung PO-2026-8841 von heute Morgen: Bitte liefern Sie an Werk 1 (Am Hafen 3, 34125 Kassel) statt Werk 2. Ansprechpartner dort ist Herr Ludwig, Tel. 0561 470 88-15.

Danke!
Sandra Hoffmann`,
  },
  {
    id: "info-32",
    set: "info",
    minutesAgo: 10,
    from: { name: "Tobias Wagner", email: "t.wagner@mueller-partner.de" },
    subject: "Servicebericht Stadtwerke Kassel – Anlage 3",
    text: `Hi Lea,

ich fahre jetzt direkt zu den Stadtwerken (Anlage 3, Fehler E-501). Laut Ferndiagnose ist vermutlich das Netzteil der Steuerung defekt – ich nehme ein Ersatzteil aus dem Lager mit. Ankunft ca. 11:30 Uhr.

Kannst du Herrn Dr. Brandt bitte kurz Bescheid geben?

Gruß Tobias`,
  },
  {
    id: "info-33",
    set: "info",
    minutesAgo: 7 * DAY + 60,
    from: { name: "Vertragsmanagement Kältetechnik Nord", email: "vertrag@kaeltetechnik-nord.de" },
    subject: "Rahmenvertrag 2027 zur Unterschrift – Rücksendung bis 15.12.",
    text: `Sehr geehrte Frau Müller,

anbei erhalten Sie den Rahmenvertrag für 2027 mit den vereinbarten Konditionen (3 % Rabatt auf Listenpreise, Zahlungsziel 30 Tage). Bitte senden Sie uns ein unterschriebenes Exemplar bis zum 15.12.2026 zurück.

Mit freundlichen Grüßen
Kältetechnik Nord GmbH`,
    attachments: [{ filename: "Rahmenvertrag_2027.pdf", mimeType: PDF, size: 233_901 }],
  },
  {
    id: "info-34",
    set: "info",
    minutesAgo: 8 * DAY + 200,
    from: { name: "Nina Schäfer", email: "n.schaefer@phoenix-energie.de" },
    subject: "Projekt Phoenix – Terminvorschläge für das Kick-off",
    text: `Hallo Herr Becker,

für das Kick-off von Projekt Phoenix schlagen wir folgende Termine vor:
- Mo, 30.11., 10:00 Uhr
- Mi, 02.12., 14:00 Uhr
- Fr, 04.12., 09:00 Uhr

Teilnehmer bei uns: Projektleitung, Einkauf, Standortleitung. Bitte geben Sie uns kurz Bescheid, welcher Termin passt.

Viele Grüße
Nina Schäfer`,
  },
  // Älter als 30 Tage – werden beim ersten Abruf (Standard: 30 Tage) übersprungen.
  {
    id: "info-35",
    set: "info",
    minutesAgo: 40 * DAY,
    isRead: true,
    from: { name: "Uwe Peters", email: "u.peters@peters-bau.de" },
    subject: "Anfrage Klimatisierung Büroneubau",
    text: "Guten Tag, für unseren Büroneubau suchen wir einen Partner für die Klimatisierung. Wären Sie interessiert? Gruß, Uwe Peters",
  },
  {
    id: "info-36",
    set: "info",
    minutesAgo: 55 * DAY,
    isRead: true,
    from: { name: "Industrie 4.0 Insights", email: "newsletter@industrie40-insights.de" },
    subject: "Industrie 4.0 Insights – Ausgabe September",
    text: "Die Themen dieser Ausgabe: Energieeffizienz, Wärmepumpen in der Industrie. Abmelden",
  },
  {
    id: "info-37",
    set: "info",
    minutesAgo: 70 * DAY,
    isRead: true,
    from: { name: "Petra Lang", email: "vertrieb@rhein-komponenten.de" },
    subject: "Ihre Anfrage zu Frequenzumrichtern",
    text: "Sehr geehrte Damen und Herren, anbei unser Angebot zu Ihrer Anfrage. Mit freundlichen Grüßen, Petra Lang",
  },
  // Treffen erst nach dem Anlegen ein (automatischer Abruf).
  {
    id: "info-38",
    set: "info",
    minutesAgo: -10,
    inReplyTo: "info-01",
    from: { name: "Dr. Michael Brandt", email: "m.brandt@stadtwerke-kassel.de" },
    subject: "AW: DRINGEND: Anlage 3 ausgefallen – Produktionsstillstand",
    text: `Ich habe noch immer keine Bestätigung erhalten. Ich erwarte innerhalb der nächsten 30 Minuten einen Rückruf unter 0171 4459 812 – andernfalls schalte ich unsere Rechtsabteilung ein.

Dr. Michael Brandt`,
  },
  {
    id: "info-39",
    set: "info",
    minutesAgo: -25,
    from: { name: "Industrie 4.0 Insights", email: "newsletter@industrie40-insights.de" },
    subject: "Sonderausgabe: Die 10 wichtigsten Trends für 2027",
    text: "Unsere Redaktion hat die wichtigsten Trends für das kommende Jahr zusammengestellt. Jetzt lesen. Abmelden",
  },
  {
    id: "info-40",
    set: "info",
    minutesAgo: -45,
    from: { name: "Mira Yilmaz", email: "mira.yilmaz@gmx.de" },
    subject: "Bewerbung um einen Ausbildungsplatz als Mechatronikerin 2027",
    text: `Sehr geehrte Damen und Herren,

ich mache im Sommer 2027 mein Fachabitur und bewerbe mich um einen Ausbildungsplatz als Mechatronikerin. Ein Praktikum in Ihrem Betrieb hat mir 2025 großen Spaß gemacht.

Meine Unterlagen finden Sie im Anhang.

Mit freundlichen Grüßen
Mira Yilmaz`,
    attachments: [{ filename: "Bewerbung_Mira_Yilmaz.pdf", mimeType: PDF, size: 640_220 }],
  },
  {
    id: "info-41",
    set: "info",
    minutesAgo: -90,
    inReplyTo: "info-03",
    from: { name: "Thomas Schmitt", email: "t.schmitt@baeckerei-schmitt.de" },
    subject: "AW: Anfrage Wartungsvertrag für drei Filialen",
    text: `Hallo nochmal,

kurze Ergänzung: Eine vierte Filiale in Fuldabrück kommt im Februar dazu – bitte im Angebot gleich mit berücksichtigen. Ein Vor-Ort-Termin wäre am 26.11. nachmittags möglich.

Viele Grüße
Thomas Schmitt`,
  },

  // ---------------------------------------------------------------------------
  // Postfach „Buchhaltung“ – Müller & Partner GmbH
  // ---------------------------------------------------------------------------
  {
    id: "bh-01",
    set: "buchhaltung",
    minutesAgo: 90,
    from: { name: "Rhein-Komponenten Buchhaltung", email: "rechnung@rhein-komponenten.de" },
    subject: "Rechnung RE-2026-10433",
    text: `Sehr geehrte Damen und Herren,

anbei erhalten Sie unsere Rechnung RE-2026-10433 vom 16.11.2026 über 4.812,50 € (inkl. 19 % MwSt.) zu Auftrag AB-55410.

Zahlbar bis 01.12.2026 ohne Abzug.
Bankverbindung: Sparkasse KölnBonn, IBAN DE89 3704 0044 0532 0130 00, BIC COLSDE33

Mit freundlichen Grüßen
Rhein-Komponenten GmbH – Buchhaltung`,
    attachments: [{ filename: "RE-2026-10433.pdf", mimeType: PDF, size: 112_004 }],
  },
  {
    id: "bh-02",
    set: "buchhaltung",
    minutesAgo: 300,
    from: { name: "Bürobedarf Schneider", email: "mahnwesen@buero-schneider.de" },
    subject: "2. Mahnung – Rechnung 88213",
    text: `Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung vom 02.11. ist die Rechnung 88213 vom 05.10.2026 über 236,90 € weiterhin offen. Wir berechnen eine Mahngebühr von 5,00 €.

Bitte überweisen Sie den Gesamtbetrag von 241,90 € bis spätestens 24.11.2026 auf IBAN DE12 5205 0353 0000 4471 22. Andernfalls müssen wir die Forderung an ein Inkassobüro übergeben.

Mit freundlichen Grüßen
Bürobedarf Schneider OHG`,
    attachments: [{ filename: "Mahnung_88213.pdf", mimeType: PDF, size: 45_600 }],
  },
  {
    id: "bh-03",
    set: "buchhaltung",
    minutesAgo: DAY + 100,
    isRead: true,
    from: { name: "Stadtwerke Kassel Kreditoren", email: "kreditoren@stadtwerke-kassel.de" },
    subject: "Zahlungsavis zu Ihrer Rechnung AR-2026-0091",
    text: `Sehr geehrte Damen und Herren,

wir haben heute Ihre Rechnung AR-2026-0091 über 12.400,00 € zur Zahlung angewiesen. Wertstellung voraussichtlich am 19.11.2026.

Mit freundlichen Grüßen
Stadtwerke Kassel AG – Kreditorenbuchhaltung`,
  },
  {
    id: "bh-04",
    set: "buchhaltung",
    minutesAgo: DAY + 700,
    from: { name: "Thomas Schmitt", email: "t.schmitt@baeckerei-schmitt.de" },
    subject: "Rechnung AR-2026-0102 doppelt berechnet?",
    text: `Hallo,

in Ihrer Rechnung AR-2026-0102 über 1.785,00 € ist die Anfahrtspauschale (89,00 €) zweimal aufgeführt. Können Sie das bitte prüfen und uns eine korrigierte Rechnung schicken? Bis dahin halten wir die Zahlung zurück.

Danke und Gruß
Thomas Schmitt`,
  },
  {
    id: "bh-05",
    set: "buchhaltung",
    minutesAgo: 2 * DAY + 200,
    from: { name: "Kanzlei Dr. Seidel & Partner", email: "fibu@kanzlei-seidel.de" },
    subject: "Unterlagen für die Umsatzsteuer-Voranmeldung Oktober",
    text: `Sehr geehrte Frau Müller,

für die Umsatzsteuer-Voranmeldung Oktober fehlen uns noch die Eingangsrechnungen ab dem 20.10. sowie die Kontoauszüge der Volksbank. Bitte laden Sie die Unterlagen bis spätestens 10.12.2026 in das Mandantenportal hoch.

Bei Rückfragen erreichen Sie mich unter 0561 7766-20.

Mit freundlichen Grüßen
Sabine Kurz
Steuerfachangestellte, Kanzlei Dr. Seidel & Partner`,
  },
  {
    id: "bh-06",
    set: "buchhaltung",
    minutesAgo: 3 * DAY + 100,
    isRead: true,
    from: { name: "NetzWelt Mobil", email: "rechnung@netzwelt-mobil.de" },
    subject: "Ihre Mobilfunkrechnung November 2026",
    text: `Guten Tag,

Ihre Rechnung für November 2026 ist da: 412,35 € für 9 Verträge. Der Betrag wird am 25.11.2026 per Lastschrift eingezogen.

Ihre Rechnung finden Sie im Kundenportal.

Ihr NetzWelt-Mobil-Team`,
  },
  {
    id: "bh-07",
    set: "buchhaltung",
    minutesAgo: 4 * DAY + 50,
    isRead: true,
    from: { name: "Kältetechnik Nord Buchhaltung", email: "buchhaltung@kaeltetechnik-nord.de" },
    subject: "Gutschrift GS-7712",
    text: `Sehr geehrte Damen und Herren,

für die Rücksendung von 2 Verdichtern KV-12 erhalten Sie anbei die Gutschrift GS-7712 über 312,00 €. Der Betrag wird mit der nächsten Rechnung verrechnet.

Mit freundlichen Grüßen
Kältetechnik Nord GmbH`,
    attachments: [{ filename: "GS-7712.pdf", mimeType: PDF, size: 38_220 }],
  },
  {
    id: "bh-08",
    set: "buchhaltung",
    minutesAgo: 5 * DAY + 60,
    isRead: true,
    from: { name: "CloudOffice Business", email: "billing@cloudoffice-business.de" },
    subject: "Rechnung CO-2026-118842 – Jahreslizenz",
    text: `Vielen Dank für Ihre Verlängerung!

Rechnungsnummer: CO-2026-118842
Leistung: CloudOffice Business, 15 Nutzer, 12 Monate
Betrag: 1.188,00 € (inkl. MwSt.)
Zahlung: per Kreditkarte bereits erfolgt

Ihr CloudOffice-Team`,
    attachments: [{ filename: "CO-2026-118842.pdf", mimeType: PDF, size: 67_100 }],
  },
  {
    id: "bh-09",
    set: "buchhaltung",
    minutesAgo: 6 * DAY + 30,
    isRead: true,
    from: { name: "Volksbank Kassel Göttingen", email: "noreply@vb-kassel-goettingen.de" },
    subject: "Neuer Kontoauszug im Online-Banking verfügbar",
    text: "Guten Tag, in Ihrem Online-Banking steht ein neuer Kontoauszug für Sie bereit. Dies ist eine automatisch generierte Nachricht.",
  },
  {
    id: "bh-10",
    set: "buchhaltung",
    minutesAgo: 1000,
    from: { name: "Inkasso Zentrale", email: "forderung@inkasso-zentrale-de.info" },
    subject: "Letzte Aufforderung: Offene Forderung 1.877,40 €",
    text: `Sehr geehrte Damen und Herren,

wir wurden mit dem Einzug einer offenen Forderung beauftragt. Öffnen Sie die angehängte Datei, um die Details einzusehen und die Pfändung abzuwenden.

Zahlung innerhalb von 48 Stunden erforderlich.`,
    attachments: [{ filename: "Forderung_Details.zip", mimeType: "application/zip", size: 24_120 }],
  },
  {
    id: "bh-11",
    set: "buchhaltung",
    minutesAgo: -30,
    inReplyTo: "bh-04",
    from: { name: "Thomas Schmitt", email: "t.schmitt@baeckerei-schmitt.de" },
    subject: "AW: Rechnung AR-2026-0102 doppelt berechnet?",
    text: `Hallo,

danke für die schnelle Korrektur – wir haben den korrigierten Betrag von 1.696,00 € heute überwiesen.

Gruß
Thomas Schmitt`,
  },

  // ---------------------------------------------------------------------------
  // Postfach „Disposition“ – Nordlicht Logistik AG (zweiter Mandant)
  // ---------------------------------------------------------------------------
  {
    id: "dispo-01",
    set: "dispo",
    minutesAgo: 45,
    from: { name: "Lars Petersen", email: "l.petersen@nordsee-fisch.de" },
    subject: "Expresstransport Hamburg → München morgen früh",
    text: `Moin,

wir brauchen morgen einen Kühltransport (2 Paletten, +2 °C) von Hamburg-Altona nach München-Großmarkt. Abholung bis 5:00 Uhr, Zustellung spätestens 14:00 Uhr. Bitte kurz bestätigen und Preis nennen.

Lars Petersen
Nordsee Fisch GmbH, Tel. 040 3344 1290`,
  },
  {
    id: "dispo-02",
    set: "dispo",
    minutesAgo: 130,
    from: { name: "Henrik Jansen", email: "admin@nordlicht-logistik.de" },
    subject: "Fahrer Kowalski krank – Tour 14 neu besetzen",
    text: "Hi Dispo, Fahrer Kowalski hat sich für heute und morgen krankgemeldet. Bitte Tour 14 (Bremen–Hannover) neu besetzen. Danke, Henrik",
  },
  {
    id: "dispo-03",
    set: "dispo",
    minutesAgo: DAY + 200,
    from: { name: "Zollagentur Hafen", email: "abfertigung@zollagentur-hafen.de" },
    subject: "Rückfrage Ausfuhranmeldung Sendung NL-88231",
    text: "Sehr geehrte Damen und Herren, für die Sendung NL-88231 fehlt uns noch die Handelsrechnung. Ohne diese können wir die Ausfuhr nicht anmelden. Bitte bis morgen 10 Uhr nachreichen.",
  },
  {
    id: "dispo-04",
    set: "dispo",
    minutesAgo: 2 * DAY,
    from: { name: "LogistikWelt Magazin", email: "news@logistikwelt-magazin.de" },
    subject: "LogistikWelt Wochenrückblick KW 46",
    text: "Die wichtigsten Logistik-News der Woche: Maut-Erhöhung, E-Lkw, Fachkräfte. Abmelden",
  },
  {
    id: "dispo-05",
    set: "dispo",
    minutesAgo: 3 * DAY,
    from: { name: "FuelCard Service", email: "rechnung@fuelcard-service.de" },
    subject: "Tankkarten-Abrechnung Oktober: 18.420,77 €",
    text: "Ihre Tankkarten-Abrechnung für Oktober über 18.420,77 € steht im Portal bereit. Einzug am 28.11.2026.",
  },
];
