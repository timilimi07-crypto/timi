// Startpunkt: node src/index.js  (mit --seed werden die Testfirmen angelegt)
import { openDb } from "./db.js";
import { createApp } from "./server.js";
import { seed, DEMO_PASSWORD } from "./seed.js";
import { providerName } from "./ai/index.js";
import { startScheduler, startInboundSmtp } from "./integrations.js";

const db = openDb();
if (process.argv.includes("--seed") || process.env.SEED === "1") {
  const r = await seed(db);
  console.log(r.skipped ? "Testfirmen existieren bereits." : `Testfirmen angelegt: ${r.companies}, ausgewertete Mails: ${r.analyzed}. Passwort: ${DEMO_PASSWORD}`);
}
const port = Number(process.env.PORT || 3000);
createApp(db).listen(port, () => {
  console.log(`Postfach-Assistent läuft auf http://localhost:${port}  –  KI: ${providerName()}`);
});

// Postfächer automatisch abrufen (Standard: alle 5 Minuten, SYNC_MINUTES=0 schaltet ab).
if (process.env.SYNC_MINUTES !== "0") startScheduler(db);

// Eigener Mail-Eingang für Weiterleitungen (z. B. INBOUND_SMTP_PORT=25, INBOUND_DOMAIN=eingang.deine-domain.de).
if (process.env.INBOUND_SMTP_PORT) {
  await startInboundSmtp(db);
  console.log(`Mail-Eingang für Weiterleitungen auf Port ${process.env.INBOUND_SMTP_PORT}, Adressen: <token>@${process.env.INBOUND_DOMAIN || "(INBOUND_DOMAIN setzen)"}`);
}
