# Postfach-Assistent

Ein KI-Assistent für Firmen-Postfächer. Er sortiert E-Mails, fasst sie zusammen, verteilt sie an die zuständige Person, erkennt Aufgaben mit Fristen und schreibt Antwortentwürfe im Stil der Firma. Er funktioniert für mehrere Firmen gleichzeitig, und jede Firma sieht nur ihre eigenen Daten.

## Funktionen

| Bereich | Was passiert |
|---|---|
| **Übersichtlich ordnen** | Posteingang als Liste mit Gruppen (nach Dringlichkeit, Kategorie, Abteilung, Bearbeitungsstand, Postfach, Datum) oder als **Board** mit Spalten, Karten per Ziehen verschieben; jede Kategorie hat überall dieselbe Farbe |
| **Veranschaulichen** | Diagramme: Eingang pro Tag nach Kategorie, Verteilung nach Kategorie, offene Mails je Abteilung (dringend hervorgehoben), Antwortzeit, häufigste Absender; jedes Diagramm auch als Tabelle; heller und dunkler Modus |
| **Alle E-Mails zusammenfassen** | Übersicht für heute, 7 Tage, 30 Tage oder alles, für alle oder ein einzelnes Postfach: Kernaussage, Kennzahlen, dringende Mails, Themen und To-dos |
| **Sortieren** | Kategorie (Anfrage, Reklamation, Rechnung, Termin, Bewerbung, Info, Spam), Dringlichkeit und Stimmung des Absenders |
| **Kurzfassung** | 1–2 Sätze pro Mail: wer will was bis wann |
| **Verläufe** | Antworten und Nachfragen werden zusammengeführt, ein Klick fasst den ganzen Verlauf zusammen |
| **Zuweisen** | Regeln nach Stichwort oder Kategorie verteilen Mails an Abteilungen oder Personen, „Nur meine“ filtert die eigenen |
| **Aufgaben** | Bitten mit Fristen („bis Freitag“, „bis zum 28.11.“) werden zu Aufgaben mit Datum |
| **Antwortentwürfe** | Im eingestellten Tonfall (Sie- oder Du-Form) mit Signatur und Fakten aus dem Firmenwissen. **Verschickt wird nur nach Klick.** |
| **Nachfassen** | Liste der Kunden, die länger als X Stunden auf eine Antwort warten |
| **Einbinden** | Direkt per IMAP/SMTP mit Vorlagen für IONOS, STRATO, GMX, WEB.DE, Telekom, Gmail usw. und „Verbindung testen“; automatischer Abruf alle 5 Minuten; **Weiterleitung** an eine eigene Eingangsadresse (für Microsoft 365 / Google Workspace); „Im Mailprogramm öffnen“ für Antworten – Details in [EINBAU.md](EINBAU.md) |
| **Team & Rechte** | Admins und Mitarbeiter, Abteilungen, Protokoll aller Aktionen |
| **Selbst-Registrierung** | Neue Firmen legen sich selbst ein Konto an |

## Starten

Voraussetzung: Node.js 22.13 oder neuer.

```bash
cd postfach-assistent
npm install
npm run demo        # legt die 3 Testfirmen an und startet auf http://localhost:3000
```

Testzugänge (Passwort jeweils `demo1234`):

| Firma | Login | Profil |
|---|---|---|
| Hausverwaltung Sonnenhof GmbH | petra@sonnenhof-hv.example | klein, 3 Personen, 1 Postfach |
| Kanzlei Berger & Partner | anna@berger-steuer.example | Steuerkanzlei, 3 Personen |
| Nordlicht Versand GmbH | svenja@nordlicht-versand.example | Online-Shop, 5 Personen, 3 Postfächer, Du-Form |

Weitere Logins: jonas@sonnenhof-hv.example (Mitarbeiter Technik), ole@nordlicht-versand.example (Kundenservice) usw.
Alle Firmen, Personen und Adressen sind erfunden.

## KI einschalten

