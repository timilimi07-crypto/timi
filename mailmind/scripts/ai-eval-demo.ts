/**
 * Qualitätstest der KI-Pipeline mit allen 60 Demo-E-Mails (echte API-Aufrufe!).
 *
 *   npm run ai:eval            # Testfirma anlegen, auswerten, Bericht schreiben, Testfirma löschen
 *   npm run ai:eval -- --keep  # Testfirma behalten (zum Ansehen in der App)
 *   npm run ai:eval -- --dry-run  # Trockenlauf OHNE API: prüft nur die Mechanik des Skripts,
 *                                 # simulierte Antworten, Bericht nach docs/ki-trockenlauf.md
 *
 * Voraussetzung: ANTHROPIC_API_KEY. Kosten: ca. 1–2 USD pro Lauf.
 * Ergebnis: docs/ki-qualitaetstest.md (Tabelle Kategorie / Priorität / Zusammenfassung
 * pro E-Mail, Abgleich mit einer Erwartung, Kosten und Cache-Statistik).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { modelLabel } from "../src/lib/ai/models";
import { createAnthropicCaller, isAiConfigured, type AiCaller } from "../src/server/ai/client";
import { processEmail, summarizeThread } from "../src/server/ai/pipeline";
import { DEFAULT_CATEGORIES } from "../src/server/defaults";
import { DemoConnector } from "../src/server/mail/connectors/demo";
import { DEMO_EMAILS, DEMO_RECIPIENTS, type DemoSet } from "../src/server/mail/demo/emails";
import { storeMessage } from "../src/server/mail/sync";

type P = "URGENT" | "HIGH" | "NORMAL" | "LOW";

/** Erwartete Einordnung (menschliche Einschätzung) – Grundlage für die Übereinstimmungs-Spalten. */
const EXPECTED: Record<string, [string, P]> = {
  "info-01": ["kunde", "URGENT"], "info-02": ["kunde", "HIGH"], "info-03": ["kunde", "HIGH"],
  "info-04a": ["kunde", "HIGH"], "info-04b": ["kunde", "HIGH"], "info-04c": ["kunde", "URGENT"],
  "info-05": ["support", "HIGH"], "info-06": ["support", "NORMAL"], "info-07": ["kunde", "LOW"],
  "info-08": ["bewerbung", "NORMAL"], "info-09": ["bewerbung", "NORMAL"], "info-10": ["bewerbung", "NORMAL"],
  "info-11": ["lieferant", "HIGH"], "info-12": ["lieferant", "NORMAL"], "info-13": ["lieferant", "LOW"],
  "info-14": ["intern", "NORMAL"], "info-15": ["intern", "NORMAL"], "info-16": ["intern", "LOW"],
  "info-17": ["intern", "HIGH"], "info-18": ["newsletter", "LOW"], "info-19": ["newsletter", "LOW"],
  "info-20": ["newsletter", "LOW"], "info-21": ["newsletter", "LOW"], "info-22": ["spam", "LOW"],
  "info-23": ["spam", "LOW"], "info-24": ["spam", "LOW"], "info-25": ["kunde", "HIGH"],
  "info-26": ["kunde", "URGENT"], "info-27a": ["kunde", "NORMAL"], "info-27b": ["kunde", "HIGH"],
  "info-28": ["kunde", "NORMAL"], "info-29": ["kunde", "NORMAL"], "info-30": ["support", "NORMAL"],
  "info-31": ["kunde", "HIGH"], "info-32": ["intern", "URGENT"], "info-33": ["lieferant", "NORMAL"],
  "info-34": ["kunde", "NORMAL"], "info-35": ["kunde", "NORMAL"], "info-36": ["newsletter", "LOW"],
  "info-37": ["lieferant", "LOW"], "info-38": ["kunde", "URGENT"], "info-39": ["newsletter", "LOW"],
  "info-40": ["bewerbung", "NORMAL"], "info-41": ["kunde", "HIGH"],
  "bh-01": ["rechnung", "NORMAL"], "bh-02": ["rechnung", "HIGH"], "bh-03": ["rechnung", "LOW"],
  "bh-04": ["rechnung", "HIGH"], "bh-05": ["rechnung", "NORMAL"], "bh-06": ["rechnung", "LOW"],
  "bh-07": ["rechnung", "LOW"], "bh-08": ["rechnung", "LOW"], "bh-09": ["newsletter", "LOW"],
  "bh-10": ["spam", "LOW"], "bh-11": ["rechnung", "LOW"],
  "dispo-01": ["kunde", "URGENT"], "dispo-02": ["intern", "URGENT"], "dispo-03": ["lieferant", "URGENT"],
  "dispo-04": ["newsletter", "LOW"], "dispo-05": ["rechnung", "LOW"],
};

