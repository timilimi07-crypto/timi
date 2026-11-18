/**
 * Seed-Daten für den Demo-Modus.
 *
 * Legt zwei strikt getrennte Firmen an (zum Testen der Mandantentrennung):
 *  - Müller & Partner GmbH (Hauptdemo, 3 Nutzer, Demo-Postfächer)
 *  - Nordlicht Logistik AG (zweiter Mandant)
 *
 * Alle Demo-Passwörter: "mailmind".
 *
 * Die Demo-Postfächer werden über den echten Abruf-Pfad (syncMailbox) mit den
 * Beispiel-E-Mails aus src/server/mail/demo/emails.ts befüllt – inklusive
 * Zeitfenster (30 Tage) und Thread-Zuordnung. Einige E-Mails „treffen erst
 * später ein“ und werden vom automatischen Abruf geholt.
 *
 * Zusätzlich wird für Müller & Partner ein KI-Kostenverlauf der letzten
 * 45 Tage erzeugt (nur Demo, damit das Admin-Dashboard etwas zeigt).
 * Ausführen: npm run db:seed (idempotent – löscht vorher die Demo-Firmen).
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/server/defaults";
import { syncMailbox } from "../src/server/mail/sync";
import type { DemoSet } from "../src/server/mail/demo/emails";
import { computeCostUsd } from "../src/lib/ai/models";
import { applyRules } from "../src/server/rules/engine";

const db = new PrismaClient();

type OrgSeed = {
  name: string;
  slug: string;
  users: { name: string; email: string; role: Role }[];
  mailboxes: { name: string; emailAddress: string; demoSet: DemoSet }[];
  demoAiCosts?: boolean;
  demoTeam?: boolean;
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
      { name: "Info", emailAddress: "info@mueller-partner.de", demoSet: "info" },
      { name: "Buchhaltung", emailAddress: "buchhaltung@mueller-partner.de", demoSet: "buchhaltung" },
    ],
    demoAiCosts: true,
    demoTeam: true,
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
    mailboxes: [{ name: "Disposition", emailAddress: "dispo@nordlicht-logistik.de", demoSet: "dispo" }],
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
          create: o.mailboxes.map(({ demoSet, ...m }) => ({
            ...m,
            provider: "DEMO" as const,
            status: "ACTIVE" as const,
            config: { demoSet },
          })),
        },
      },
      include: { mailboxes: true },
    });
    console.log(`✔ Firma angelegt: ${org.name} (${o.users.length} Nutzer)`);

    // Erster Abruf der Demo-Postfächer über den echten Sync-Pfad.
    for (const mb of org.mailboxes) {
      let created = 0;
      let skippedOld = 0;
      for (let i = 0; i < 20; i++) {
        const r = await syncMailbox(mb.id);
        if (r.status !== "ok") throw new Error(`Demo-Abruf fehlgeschlagen: ${r.error ?? r.status}`);
        created += r.created;
        skippedOld += r.skippedOld;
        if (r.remaining === 0) break;
      }
      console.log(`  ↳ Postfach ${mb.name}: ${created} E-Mails abgerufen${skippedOld ? `, ${skippedOld} älter als 30 Tage übersprungen` : ""}`);
    }

    if (o.demoTeam) {
      const n = await seedDemoTeam(org.id);
      console.log(`  ↳ ${n.rules} Demo-Regeln angewendet (${n.matched} Treffer), 1 interne Notiz`);
    }

    if (o.demoAiCosts) {
      const n = await seedDemoAiCosts(org.id);
      console.log(`  ↳ ${n} Demo-Einträge im KI-Kostenprotokoll (45 Tage)`);
    }
  }

  console.log("\nDemo-Zugänge (Passwort: mailmind):");
  for (const o of ORGS) for (const u of o.users) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

/**
 * Erzeugt einen plausiblen KI-Kostenverlauf (nur Demo): pro E-Mail eine
 * Triage mit Haiku 5.5, bei ~75 % eine Analyse mit Sonnet 5.5, dazu einige
 * Antwortvorschläge und Thread-Zusammenfassungen. Deterministisch (fester Seed).
 */
