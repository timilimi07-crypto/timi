// Startpunkt: node src/index.js  (mit --seed werden die Testfirmen angelegt)
import { openDb } from "./db.js";
import { createApp } from "./server.js";
import { seed, DEMO_PASSWORD } from "./seed.js";
import { providerName } from "./ai/index.js";

const db = openDb();
if (process.argv.includes("--seed") || process.env.SEED === "1") {
  const r = await seed(db);
  console.log(r.skipped ? "Testfirmen existieren bereits." : `Testfirmen angelegt: ${r.companies}, ausgewertete Mails: ${r.analyzed}. Passwort: ${DEMO_PASSWORD}`);
}
const port = Number(process.env.PORT || 3000);
createApp(db).listen(port, () => {
  console.log(`Postfach-Assistent läuft auf http://localhost:${port}  –  KI: ${providerName()}`);
});