const PRIO_DE: Record<P, string> = { URGENT: "Dringend", HIGH: "Hoch", NORMAL: "Normal", LOW: "Niedrig" };
const RANK: Record<P, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const usd = (v: number) => `${v.toFixed(4).replace(".", ",")} $`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

async function runPool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

/** Simulierte Antworten für --dry-run (KEINE Qualitätsaussage!). */
const dryRunCaller: AiCaller = async (p) => {
  const subject = p.user.match(/Betreff: (.*)/)?.[1] ?? "";
  const demoId = DEMO_EMAILS.find((e) => e.subject === subject)?.id ?? "";
  const [cat, prio] = EXPECTED[demoId] ?? ["kunde", "NORMAL"];
  const data =
    p.operation === "triage"
      ? { category: cat, categoryConfidence: 0.9, isBulk: cat === "newsletter" || cat === "spam", summary: "(Trockenlauf)", phishing: false, phishingReason: null }
      : p.operation === "thread_summary"
        ? { summary: "(Trockenlauf – Thread)" }
        : { summary: "(Trockenlauf)", category: cat, categoryConfidence: 0.9, priority: prio, priorityConfidence: 0.8, priorityReason: "(Trockenlauf)", sentiment: "NEUTRAL", tasks: [], entities: [] };
  await p.onAttempt?.({ operation: p.operation, model: p.model, attempt: 1, success: true, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, durationMs: 0 });
  return { ok: true, data: p.schema.parse(data), model: p.model };
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun && !isAiConfigured()) {
    console.error("ANTHROPIC_API_KEY fehlt – der Qualitätstest braucht echte API-Aufrufe.");
    process.exit(1);
  }
  const keep = process.argv.includes("--keep");
  const caller: AiCaller = dryRun ? dryRunCaller : createAnthropicCaller();
  const started = Date.now();

  // --- Testfirma mit Standard-Kategorien und drei Demo-Postfächern ---
  const org = await db.organization.create({
    data: {
      name: "Müller & Partner GmbH",
      slug: `ki-qualitaetstest-${Date.now()}`,
      categories: {
        create: DEFAULT_CATEGORIES.map((c, i) => ({
          key: c.key, name: c.name, description: c.description, color: c.color, icon: c.icon,
          autoCollapse: "autoCollapse" in c ? c.autoCollapse : false, isSystem: true, sortOrder: i,
        })),
      },
    },
  });
  console.log(`Testfirma angelegt (${org.slug}).`);

  const anchor = new Date(Date.now() - 3 * 3600_000); // alle Demo-Mails liegen in der Vergangenheit
  const stored: { id: string; demoId: string; set: DemoSet }[] = [];
  for (const set of ["info", "buchhaltung", "dispo"] as DemoSet[]) {
    const mb = await db.mailbox.create({
      data: { organizationId: org.id, name: set === "info" ? "Info" : set === "buchhaltung" ? "Buchhaltung" : "Disposition", emailAddress: DEMO_RECIPIENTS[set].email, provider: "DEMO", config: { demoSet: set } },
    });
    const connector = new DemoConnector(set, anchor);
    // Älteste zuerst speichern, damit Threads in natürlicher Reihenfolge entstehen.
    for (const e of DEMO_EMAILS.filter((x) => x.set === set).sort((a, b) => b.minutesAgo - a.minutesAgo)) {
      const id = await storeMessage(mb, org, (await connector.fetchMessage(e.id))!);
      if (id) stored.push({ id, demoId: e.id, set });
    }
  }
  console.log(`${stored.length} Demo-E-Mails gespeichert. Starte KI-Auswertung …`);

  // --- Auswertung: Threads der Reihe nach (Kontext!), verschiedene Threads parallel ---
  const emails = await db.email.findMany({ where: { organizationId: org.id }, select: { id: true, threadId: true, receivedAt: true } });
  const groups = new Map<string, typeof emails>();
  for (const e of emails) groups.set(e.threadId ?? e.id, [...(groups.get(e.threadId ?? e.id) ?? []), e]);
  let done = 0;
  await runPool([...groups.values()], 4, async (group) => {
    for (const e of group.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())) {
      const r = await processEmail(e.id, { caller });
      done++;
      process.stdout.write(`\r  ${done}/${emails.length} ausgewertet`);
      if (r.status === "done" && r.threadId && group.length > 1) await summarizeThread(r.threadId, { caller });
      if (r.status === "failed") console.log(`\n  ⚠ ${e.id}: ${r.error}`);
    }
  });
  console.log("");

  // --- Ergebnisse einsammeln ---
  const results = await db.email.findMany({
    where: { organizationId: org.id },
    include: { category: true, mailbox: true, tasks: { orderBy: { title: "asc" } }, entities: true, thread: true },
  });
  const byDemo = new Map(stored.map((s) => [s.id, s.demoId]));
  const order = new Map(DEMO_EMAILS.map((e, i) => [e.id, i]));
  results.sort((a, b) => order.get(byDemo.get(a.id)!)! - order.get(byDemo.get(b.id)!)!);

  const usage = await db.aiUsageLog.findMany({ where: { organizationId: org.id } });
  const sum = (f: (u: (typeof usage)[number]) => number, filter: (u: (typeof usage)[number]) => boolean = () => true) => usage.filter(filter).reduce((a, u) => a + f(u), 0);
  const totalCost = sum((u) => Number(u.costUsd));
  const models = [...new Set(usage.map((u) => u.model))];

  let catOk = 0, prioOk = 0, prioNear = 0;
  const rows = results.map((e, i) => {
    const demoId = byDemo.get(e.id)!;
    const [expCat, expPrio] = EXPECTED[demoId] ?? ["?", "NORMAL"];
    const prio = e.priority as P | null;
    const cOk = e.category?.key === expCat;
    const pOk = prio === expPrio;
    const pNear = prio != null && Math.abs(RANK[prio] - RANK[expPrio]) <= 1;
    if (cOk) catOk++;
    if (pOk) prioOk++;
    if (pNear) prioNear++;
    const tasks = e.tasks.map((t) => `${t.title}${t.dueDate ? ` (bis ${t.dueDate.toISOString().slice(0, 10)})` : ""}`).join("; ") || "–";
    return `| ${i + 1} | ${e.mailbox.name} | ${cell(e.fromName ?? e.fromEmail)} | ${cell(e.subject)} | ${e.category?.name ?? "–"} (${pct(e.categoryConfidence)}) ${cOk ? "✓" : `✗ erw. ${expCat}`} | ${prio ? PRIO_DE[prio] : "–"} (${pct(e.priorityConfidence)}) ${pOk ? "✓" : pNear ? `≈ erw. ${PRIO_DE[expPrio]}` : `✗ erw. ${PRIO_DE[expPrio]}`} | ${[e.phishingSuspected ? `🛑 Phishing: ${cell(e.phishingReason ?? "")}` : "", e.needsReview ? "⚠ " + cell(e.reviewReason ?? "") : ""].filter(Boolean).join(" ")} | ${cell(e.summary ?? e.aiError ?? "–")} | ${cell(tasks)} | ${e.aiModels.map((m) => modelLabel(m).replace("Claude ", "")).join(" + ")} | ${usd(Number(e.aiCostUsd))} |`;
  });

  const threads = results.filter((e) => e.thread?.summary && e.thread.messageCount > 1);
  const uniqueThreads = [...new Map(threads.map((e) => [e.thread!.id, e.thread!])).values()];

  const n = results.length;
  const md = `${dryRun ? "> **TROCKENLAUF – simulierte Antworten, keine Aussage über die KI-Qualität.**\n\n" : ""}# KI-Qualitätstest mit ${n} Demo-E-Mails

Erstellt: ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · Dauer: ${Math.round((Date.now() - started) / 1000)} s · Modelle: ${models.map(modelLabel).join(", ")}

## Überblick

| Kennzahl | Wert |
| --- | --- |
| Kategorie wie erwartet | **${catOk}/${n}** (${pct(catOk / n)}) |
| Priorität wie erwartet | **${prioOk}/${n}** (${pct(prioOk / n)}), höchstens eine Stufe daneben: ${prioNear}/${n} (${pct(prioNear / n)}) |
| Markiert mit „Bitte prüfen“ | ${results.filter((e) => e.needsReview).length} |
| Als möglicher Phishing-Versuch markiert | ${results.filter((e) => e.phishingSuspected).length} (${results.filter((e) => e.phishingSuspected).map((e) => byDemo.get(e.id)).join(", ") || "–"}) |
| Nur Vorsortierung (Newsletter/Spam, ohne Sonnet) | ${results.filter((e) => e.aiModels.length === 1).length} |
| Fehlgeschlagen | ${results.filter((e) => e.aiStatus === "FAILED").length} |
| Gesamtkosten | **${usd(totalCost)}** (Ø ${usd(totalCost / n)} pro E-Mail) |
${models.map((m) => `| davon ${modelLabel(m)} | ${usd(sum((u) => Number(u.costUsd), (u) => u.model === m))} (${sum(() => 1, (u) => u.model === m)} Aufrufe) |`).join("\n")}
| Prompt-Cache gelesen / geschrieben | ${sum((u) => u.cacheReadTokens).toLocaleString("de-DE")} / ${sum((u) => u.cacheWriteTokens).toLocaleString("de-DE")} Token |
| Nicht gecachte Eingabe / Ausgabe | ${sum((u) => u.inputTokens).toLocaleString("de-DE")} / ${sum((u) => u.outputTokens).toLocaleString("de-DE")} Token |
| Wiederholte Versuche (ungültige Ausgabe) | ${usage.filter((u) => u.attempt > 1).length} |

„Erwartet“ ist eine menschliche Einschätzung (siehe \`scripts/ai-eval-demo.ts\`) – bei Priorität gibt es oft mehrere vertretbare Antworten.

## Ergebnisse pro E-Mail

| # | Postfach | Absender | Betreff | Kategorie (Sicherheit) | Priorität (Sicherheit) | Warnungen | KI-Zusammenfassung | Aufgaben | Modell | Kosten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Thread-Zusammenfassungen

${uniqueThreads.map((t) => `- **${cell(t.subject)}** (${t.messageCount} Nachrichten): ${cell(t.summary ?? "")}`).join("\n") || "–"}
`;

  const out = path.join(process.cwd(), "docs", dryRun ? "ki-trockenlauf.md" : "ki-qualitaetstest.md");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.log(`\nKategorie: ${catOk}/${n} · Priorität: ${prioOk}/${n} (±1: ${prioNear}/${n}) · Kosten: ${usd(totalCost)}`);
  console.log(`Bericht: ${out}`);

  if (!keep) {
    await db.organization.delete({ where: { id: org.id } });
    console.log("Testfirma gelöscht.");
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