Ohne API-Schlüssel nutzt das Tool eine **lokale Auswertung mit Regeln**. Sie läuft kostenlos und offline und wurde für die Tests verwendet. Für deutlich bessere Zusammenfassungen und Antworten kann Claude eingeschaltet werden:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

| Variable | Bedeutung | Standard |
|---|---|---|
| `ANTHROPIC_API_KEY` | schaltet Claude ein | – |
| `AI_MODEL` | Modell | `claude-opus-5-5` |
| `AI_EFFORT` | Denkaufwand (`low`, `medium`, `high`) | `low` |
| `PORT` | Port | `3000` |
| `DB_FILE` | Datenbankdatei | `data/postfach.db` |
| `SYNC_MINUTES` | Abstand des automatischen Abrufs (0 = aus) | `5` |
| `INBOUND_SMTP_PORT` | Port des eigenen Mail-Eingangs für Weiterleitungen (z. B. 25) | aus |
| `INBOUND_DOMAIN` | Domain der Eingangsadressen (`<token>@domain`) | – |
| `APP_SECRET` | Schlüssel zur Verschlüsselung der Postfach-Passwörter | wird in `data/secret.key` erzeugt |

Bei aktivem Claude ist das serverseitige Fallback eingeschaltet: Lehnt das Modell eine Anfrage ab, übernimmt automatisch ein anderes Modell. Schlägt der KI-Aufruf ganz fehl, nutzt das Tool die lokale Auswertung, damit das Postfach nie stehen bleibt.

## Tests

```bash
npm test
```

Die 29 Tests prüfen unter anderem:
- Auswertung: Kategorien, Fristen, Satztrennung, Aufgaben, Entwürfe in Sie- und Du-Form
- Trennung der Firmen: kein Lesen, Ändern, Antworten oder Zusammenfassen fremder Daten
- „Alle E-Mails zusammenfassen“ für jede Testfirma, je Zeitraum und je Postfach
- Verläufe, Nachfassen, Aufgaben, Rechte (Mitarbeiter gegenüber Admin), Registrierung
- Weiterleitungs-Eingang inklusive Duplikat-Erkennung
- **echter Abruf über IMAP und Versand über SMTP** mit lokalen Mailservern, verschlüsselt gespeicherte Passwörter
- automatischer Abruf, Verbindungstest, Weiterleitung per E-Mail an den eigenen Mail-Eingang
- Diagramm-Daten (Tage, Abteilungen, Antwortzeit, Absender)

## Aufbau

```
src/
  index.js      Start (inkl. automatischem Abruf und Mail-Eingang)
  integrations.js  Anbieter-Vorlagen, Verbindungstest, Abruf-Zeitplan, Mail-Eingang
  server.js     REST-API, Anmeldung, Rechte
  mail.js       Aufnahme, Auswertung, Zuweisung, Übersichten, Versand, IMAP-Abruf
  ai/local.js   lokale Auswertung (Regeln für deutsche Geschäfts-Mails)
  ai/claude.js  Auswertung mit Claude (strukturierte Ausgabe)
  db.js         SQLite-Datenbank
  auth.js       Passwörter, Sitzungen, Verschlüsselung
  seed.js       Testfirmen
public/         Oberfläche (HTML/CSS/JS, auch fürs Handy), charts.js = Diagramme
test/           automatische Tests
```

## Vor dem echten Einsatz noch offen

- **Mit Claude testen:** Die Tests liefen nur mit der lokalen Auswertung, weil in der Testumgebung kein API-Schlüssel vorhanden war.
- **Login mit Microsoft/Google (OAuth)** für die direkte Anbindung von Microsoft 365 und Google Workspace (bis dahin: Weiterleitung). Siehe [EINBAU.md](EINBAU.md).
- **Hosting in der EU mit HTTPS,** Auftragsverarbeitungsvertrag (AVV) und Datenschutzerklärung (DSGVO).
- **Zahlungen** für die Abo-Pakete, zum Beispiel über Stripe.
