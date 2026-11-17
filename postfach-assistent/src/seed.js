// Legt drei erfundene Testfirmen mit Mitarbeitern, Postfächern, Regeln und realistischen E-Mails an.
// Alle Namen, Adressen und Domains sind ausgedacht (.example-Domains sind für Tests reserviert).
import { one, run } from "./db.js";
import { hashPassword } from "./auth.js";
import { ingestEmail, processPending } from "./mail.js";

export const DEMO_PASSWORD = "demo1234";

const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 19);

const COMPANIES = [
  {
    name: "Hausverwaltung Sonnenhof GmbH", slug: "sonnenhof", plan: "start",
    tone: "freundlich, sachlich, Sie-Form, kurze Sätze",
    signature: "Petra Sonnenberg\nHausverwaltung Sonnenhof GmbH\nTel. 089 000000-0",
    knowledge: [
      "Sprechzeiten: Montag bis Donnerstag 9–12 Uhr und 14–16 Uhr, Freitag 9–12 Uhr.",
      "Notdienst bei Wasserschaden, Rohrbruch oder Heizungsausfall: 0800 000 1111 (rund um die Uhr).",
      "Nebenkostenabrechnung: wird jedes Jahr bis spätestens 30. November für das Vorjahr verschickt.",
      "Kaution: Rückzahlung nach Auszug innerhalb von 6 Monaten nach Prüfung der Nebenkosten.",
      "Schlüssel: Ersatzschlüssel kosten 35 Euro und können nach Terminvereinbarung abgeholt werden.",
      "Eigentümerversammlung: findet jährlich im März statt, Einladung kommt 3 Wochen vorher.",
    ].join("\n"),
    departments: ["Verwaltung", "Technik", "Buchhaltung"],
    users: [
      { name: "Petra Sonnenberg", email: "petra@sonnenhof-hv.example", role: "admin", dept: "Verwaltung" },
      { name: "Jonas Keller", email: "jonas@sonnenhof-hv.example", role: "member", dept: "Technik" },
      { name: "Aylin Demir", email: "aylin@sonnenhof-hv.example", role: "member", dept: "Buchhaltung" },
    ],
    rules: [
      { category: "reklamation", dept: "Technik" },
      { category: "rechnung", dept: "Buchhaltung" },
      { keyword: "nebenkosten", dept: "Buchhaltung" },
      { category: "anfrage", dept: "Verwaltung" },
      { category: "termin", dept: "Verwaltung" },
    ],
    mailboxes: [{ name: "Zentrale", address: "info@sonnenhof-hv.example" }],
    emails: [
      { h: 2, from: ["Markus Brandt", "m.brandt@mail.example"], subject: "DRINGEND: Wasserschaden im Bad, Wohnung 3.OG links",
        body: "Hallo Frau Sonnenberg,\n\nseit heute Morgen tropft Wasser von der Decke in unserem Badezimmer. Vermutlich kommt es aus der Wohnung darüber. Bitte schicken Sie umgehend einen Handwerker vorbei, der Schaden wird immer größer.\n\nKönnen Sie mir heute noch Bescheid geben, wann jemand kommt?\n\nMit freundlichen Grüßen\nMarkus Brandt\nLindenstraße 12, 3. OG links" },
      { h: 5, from: ["Sabine Wolf", "sabine.wolf@mail.example"], subject: "Frage zur Nebenkostenabrechnung 2025",
        body: "Guten Tag,\n\nich habe noch keine Nebenkostenabrechnung für 2025 erhalten. Wann wird diese verschickt? Ich ziehe zum Jahresende aus und möchte das gern vorher klären.\n\nViele Grüße\nSabine Wolf" },
      { h: 26, from: ["Herbert Lang", "h.lang@mail.example"], subject: "Heizung ausgefallen – schon wieder!",
        body: "Sehr geehrte Damen und Herren,\n\nzum wiederholten Mal ist in unserem Haus die Heizung ausgefallen. Es ist November und die Wohnung hat nur noch 16 Grad. Das ist unzumutbar! Ich erwarte, dass das Problem bis morgen behoben wird, sonst werde ich die Miete mindern.\n\nHerbert Lang\nAhornweg 4" },
      { h: 30, from: ["Familie Yilmaz", "yilmaz.familie@mail.example"], subject: "Ersatzschlüssel benötigt",
        body: "Hallo,\n\nwir haben einen Wohnungsschlüssel verloren und benötigen einen Ersatzschlüssel. Was kostet das und wann können wir ihn abholen?\n\nDanke und liebe Grüße\nFamilie Yilmaz" },
      { h: 50, from: ["Klara Neumann", "k.neumann@mail.example"], subject: "Besichtigungstermin Wohnung Ahornweg 4, EG",
        body: "Sehr geehrte Frau Sonnenberg,\n\nich interessiere mich für die freie Wohnung im Ahornweg 4. Wäre eine Besichtigung am Donnerstag oder Freitag nachmittag möglich?\n\nMit freundlichen Grüßen\nKlara Neumann" },
      { h: 70, from: ["Stadtwerke Musterstadt", "rechnung@stadtwerke.example"], subject: "Zahlungserinnerung Rechnung 2025-4471",
        body: "Sehr geehrte Damen und Herren,\n\nfür die Rechnung 2025-4471 über 1.284,50 EUR (Allgemeinstrom Lindenstraße 12) konnten wir noch keinen Zahlungseingang feststellen. Bitte überweisen Sie den offenen Betrag bis zum 28.11. auf das bekannte Konto.\n\nMit freundlichen Grüßen\nIhre Stadtwerke" },
      { h: 75, from: ["Thomas Reiter", "t.reiter@mail.example"], subject: "Kaution zurück?",
        body: "Hallo,\n\nich bin vor drei Monaten aus der Wohnung Lindenstraße 12 ausgezogen. Wann bekomme ich meine Kaution zurück? Bitte teilen Sie mir den Stand mit.\n\nGruß\nThomas Reiter" },
      { h: 80, from: ["Immo-Newsletter", "newsletter@immo-news.example"], subject: "Newsletter: Neue Urteile im Mietrecht",
        body: "Unser monatlicher Newsletter mit den wichtigsten Urteilen im Mietrecht. Zum Abmelden klicken Sie auf den Link am Ende dieser Mail." },
      { h: 90, from: ["Gewinnspiel-Team", "winner@lucky-prize.example"], subject: "Sie haben gewonnen!!! 50.000 EUR",
        body: "Herzlichen Glückwunsch! Sie sind der Gewinner unseres Gewinnspiels. Klicken Sie hier und geben Sie Ihre Bankdaten ein, um Ihren Gewinn zu erhalten. 100% gratis!" },
      { h: 100, from: ["Eigentümer Dr. Fischer", "dr.fischer@mail.example"], subject: "Eigentümerversammlung 2026 – Tagesordnung",
        body: "Sehr geehrte Frau Sonnenberg,\n\nkönnten Sie bitte den Punkt 'Erneuerung der Fassade' auf die Tagesordnung der nächsten Eigentümerversammlung setzen? Bitte senden Sie mir außerdem bis Ende des Monats die Kostenschätzung des Malerbetriebs.\n\nMit freundlichen Grüßen\nDr. Robert Fischer" },
      { h: 120, from: ["Sabine Wolf", "sabine.wolf@mail.example"], subject: "Lärmbelästigung durch Nachbarn",
        body: "Guten Tag,\n\nseit Wochen gibt es nachts laute Musik aus der Wohnung 2. OG rechts. Ich bin wirklich verärgert, Gespräche haben nichts gebracht. Bitte kümmern Sie sich darum.\n\nSabine Wolf" },
    ],
    replies: [
      { to: "Familie Yilmaz", h: 28, body: "Guten Tag Familie Yilmaz,\n\nein Ersatzschlüssel kostet 35 Euro. Sie können ihn ab Mittwoch zu unseren Sprechzeiten abholen.\n\nMit freundlichen Grüßen\nPetra Sonnenberg" },
    ],
  },
  {
    name: "Kanzlei Berger & Partner Steuerberatung", slug: "berger", plan: "team",
    tone: "seriös, präzise, Sie-Form, keine Umgangssprache",
    signature: "Dr. Anna Berger\nSteuerberaterin\nKanzlei Berger & Partner",
    knowledge: [
      "Belege: Mandanten laden Belege bis zum 10. des Folgemonats im Mandantenportal hoch.",
      "Einkommensteuererklärung 2025: Abgabefrist mit Steuerberater ist der 30.04.2027.",
      "Lohnabrechnung: Änderungen (neue Mitarbeiter, Stunden) müssen bis zum 15. des Monats gemeldet werden.",
      "Erstgespräch und Erstberatung: kostenloses Erstgespräch von 30 Minuten, danach Abrechnung nach Steuerberatervergütungsverordnung.",
      "Bürozeiten: Montag bis Freitag 8–17 Uhr.",
    ].join("\n"),
    departments: ["Steuerberatung", "Lohnbuchhaltung", "Sekretariat"],
    users: [
      { name: "Dr. Anna Berger", email: "anna@berger-steuer.example", role: "admin", dept: "Steuerberatung" },
      { name: "Tom Weiß", email: "tom@berger-steuer.example", role: "member", dept: "Lohnbuchhaltung" },
      { name: "Lisa Kraus", email: "lisa@berger-steuer.example", role: "member", dept: "Sekretariat" },
    ],
    rules: [
      { keyword: "lohn", dept: "Lohnbuchhaltung" },
      { keyword: "gehalt", dept: "Lohnbuchhaltung" },
      { category: "termin", dept: "Sekretariat" },
      { category: "rechnung", dept: "Steuerberatung" },
      { category: "anfrage", dept: "Steuerberatung" },
      { category: "bewerbung", dept: "Sekretariat" },
    ],
    mailboxes: [{ name: "Kanzlei", address: "kanzlei@berger-steuer.example" }],
    emails: [
      { h: 1, from: ["Bäckerei Hofmann", "info@baeckerei-hofmann.example"], subject: "Steuerbescheid – Nachzahlung 8.400 Euro?!",
        body: "Sehr geehrte Frau Dr. Berger,\n\nwir haben heute einen Steuerbescheid mit einer Nachzahlung von 8.400 Euro bekommen. Das kann doch nicht stimmen! Die Frist für einen Einspruch läuft in drei Wochen ab. Bitte prüfen Sie den Bescheid dringend und rufen Sie mich an.\n\nMit freundlichen Grüßen\nGerhard Hofmann" },
      { h: 4, from: ["Café Lindner", "kontakt@cafe-lindner.example"], subject: "Neue Aushilfe ab 1. Dezember – Lohnabrechnung",
        body: "Hallo Herr Weiß,\n\nwir stellen ab dem 1. Dezember eine neue Aushilfe auf Minijob-Basis ein. Welche Unterlagen benötigen Sie für die Lohnabrechnung? Bitte schicken Sie mir die Liste bis Freitag.\n\nViele Grüße\nMaria Lindner" },
      { h: 20, from: ["Jan Peters", "jan.peters@mail.example"], subject: "Anfrage Steuerberatung für mein Startup",
        body: "Guten Tag,\n\nich gründe gerade eine GmbH im Bereich Software und suche eine Steuerberatung für Buchhaltung, Jahresabschluss und Lohn. Bieten Sie ein Erstgespräch an und was kostet die laufende Betreuung ungefähr?\n\nBeste Grüße\nJan Peters" },
      { h: 28, from: ["Autohaus Kern", "buchhaltung@autohaus-kern.example"], subject: "Belege Oktober",
        body: "Sehr geehrte Damen und Herren,\n\nanbei die Info, dass die Belege für Oktober jetzt im Portal sind. Leider fehlen noch zwei Tankquittungen, die reichen wir nach.\n\nMit freundlichen Grüßen\nAutohaus Kern" },
      { h: 52, from: ["Finanzamt Musterstadt", "poststelle@finanzamt.example"], subject: "Anforderung von Unterlagen – Steuernummer 123/456/78901",
        body: "Sehr geehrte Damen und Herren,\n\nim Rahmen der Bearbeitung der Umsatzsteuererklärung 2024 Ihres Mandanten werden folgende Unterlagen benötigt: Kontenblätter 8400 und 8300. Bitte reichen Sie diese bis zum 05.12. ein.\n\nMit freundlichen Grüßen\nFinanzamt Musterstadt" },
      { h: 60, from: ["Sarah Klein", "sarah.klein@mail.example"], subject: "Termin verschieben",
        body: "Hallo Frau Kraus,\n\nleider muss ich unseren Termin am Mittwoch um 10 Uhr absagen. Könnten wir ihn auf nächste Woche verschieben?\n\nDanke und viele Grüße\nSarah Klein" },
      { h: 96, from: ["Max Bauer", "max.bauer@mail.example"], subject: "Bewerbung als Steuerfachangestellter",
        body: "Sehr geehrte Damen und Herren,\n\nhiermit bewerbe ich mich auf Ihre Stellenanzeige als Steuerfachangestellter. Meinen Lebenslauf und das Anschreiben finden Sie im Anhang.\n\nMit freundlichen Grüßen\nMax Bauer" },
      { h: 110, from: ["DATEV Info", "noreply@software-news.example"], subject: "Webinar: Neuerungen zur E-Rechnung 2027",
        body: "Melden Sie sich jetzt zu unserem kostenlosen Webinar an. Diese Nachricht wurde automatisch generiert." },
      { h: 130, from: ["Bäckerei Hofmann", "info@baeckerei-hofmann.example"], subject: "Rechnung Jahresabschluss",
        body: "Hallo,\n\ndie Rechnung für den Jahresabschluss haben wir erhalten, vielen Dank. Können wir den Betrag in zwei Raten zahlen?\n\nGruß\nGerhard Hofmann" },
    ],
    replies: [
      { to: "Autohaus Kern", h: 27, body: "Sehr geehrte Damen und Herren,\n\nvielen Dank, wir haben die Belege erhalten und warten auf die zwei Tankquittungen.\n\nMit freundlichen Grüßen\nLisa Kraus" },
    ],
  },
  {
    name: "Nordlicht Versand GmbH", slug: "nordlicht", plan: "business",
    tone: "locker aber höflich, Du-Form gegenüber Kunden, positiv",
    signature: "Dein Nordlicht-Team\nNordlicht Versand GmbH – Wohnaccessoires aus dem Norden",
    knowledge: [
      "Lieferzeit: 2–4 Werktage innerhalb Deutschlands, Versand nach Österreich und Schweiz 4–7 Werktage.",
      "Rücksendung: 30 Tage kostenloses Rückgaberecht, Retourenlabel im Kundenkonto.",
      "Erstattung: Geld ist 5–7 Werktage nach Eingang der Rücksendung auf dem Konto.",
      "Beschädigte oder kaputte Ware: Foto an support schicken, wir senden kostenlos Ersatz.",
      "Gutscheincode NORD10: 10 % Rabatt für Neukunden, nicht mit anderen Aktionen kombinierbar.",
      "Großkunden und Händler: ab 50 Stück Mengenrabatt, Ansprechpartner ist der Einkauf.",
    ].join("\n"),
    departments: ["Kundenservice", "Buchhaltung", "Einkauf", "Personal"],
    users: [
      { name: "Svenja Nord", email: "svenja@nordlicht-versand.example", role: "admin", dept: null },
      { name: "Ole Hansen", email: "ole@nordlicht-versand.example", role: "member", dept: "Kundenservice" },
      { name: "Mia Petersen", email: "mia@nordlicht-versand.example", role: "member", dept: "Kundenservice" },
      { name: "Lars Jensen", email: "lars@nordlicht-versand.example", role: "member", dept: "Buchhaltung" },
      { name: "Frieda Möller", email: "frieda@nordlicht-versand.example", role: "member", dept: "Einkauf" },
    ],
    rules: [
      { keyword: "händler", dept: "Einkauf" },
      { keyword: "lieferant", dept: "Einkauf" },
      { category: "reklamation", dept: "Kundenservice" },
      { category: "anfrage", dept: "Kundenservice" },
      { category: "rechnung", dept: "Buchhaltung" },
      { category: "bewerbung", dept: "Personal" },
    ],
    mailboxes: [
      { name: "Kundenservice", address: "support@nordlicht-versand.example" },
      { name: "Buchhaltung", address: "buchhaltung@nordlicht-versand.example" },
      { name: "Allgemein", address: "info@nordlicht-versand.example" },
    ],
    emails: [
      { mb: 0, h: 1, from: ["Julia Hartmann", "julia.h@mail.example"], subject: "Vase kaputt angekommen – Bestellung #48211",
        body: "Hallo,\n\nmeine Bestellung #48211 ist heute angekommen, aber die Glasvase ist zerbrochen. Ich bin echt enttäuscht, sie sollte ein Geschenk sein. Könnt ihr mir bitte bis Freitag Ersatz schicken? Ein Foto hänge ich an.\n\nLiebe Grüße\nJulia" },
      { mb: 0, h: 61, from: ["Peter Schmitz", "p.schmitz@mail.example"], subject: "Wo bleibt meine Bestellung?",
        body: "Hallo,\n\nich habe vor 9 Tagen bestellt (#47980) und das Paket ist immer noch nicht angekommen. Die Sendungsverfolgung zeigt seit Tagen nichts Neues. Bitte kümmert euch umgehend darum.\n\nPeter Schmitz" },
      { mb: 0, h: 6, from: ["Lena Vogel", "lena.vogel@mail.example"], subject: "Frage zur Lieferzeit nach Österreich",
        body: "Hi!\n\nwie lange dauert die Lieferung nach Wien? Ich bräuchte die Kerzenhalter bis zum 10.12.\n\nDanke dir!\nLena" },
      { mb: 0, h: 22, from: ["Anna Becker", "anna.becker@mail.example"], subject: "Rücksendung und Erstattung",
        body: "Hallo Nordlicht-Team,\n\nich habe vor zwei Wochen eine Decke zurückgeschickt, aber noch kein Geld erhalten. Wann wird die Erstattung überwiesen?\n\nViele Grüße\nAnna Becker" },
      { mb: 0, h: 55, from: ["Nina Krüger", "nina.k@mail.example"], subject: "Gutscheincode funktioniert nicht",
        body: "Hallo,\n\nder Code NORD10 funktioniert bei mir nicht, obwohl ich zum ersten Mal bestelle. Könnt ihr mir helfen?\n\nNina" },
      { mb: 0, h: 58, from: ["Tim Schulz", "tim.schulz@mail.example"], subject: "Super Service!",
        body: "Hallo zusammen,\n\nich wollte nur kurz Danke sagen – die Lampe ist toll und kam super schnell an. Gerne wieder!\n\nTim" },
      { mb: 0, h: 3, from: ["Peter Schmitz", "p.schmitz@mail.example"], subject: "Re: Wo bleibt meine Bestellung?",
        body: "Ich warte immer noch auf eine Antwort. Das ist inakzeptabel. Wenn sich bis morgen niemand meldet, storniere ich die Bestellung und fordere mein Geld zurück." },
      { mb: 1, h: 8, from: ["Glashütte Nordsee GmbH", "rechnung@glashuette-nordsee.example"], subject: "Rechnung 2025-1187 – Lieferung Glasvasen",
        body: "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Rechnung 2025-1187 über 6.420,00 EUR für die Lieferung von 400 Glasvasen. Zahlbar innerhalb von 14 Tagen ohne Abzug.\n\nMit freundlichen Grüßen\nGlashütte Nordsee" },
      { mb: 1, h: 30, from: ["Spedition Küstenblitz", "fibu@kuestenblitz.example"], subject: "Letzte Mahnung – offene Posten Oktober",
        body: "Sehr geehrte Damen und Herren,\n\ntrotz zweier Zahlungserinnerungen sind die Rechnungen 7781 und 7790 über insgesamt 2.310,40 EUR weiterhin offen. Bitte begleichen Sie den Betrag bis zum 24.11., andernfalls übergeben wir die Forderung an ein Inkassobüro.\n\nSpedition Küstenblitz" },
      { mb: 1, h: 76, from: ["Steuerkanzlei Wiese", "kanzlei@wiese-steuer.example"], subject: "Belege für die Umsatzsteuer-Voranmeldung",
        body: "Hallo Herr Jensen,\n\nfür die Umsatzsteuer-Voranmeldung November benötigen wir noch die Kontoauszüge und die Amazon-Abrechnungen. Bitte laden Sie diese bis zum 08.12. hoch.\n\nViele Grüße\nKanzlei Wiese" },
      { mb: 2, h: 10, from: ["Concept Store Hygge", "einkauf@hygge-store.example"], subject: "Händleranfrage: 200 Duftkerzen",
        body: "Guten Tag,\n\nwir betreiben einen Concept Store in Hamburg und würden gern 200 Duftkerzen 'Nordwind' als Händler bestellen. Welche Konditionen bieten Sie für Wiederverkäufer an? Bitte senden Sie uns ein Angebot bis Ende der Woche.\n\nMit freundlichen Grüßen\nKatrin Albers" },
      { mb: 2, h: 34, from: ["Mehmet Aydin", "m.aydin@mail.example"], subject: "Bewerbung Lagermitarbeiter",
        body: "Sehr geehrte Damen und Herren,\n\nich bewerbe mich auf die ausgeschriebene Stelle als Lagermitarbeiter. Lebenslauf anbei. Ich kann sofort anfangen.\n\nMit freundlichen Grüßen\nMehmet Aydin" },
      { mb: 2, h: 40, from: ["Paket-Service", "security@paket-verify.example"], subject: "Ihr Konto wurde gesperrt – verifizieren Sie Ihr Konto",
        body: "Ihr Konto wurde gesperrt. Klicken Sie hier, um Ihr Konto innerhalb von 24 Stunden zu verifizieren, sonst wird es gelöscht." },
      { mb: 2, h: 85, from: ["Messe Nord", "info@messe-nord.example"], subject: "Newsletter: Ausstellerinfos Frühjahrsmesse",
        body: "Unser Newsletter mit allen Infos für Aussteller. Zum Abmelden bitte hier klicken." },
    ],
    replies: [
      { to: "Tim Schulz", h: 57, body: "Hey Tim,\n\nvielen Dank für dein tolles Feedback! Viel Freude mit der Lampe.\n\nDein Nordlicht-Team" },
    ],
  },
];