async function seedDemoAiCosts(organizationId: string): Promise<number> {
  let state = 42;
  const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const between = (a: number, b: number) => Math.round(a + rand() * (b - a));

  type Row = { organizationId: string; operation: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd: number; durationMs: number; createdAt: Date };
  const rows: Row[] = [];
  const add = (operation: string, model: string, input: number, output: number, cacheRead: number, at: Date) =>
    rows.push({
      organizationId,
      operation,
      model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      costUsd: computeCostUsd(model, { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead }),
      durationMs: between(400, model.includes("haiku") ? 1200 : 6000),
      createdAt: at,
    });

  const now = Date.now();
  for (let d = 44; d >= 0; d--) {
    const day = new Date(now - d * 86_400_000);
    const weekend = [0, 6].includes(day.getDay());
    // Heute nur anteilig (bis zur aktuellen Uhrzeit).
    const share = d === 0 ? Math.min(1, new Date().getHours() / 18) : 1;
    const emails = Math.round((weekend ? between(4, 12) : between(35, 70)) * share);
    for (let i = 0; i < emails; i++) {
      const at = new Date(day.getTime() - between(0, d === 0 ? 3 * 3600_000 : 10 * 3600_000));
      add("triage", "claude-haiku-5-5", between(500, 1500), between(60, 140), between(1500, 2500), at);
      if (rand() < 0.75) add("analyze", "claude-sonnet-5-5", between(900, 3500), between(350, 800), between(2000, 3000), at);
    }
    for (let i = 0; i < Math.round((weekend ? 0 : between(2, 8)) * share); i++) {
      add("reply", "claude-sonnet-5-5", between(1500, 4000), between(250, 600), 2000, new Date(day.getTime() - between(0, 8 * 3600_000)));
    }
    for (let i = 0; i < Math.round((weekend ? 0 : between(1, 4)) * share); i++) {
      add("thread_summary", "claude-sonnet-5-5", between(3000, 9000), between(200, 400), 2000, new Date(day.getTime() - between(0, 8 * 3600_000)));
    }
  }
  // Vor 12 Tagen hat ein Admin eine Woche lang Opus 5.5 getestet.
  for (let i = 0; i < 40; i++) {
    add("analyze", "claude-opus-5-5", between(900, 3500), between(400, 900), 2000, new Date(now - between(12, 18) * 86_400_000));
  }
  await db.aiUsageLog.createMany({ data: rows });
  return rows.length;
}

/**
 * Demo für Phase 6: drei Regeln (wie sie eine Firma anlegen würde), die direkt
 * auf die abgerufenen E-Mails angewendet werden, plus eine interne Notiz.
 */
async function seedDemoTeam(organizationId: string) {
  const users = await db.user.findMany({ where: { organizationId } });
  const by = (email: string) => users.find((u) => u.email.startsWith(email))!;
  const reklamation = await db.label.create({ data: { organizationId, name: "Reklamation", color: "orange" } });
  const info = await db.mailbox.findFirstOrThrow({ where: { organizationId, name: "Info" } });

  const rules = [
    {
      name: "Reklamationen an Tobias",
      conditions: { match: "any", items: [{ field: "any", op: "contains", value: "Reklamation" }, { field: "any", op: "contains", value: "beschädigt" }] },
      actions: [{ type: "assign", userId: by("t.wagner").id }, { type: "label", labelId: reklamation.id }, { type: "priority", priority: "HIGH" }],
    },
    {
      name: "Steuerberater → Rechnung, an Anna",
      conditions: { match: "all", items: [{ field: "from", op: "endsWith", value: "@kanzlei-seidel.de" }] },
      actions: [{ type: "category", categoryKey: "rechnung" }, { type: "assign", userId: by("admin").id }],
    },
    {
      name: "Bewerbungen an Jonas",
      conditions: { match: "all", items: [{ field: "subject", op: "contains", value: "Bewerbung" }, { field: "mailbox", op: "equals", value: info.id }] },
      actions: [{ type: "category", categoryKey: "bewerbung" }, { type: "assign", userId: by("manager").id }],
    },
  ];
  for (const [i, r] of rules.entries()) {
    await db.rule.create({ data: { organizationId, name: r.name, conditions: r.conditions, actions: r.actions, sortOrder: i, createdById: by("admin").id } });
  }
  let matched = 0;
  for (const e of await db.email.findMany({ where: { organizationId }, select: { id: true } })) {
    if ((await applyRules(e.id)).matched.length) matched++;
  }
  // Interne Notiz im Weber-Verlauf
  const weber = await db.email.findFirst({ where: { organizationId, subject: { startsWith: "AW: AW: Angebot A-2026-117" } } });
  if (weber) {
    await db.comment.create({
      data: { emailId: weber.id, authorId: by("manager").id, isNote: true, body: "Frau Weber hat gestern angerufen. Demontage ist im Angebot enthalten (Pos. 7) – bitte heute noch schriftlich bestätigen. Umsetzung in den Betriebsferien ist mit Technik abgestimmt." },
    });
  }
  return { rules: rules.length, matched };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
