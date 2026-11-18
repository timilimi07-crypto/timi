# Subprozessoren (Auftragsverarbeiter)

> Regel c) aus `CLAUDE.md`: Nur Anbieter mit Verarbeitung in der EU. Jeder neue Dienst wird **vor** der
> Nutzung hier eingetragen. US-Anbieter (auch mit EU-Region) nur nach Prüfung und mit dokumentiertem
> Transfermechanismus.

Status: **Entwurf – noch keine Verträge abgeschlossen.** Alle Einträge sind Platzhalter.

| Zweck             | Anbieter (Platzhalter)                                                                                      | Sitz / Region                          | Daten                                            | AVV   | Status                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ----- | ------------------------------------------ |
| Hosting (Server)  | z. B. Hetzner Online GmbH                                                                                   | DE (Gunzenhausen), Rechenzentren DE/FI | alle Anwendungsdaten                             | offen | zu prüfen                                  |
| Datenbank         | selbst betrieben auf Hosting-Server oder Managed PostgreSQL eines EU-Anbieters                              | DE                                     | Metadaten, Prüfergebnisse                        | offen | zu prüfen                                  |
| Objektspeicher    | z. B. Hetzner Object Storage (S3-kompatibel; Object Lock prüfen)                                            | DE                                     | Original-Rechnungen, Prüfberichte                | offen | zu prüfen                                  |
| LLM (optional)    | Anbieter mit garantierter EU-Region, z. B. Mistral AI (FR) oder ein EU-Region-Angebot eines Cloud-Anbieters | EU                                     | nur minimierte Prüfhinweise (keine Beträge/IBAN) | offen | **Verfügbarkeit und Datenresidenz prüfen** |
| E-Mail-Eingang    | offen (später über MailMind)                                                                                | EU                                     | Rechnungs-E-Mails                                | offen | offen                                      |
| Fehler-Monitoring | offen (z. B. selbst gehostet)                                                                               | EU                                     | technische Fehler ohne Inhalte                   | offen | offen                                      |

## Prüfliste je Anbieter

- [ ] Sitz und Verarbeitungsort ausschließlich EU/EWR (auch Support, Backups)?
- [ ] Muttergesellschaft außerhalb der EU (Zugriffsrisiko, z. B. CLOUD Act)?
- [ ] AVV nach Art. 28 DSGVO abgeschlossen?
- [ ] Weitere Unterauftragsverarbeiter bekannt und akzeptiert?
- [ ] Bei LLM: keine Speicherung/kein Training mit Eingaben, Region fest konfigurierbar?
- [ ] Bei Speicher: Object Lock / WORM verfügbar (GoBD)?