export async function seed(db, { analyze = true } = {}) {
  if (one(db, "SELECT 1 FROM companies WHERE slug='sonnenhof'")) return { skipped: true };
  const pw = hashPassword(DEMO_PASSWORD);
  for (const c of COMPANIES) {
    const companyId = Number(run(db, "INSERT INTO companies (name, slug, plan, tone, signature, knowledge) VALUES (?,?,?,?,?,?)",
      c.name, c.slug, c.plan, c.tone, c.signature, c.knowledge).lastInsertRowid);
    const dept = {};
    for (const d of c.departments) dept[d] = Number(run(db, "INSERT INTO departments (company_id, name) VALUES (?,?)", companyId, d).lastInsertRowid);
    for (const u of c.users) {
      run(db, "INSERT INTO users (company_id, department_id, name, email, password_hash, role) VALUES (?,?,?,?,?,?)",
        companyId, u.dept ? dept[u.dept] : null, u.name, u.email, pw, u.role);
    }
    for (const r of c.rules) {
      run(db, "INSERT INTO rules (company_id, category, keyword, department_id) VALUES (?,?,?,?)", companyId, r.category || null, r.keyword || null, dept[r.dept]);
    }
    const mailboxes = c.mailboxes.map((m, i) => {
      const id = Number(run(db, "INSERT INTO mailboxes (company_id, name, address, kind, inbound_token) VALUES (?,?,?,?,?)",
        companyId, m.name, m.address, "demo", `demo-${c.slug}-${i}`).lastInsertRowid);
      return one(db, "SELECT * FROM mailboxes WHERE id=?", id);
    });
    // Älteste Mails zuerst, damit Verläufe (Antworten, Nachfragen) richtig verknüpft werden.
    const sorted = [...c.emails].sort((a, b) => b.h - a.h);
    for (const e of sorted) {
      ingestEmail(db, mailboxes[e.mb || 0], {
        message_id: `<seed-${c.slug}-${e.h}-${e.from[1]}>`, from_name: e.from[0], from_addr: e.from[1],
        subject: e.subject, body: e.body, received_at: ago(e.h),
      });
    }
    for (const r of c.replies) {
      const orig = c.emails.find((e) => e.from[0] === r.to);
      const mb = mailboxes[orig.mb || 0];
      ingestEmail(db, mb, {
        message_id: `<seed-reply-${c.slug}-${r.h}>`, in_reply_to: `<seed-${c.slug}-${orig.h}-${orig.from[1]}>`, direction: "out",
        from_name: c.users[0].name, from_addr: mb.address, to_addr: orig.from[1], subject: `AW: ${orig.subject}`, body: r.body, received_at: ago(r.h),
      });
    }
  }
  const analyzed = analyze ? await processPending(db) : 0;
  return { companies: COMPANIES.length, analyzed };
}

export const SEED_COMPANIES = COMPANIES;
