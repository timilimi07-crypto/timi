# Einbau in Firmen: Wege, Aufwand, Grenzen

Stand: November 2026. Die Regeln von Microsoft und Google ändern sich häufig, deshalb vor dem Einsatz beim Anbieter prüfen.

## Überblick: drei Wege

| Weg | Für wen | Lesen | Antworten | Aufwand beim Kunden | Status im Tool |
|---|---|---|---|---|---|
| **A · Direkt verbinden (IMAP/SMTP)** | IONOS, STRATO, GMX, WEB.DE, Telekom, mailbox.org, eigene Server, Gmail privat (App-Passwort) | Abruf alle 5 Minuten | direkt aus dem Tool | 2–5 Minuten, Formular mit Vorlagen und „Verbindung testen“ | ✅ fertig und getestet |
| **B · Weiterleitung** | Microsoft 365, Google Workspace, alle anderen | Weiterleitung an eine eigene Eingangsadresse | „Im Mailprogramm öffnen“ übergibt die fertige Antwort an Outlook/Gmail | 5–10 Minuten, bei M365 oft mit IT-Admin | ✅ fertig und getestet |
| **C · Login mit Microsoft/Google (OAuth)** | Microsoft 365, Google Workspace | über Microsoft Graph bzw. die Gmail API | direkt aus dem Tool | 1 Klick „Mit Microsoft anmelden“, Admin bestätigt einmal | ⏳ nächster Ausbauschritt |

## Warum Microsoft 365 und Google Workspace nicht per Passwort gehen

- **Microsoft 365:** Die Anmeldung per Passwort ist für IMAP/POP seit 2022 abgeschaltet. Laut Microsofts Ankündigung MC786329 (Stand Januar 2026) wird auch das Versenden per SMTP mit Passwort ab Dezember 2026 standardmäßig abgeschaltet und 2027 endgültig entfernt. Es bleibt nur OAuth.
- **Google Workspace:** Seit 2025 ist OAuth Pflicht. App-Passwörter gehen nur, wenn der Admin sie erlaubt. Gmail privat funktioniert weiter mit App-Passwort (Bestätigung in zwei Schritten muss aktiv sein).

## Weg B im Detail: Weiterleitung

Jedes Postfach im Tool hat eine eigene geheime Eingangsadresse:

- **Per E-Mail:** `<token>@INBOUND_DOMAIN`, empfangen vom eingebauten Mail-Eingang (`INBOUND_SMTP_PORT`). Dafür braucht die Eingangs-Domain einen MX-Eintrag, der auf den Server zeigt, und Port 25 muss offen sein.
- **Per Webhook:** `https://…/api/inbound/<token>` für Mail-Dienste wie Postmark oder Mailgun (JSON).

**Microsoft 365:** Outlook im Browser → Einstellungen → E-Mail → Weiterleitung → Adresse eintragen, „Kopie behalten“ aktivieren. Microsoft blockiert externe Weiterleitung standardmäßig. Der Admin muss sie in Microsoft Defender erlauben (Richtlinie für ausgehenden Spam → Automatische Weiterleitung). Für gemeinsame Postfächer wie info@ richtet der Admin die Weiterleitung im Exchange Admin Center ein.

**Gmail/Workspace:** Einstellungen → Weiterleitung und POP/IMAP → Adresse hinzufügen. Der Bestätigungscode von Google landet im Posteingang des Assistenten. Bei Workspace muss der Admin externe Weiterleitung erlauben.

**Antworten:** Mit „Im Mailprogramm öffnen“ öffnet sich die fertige Antwort in Outlook, Gmail oder Apple Mail. So bleiben Absender, Signatur und der Gesendet-Ordner wie gewohnt.

## Weg C: was für den Ausbau nötig ist

| | Microsoft 365 (Graph API) | Google Workspace (Gmail API) |
|---|---|---|
| Registrierung | App in Microsoft Entra ID anlegen, Berechtigungen `Mail.ReadWrite`, `Mail.Send` | Projekt in Google Cloud, OAuth-Zustimmungsbildschirm |
| Prüfung | Publisher-Verifizierung (kostenlos), Admin-Zustimmung je Kunde | **Sicherheitsprüfung (CASA)** für die nötigen „eingeschränkten“ Gmail-Rechte: jährlich, je nach Prüfer meist mehrere Tausend Euro |
| Neue Mails | Webhooks („Subscriptions“) oder Abruf | Pub/Sub-Benachrichtigungen oder Abruf |
| Empfehlung | **zuerst bauen**, weil die meisten deutschen Firmen M365 nutzen | danach, sobald zahlende Kunden das rechtfertigen |

Ergänzend sinnvoll ist ein **Outlook-Add-in**: eine Seitenleiste direkt in Outlook mit Kurzfassung, Kategorie und Antwortentwurf. Der Admin kann es zentral für alle Mitarbeiter verteilen.

## Betrieb (Hosting)

- Ein Server in der EU, zum Beispiel bei Hetzner oder IONOS, mit Node.js 22. Start mit `npm start` hinter einem Reverse-Proxy mit HTTPS, etwa Caddy oder nginx.
- Variablen: `APP_SECRET` (Pflicht, verschlüsselt die Postfach-Passwörter), `NODE_ENV=production` (sichere Cookies), `SYNC_MINUTES`, `INBOUND_SMTP_PORT=25`, `INBOUND_DOMAIN`, optional `ANTHROPIC_API_KEY`.
- Datensicherung: die SQLite-Datei `data/postfach.db` regelmäßig sichern. Bei vielen Kunden auf PostgreSQL umsteigen.
- Rechtliches: Auftragsverarbeitungsvertrag (AVV) mit jedem Kunden, Datenschutzerklärung, und bei aktiver KI den KI-Anbieter als Unterauftragsverarbeiter aufführen.

## Quellen

- Microsoft Message Center MC786329 (SMTP AUTH Basic Auth): https://mc.merill.net/message/MC786329
- Google: Umstieg von „weniger sicheren Apps“ auf OAuth: https://knowledge.workspace.google.com/admin/sync/transition-from-less-secure-apps-to-oauth
- Google: Prüfung eingeschränkter Berechtigungen: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
