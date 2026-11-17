/**
 * Seed-Daten für den Demo-Modus.
 *
 * Legt zwei strikt getrennte Firmen an (zum Testen der Mandantentrennung):
 *  - Müller & Partner GmbH (Hauptdemo, 3 Nutzer, Demo-Postfächer)
 *  - Nordlicht Logistik AG (zweiter Mandant)
 *
 * Alle Demo-Passwörter: "mailmind". Beispiel-E-Mails folgen in Phase 2.
 * Ausführen: npm run db:seed (idempotent – löscht vorher die Demo-Firmen).
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/server/defaults";

const db = new PrismaClient();

type OrgSeed = {
  name: string;
  slug: string;
  users: { name: string; email: string; role: Role }[];
  mailboxes: { name: string; emailAddress: string }[];
  labels: { name: string; color: string }[];
};

const ORGS: OrgSeed[] = [
  {
    name: "Müller & Partner GmbH",
    slug: "mueller-partner",
    users: [
      { name: "Anna Müller", email: "admin@mueller-partner.de", role: "ADMIN" },
      { name: "Jonas Becker", email: "manager@mueller-partner.de", role: "MANAGER" },
      { name: "Lea Schneider", email: "mitarbeiter@mueller-partner.de", role: "MEMBER" },
      { name: "Tobias Wagner", email: "t.wagner@mueller-partner.de", role: "MEMBER" },
    ],
    mailboxes: [
      { name: "Info", emailAddress: "info@mueller-partner.de" },
      { name: "Buchhaltung", emailAddress: "buchhaltung@mueller-partner.de" },
    ],
    labels: [
      { name: "VIP", color: "rose" },
      { name: "Rückruf", color: "amber" },
      { name: "Projekt Phoenix", color: "violet" },
    ],
  },
  {
    name: "Nordlicht Logistik AG",
    slug: "nordlicht-logistik",
    users: [{ name: "Henrik Jansen", email: "admin@nordlicht-logistik.de", role: "ADMIN" }],
    mailboxes: [{ name: "Disposition", emailAddress: "dispo@nordlicht-logistik.de" }],
    labels: [{ name: "Express", color: "red" }],
  },
];

async function main() {
  // Docker-Start: nur seeden, wenn die Datenbank noch leer ist.
  if (process.argv.includes("--if-empty") && (await db.organization.count()) > 0) {
    console.log("Datenbank enthält bereits Daten – Seed übersprungen.");
    return;
  }

  const passwordHash = await bcrypt.hash("mailmind", 10);

  // Idempotent: vorhandene Demo-Firmen entfernen (Cascade löscht alle Daten).
  await db.organization.deleteMany({ where: { slug: { in: ORGS.map((o) => o.slug) } } });

  for (const o of ORGS) {
    const org = await db.organization.create({
      data: {
        name: o.name,
        slug: o.slug,
        retentionDays: 365,
        users: { create: o.users.map((u) => ({ ...u, passwordHash })) },
        categories: {
          create: DEFAULT_CATEGORIES.map((c, i) => ({
            key: c.key,
            name: c.name,
            color: c.color,
            icon: c.icon,
            description: c.description,
            autoCollapse: "autoCollapse" in c ? c.autoCollapse : false,
            isSystem: true,
            sortOrder: i,
          })),
        },
        labels: { create: o.labels },
        mailboxes: {
          create: o.mailboxes.map((m) => ({ ...m, provider: "DEMO" as const, status: "ACTIVE" as const })),
        },
      },
    });
    console.log(`✔ Firma angelegt: ${org.name} (${o.users.length} Nutzer)`);
  }

  console.log("\nDemo-Zugänge (Passwort: mailmind):");
  for (const o of ORGS) for (const u of o.users) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
