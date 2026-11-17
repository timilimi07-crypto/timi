// Baut eine Demo, die komplett im Browser läuft (ohne Server):
// gleiche Oberfläche, Testfirmen-Daten als Datei, Auswertung mit der lokalen KI-Logik.
// Aufruf: node --no-warnings demo/build.mjs   → Ergebnis in demo/dist/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(here, "dist");
process.env.SECRET_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "demo-")), "k");

const { openDb, all } = await import("../src/db.js");
const { seed } = await import("../src/seed.js");
const { PROVIDERS } = await import("../src/integrations.js");

const db = openDb(":memory:");
await seed(db);
const now = Date.now();
const hoursAgo = (iso) => Math.round(((now - Date.parse(iso + "Z")) / 3600e3) * 100) / 100;
const daysFromToday = (d) => d ? Math.round((Date.parse(d + "T12:00:00Z") - Date.parse(new Date(now).toISOString().slice(0, 10) + "T12:00:00Z")) / 864e5) : null;

const data = {
  companies: all(db, "SELECT * FROM companies"),
  departments: all(db, "SELECT * FROM departments"),
  users: all(db, "SELECT id, company_id, department_id, name, email, role FROM users"),
  mailboxes: all(db, "SELECT id, company_id, name, address, kind, inbound_token FROM mailboxes"),
  rules: all(db, "SELECT * FROM rules"),
  emails: all(db, "SELECT * FROM emails").map(({ received_at, ...e }) => ({ ...e, hours_ago: hoursAgo(received_at) })),
  tasks: all(db, "SELECT * FROM tasks").map(({ due_date, created_at, ...t }) => ({ ...t, due_in_days: daysFromToday(due_date) })),
  providers: PROVIDERS,
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "demo-data.js"), `export default ${JSON.stringify(data)};\n`);
for (const f of ["app.js", "charts.js", "style.css"]) fs.copyFileSync(path.join(root, "public", f), path.join(dist, f));
fs.copyFileSync(path.join(root, "src", "ai", "local.js"), path.join(dist, "local.js"));
fs.copyFileSync(path.join(here, "backend.js"), path.join(dist, "backend.js"));
fs.copyFileSync(path.join(here, "index.html"), path.join(dist, "index.html"));
console.log(`Demo gebaut: ${dist} (${data.emails.length} E-Mails, ${data.companies.length} Firmen)`);
