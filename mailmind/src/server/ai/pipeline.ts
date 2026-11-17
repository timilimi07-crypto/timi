import { Prisma, type EntityType, type Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { modelForOperation, type AiOperation } from "@/lib/ai/models";
import type { AiAttempt, AiCaller, SystemBlock } from "./client";
import { maskSensitive } from "./mask";
import {
  ANALYSIS_INSTRUCTIONS,
  buildEmailMessage,
  buildOrgContext,
  MAX_BODY_CHARS_ANALYSIS,
  MAX_BODY_CHARS_TRIAGE,
  THREAD_INSTRUCTIONS,
  TRIAGE_INSTRUCTIONS,
} from "./prompts";
import { analysisSchema, parseDueDate, threadSummarySchema, triageSchema, type AnalysisResult } from "./schemas";
import { startOfBerlinDay } from "./time";

/**
 * KI-Pipeline pro E-Mail.
 *
 *  1. Vorsortierung (schnelles Modell, Standard Haiku 5.5): Kategorie + Sicherheit,
 *     Massen-E-Mail ja/nein, ein Satz Zusammenfassung.
 *  2. Newsletter/Spam (Kategorie mit „automatisch einklappen“) bei hoher
 *     Sicherheit → fertig, KEINE teure Hauptanalyse.
 *  3. Sonst Hauptanalyse (Standard Sonnet 5.5): Zusammenfassung, Kategorie,
 *     Priorität (+ Sicherheit, Begründung), Stimmung, Aufgaben, erkannte Daten.
 *  4. Geringe Sicherheit (< 0,7) bei Kategorie oder Priorität → „Bitte prüfen“.
 *
 * Jede E-Mail wird genau einmal ausgewertet (aiStatus DONE/SKIPPED wird nie
 * erneut verarbeitet). Neue Antworten in einem Thread aktualisieren nur die
 * Thread-Zusammenfassung – inkrementell (summarizeThread).
 */

/** Unterhalb dieser Selbsteinschätzung bekommt die E-Mail „Bitte prüfen“. */
export const REVIEW_THRESHOLD = 0.7;
/** So viele Korrekturen der Firma fließen als Beispiele in den Prompt. */
export const MAX_CORRECTION_EXAMPLES = 20;

export type PipelineDeps = { caller: AiCaller; now?: () => Date };

export type ProcessResult =
  | { status: "done"; path: "triage-only" | "full"; threadId: string | null; needsReview: boolean }
  | { status: "already" | "not_found" }
  | { status: "deferred"; until: Date; reason: string }
  | { status: "failed"; error: string; refused: boolean };

const PRIORITY_LABEL: Record<Priority, string> = { URGENT: "Dringend", HIGH: "Hoch", NORMAL: "Normal", LOW: "Niedrig" };

// ---------------------------------------------------------------------------

/** Firmenkontext (Kategorien + letzte Korrekturen) für den gecachten System-Block. */
export async function loadOrgContext(organizationId: string) {
  const [org, categories, corrections] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    db.category.findMany({ where: { organizationId }, orderBy: [{ sortOrder: "asc" }, { key: "asc" }] }),
    db.classificationCorrection.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: MAX_CORRECTION_EXAMPLES,
    }),
  ]);
  const text = buildOrgContext({
    organizationName: org.name,
    categories: categories.map((c) => ({ key: c.key, name: c.name, description: c.description })),
    corrections: corrections.map((c) => ({
      field: c.field,
      fromValue: c.fromValue,
      toValue: c.toValue,
      subject: c.subject,
      senderDomain: c.senderDomain,
    })),
  });
  return { org, categories, text };
}

function system(instructions: string, orgContext: string): SystemBlock[] {
  return [
    { text: instructions, cache: true }, // für alle Firmen gleich
    { text: orgContext, cache: true }, // für alle E-Mails einer Firma gleich
  ];
}

/** Schreibt einen Versuch ins Kostenprotokoll und summiert Kosten/Modelle an der E-Mail. */
function usageLogger(organizationId: string, emailId: string | null) {
  return async (a: AiAttempt) => {
    await db.aiUsageLog.create({
      data: {
        organizationId,
        emailId,
        operation: a.operation,
        model: a.model,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        cacheReadTokens: a.cacheReadTokens,
        cacheWriteTokens: a.cacheWriteTokens,
        costUsd: a.costUsd,
        durationMs: a.durationMs,
        attempt: a.attempt,
        success: a.success,
        error: a.error,
      },
    });
    // Modell auch bei 0 $ vermerken (z. B. vollständig aus dem Cache bedient).
    if (emailId && (a.success || a.costUsd > 0)) {
      await db.$executeRaw`
        UPDATE "Email"
        SET "aiCostUsd" = "aiCostUsd" + ${new Prisma.Decimal(a.costUsd)},
            "aiModels" = CASE WHEN ${a.model} = ANY("aiModels") THEN "aiModels" ELSE array_append("aiModels", ${a.model}) END
        WHERE id = ${emailId}`;
    }
  };
}

/** Wie viele E-Mails hat die Firma heute (Europe/Berlin) schon ausgewertet? */
export async function emailsProcessedToday(organizationId: string, now: Date): Promise<number> {
  return db.email.count({ where: { organizationId, aiProcessedAt: { gte: startOfBerlinDay(now) } } });
}

// ---------------------------------------------------------------------------

export async function processEmail(emailId: string, deps: PipelineDeps): Promise<ProcessResult> {
  const now = deps.now?.() ?? new Date();
  const email = await loadEmail(emailId);
  if (!email || email.deletedAt) return { status: "not_found" };
  // Genau einmal auswerten.
  if (email.aiStatus === "DONE" || email.aiStatus === "SKIPPED") return { status: "already" };

  const { org, categories, text: orgContext } = await loadOrgContext(email.organizationId);

  // KI-Tageslimit der Firma.
  if ((await emailsProcessedToday(org.id, now)) >= org.aiDailyEmailLimit) {
    const until = new Date(startOfBerlinDay(now).getTime() + 24 * 3600_000 + 5 * 60_000);
    await db.email.update({ where: { id: emailId }, data: { aiStatus: "PENDING", aiError: "KI-Tageslimit erreicht – Auswertung morgen" } });
    return { status: "deferred", until, reason: "daily_limit" };
  }

  // Sperre gegen parallele Verarbeitung derselben E-Mail.
  const claimed = await db.email.updateMany({
    where: { id: emailId, aiStatus: { in: ["PENDING", "FAILED", "PROCESSING"] } },
    data: { aiStatus: "PROCESSING", aiError: null },
  });
  if (claimed.count === 0) return { status: "already" };

  try {
    return await runPipeline(email, org, categories, orgContext, deps, now);
  } catch (err) {
    // API-Fehler (z. B. Überlastung nach allen SDK-Retries): Status zurücksetzen,
    // damit der nächste Job-Versuch die E-Mail wieder übernehmen kann.
    await db.email.update({
      where: { id: emailId },
      data: { aiStatus: "FAILED", aiError: `KI-Dienst nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}` },
    });
    throw err;
  }
}

type LoadedEmail = NonNullable<Awaited<ReturnType<typeof loadEmail>>>;
type OrgCtx = Awaited<ReturnType<typeof loadOrgContext>>;

function loadEmail(emailId: string) {
  return db.email.findUnique({
    where: { id: emailId },
    include: { mailbox: { select: { name: true } }, attachments: { select: { filename: true } }, thread: true },
  });
}

async function runPipeline(
  email: LoadedEmail,
  org: OrgCtx["org"],
  categories: OrgCtx["categories"],
  orgContext: string,
  deps: PipelineDeps,
  now: Date,
): Promise<ProcessResult> {
  const emailId = email.id;
  const mask = (s: string) => (org.maskSensitiveData ? maskSensitive(s).text : s);
  const addr = (v: Prisma.JsonValue) =>
    (Array.isArray(v) ? (v as { email: string; name?: string }[]) : []).map((a) => (a.name ? `${a.name} <${a.email}>` : a.email));
  const promptEmail = {
    receivedAt: email.receivedAt,
    mailboxName: email.mailbox.name,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    to: addr(email.to),
    cc: addr(email.cc),
    subject: mask(email.subject),
    attachments: email.attachments.map((a) => a.filename),
    body: mask(email.bodyText),
  };
  const keys = categories.map((c) => c.key);
  const log = usageLogger(org.id, emailId);
  const model = (op: AiOperation) => modelForOperation(op, org);

  // --- 1. Vorsortierung -----------------------------------------------------
  const triage = await deps.caller({
    operation: "triage",
    model: model("triage"),
    system: system(TRIAGE_INSTRUCTIONS, orgContext),
    user: buildEmailMessage(promptEmail, { maxBodyChars: MAX_BODY_CHARS_TRIAGE }),
    schema: triageSchema(keys),
    maxTokens: 2_000,
    effort: "low",
    onAttempt: log,
  });
  if (!triage.ok) return fail(emailId, triage.error, triage.refused);

  const triageCategory = categories.find((c) => c.key === triage.data.category)!;
  const keepManual = email.manualOverride;

  // --- 2. Newsletter/Spam: ohne Hauptanalyse abschließen ---------------------
  if (triageCategory.autoCollapse && triage.data.categoryConfidence >= REVIEW_THRESHOLD) {
    await db.email.update({
      where: { id: emailId },
      data: {
        aiStatus: "DONE",
        aiProcessedAt: now,
        summary: triage.data.summary,
        isCollapsed: true,
        sentiment: "NEUTRAL",
        ...(keepManual
          ? {}
          : {
              categoryId: triageCategory.id,
              categoryConfidence: triage.data.categoryConfidence,
              priority: "LOW",
              priorityConfidence: triage.data.categoryConfidence,
              priorityReason: `${triageCategory.name} – kein Handlungsbedarf`,
              needsReview: false,
              reviewReason: null,
            }),
      },
    });
    return { status: "done", path: "triage-only", threadId: email.threadId, needsReview: false };
  }

  // --- 3. Hauptanalyse --------------------------------------------------------
  const triageHint = `Kategorie ${triage.data.category} (Sicherheit ${triage.data.categoryConfidence.toFixed(2)})${triage.data.isBulk ? ", vermutlich Massen-E-Mail" : ""}`;
  const analysis = await deps.caller({
    operation: "analyze",
    model: model("analyze"),
    system: system(ANALYSIS_INSTRUCTIONS, orgContext),
    user: buildEmailMessage(promptEmail, {
      maxBodyChars: MAX_BODY_CHARS_ANALYSIS,
      threadSummary: email.thread && email.thread.messageCount > 1 ? email.thread.summary : null,
      triageHint,
    }),
    schema: analysisSchema(keys),
    maxTokens: 8_000,
    effort: "medium",
    onAttempt: log,
  });
  if (!analysis.ok) return fail(emailId, analysis.error, analysis.refused);

  const needsReview = await saveAnalysis(emailId, org.id, analysis.data, categories, keepManual, now);
  return { status: "done", path: "full", threadId: email.threadId, needsReview };
}

/** „Bitte prüfen“, wenn Kategorie oder Priorität unsicher sind. */
export function reviewDecision(a: Pick<AnalysisResult, "categoryConfidence" | "priorityConfidence">): string | null {
  const reasons: string[] = [];
  if (a.categoryConfidence < REVIEW_THRESHOLD) reasons.push(`Kategorie unsicher (${Math.round(a.categoryConfidence * 100)} %)`);
  if (a.priorityConfidence < REVIEW_THRESHOLD) reasons.push(`Priorität unsicher (${Math.round(a.priorityConfidence * 100)} %)`);
  return reasons.length ? reasons.join(", ") : null;
}

async function saveAnalysis(
  emailId: string,
  organizationId: string,
  a: AnalysisResult,
  categories: { id: string; key: string; autoCollapse: boolean }[],
  keepManual: boolean,
  now: Date,
): Promise<boolean> {
  const category = categories.find((c) => c.key === a.category)!;
  const reviewReason = keepManual ? null : reviewDecision(a);

  await db.$transaction([
    db.task.deleteMany({ where: { emailId, source: "AI" } }),
    db.extractedEntity.deleteMany({ where: { emailId } }),
    db.email.update({
      where: { id: emailId },
      data: {
        aiStatus: "DONE",
        aiProcessedAt: now,
        aiError: null,
        summary: a.summary,
        sentiment: a.sentiment,
        isCollapsed: category.autoCollapse,
        ...(keepManual
          ? {}
          : {
              categoryId: category.id,
              categoryConfidence: a.categoryConfidence,
              priority: a.priority,
              priorityConfidence: a.priorityConfidence,
              priorityReason: a.priorityReason,
              needsReview: reviewReason !== null,
              reviewReason,
            }),
        tasks: {
          create: a.tasks
            .filter((t) => t.title.trim())
            .slice(0, 10)
            .map((t) => ({
              organizationId,
              title: t.title.trim().slice(0, 200),
              dueDate: parseDueDate(t.dueDate),
              dueDateText: t.dueDateText,
              source: "AI" as const,
            })),
        },
        entities: {
          create: a.entities
            .filter((e) => e.value.trim() && !/^\[(IBAN|TELEFON|KARTENNUMMER)\]$/.test(e.value.trim()))
            .slice(0, 30)
            .map((e) => ({
              type: e.type as EntityType,
              label: e.label.slice(0, 80),
              value: e.value.slice(0, 300),
              normalizedValue: e.normalizedValue,
            })),
        },
      },
    }),
  ]);
  return reviewReason !== null;
}

async function fail(emailId: string, error: string, refused: boolean): Promise<ProcessResult> {
  await db.email.update({
    where: { id: emailId },
    data: {
      aiStatus: "FAILED",
      aiError: error,
      ...(refused ? { needsReview: true, reviewReason: "KI hat die Auswertung abgelehnt – bitte manuell einordnen" } : {}),
    },
  });
  return { status: "failed", error, refused };
}

// ---------------------------------------------------------------------------
// Thread-Zusammenfassung (inkrementell)
// ---------------------------------------------------------------------------

export type ThreadResult = { status: "updated"; mode: "initial" | "incremental"; newEmails: number } | { status: "skipped"; reason: string };

/**
 * Aktualisiert die Zusammenfassung eines Verlaufs. Bereits berücksichtigte
 * E-Mails (bis `summarizedUntil`) werden NICHT erneut gesendet – nur die
 * bisherige Zusammenfassung + die neuen Nachrichten (deren Einzel-
 * Zusammenfassung und gekürzter Text).
 */
export async function summarizeThread(threadId: string, deps: PipelineDeps): Promise<ThreadResult> {
  const now = deps.now?.() ?? new Date();
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: {
      emails: {
        where: { deletedAt: null, aiStatus: "DONE" },
        orderBy: { receivedAt: "asc" },
        select: { id: true, receivedAt: true, fromName: true, fromEmail: true, subject: true, summary: true, bodyText: true },
      },
    },
  });
  if (!thread) return { status: "skipped", reason: "not_found" };
  if (thread.emails.length < 2) return { status: "skipped", reason: "single_email" };

  const fresh = thread.summarizedUntil
    ? thread.emails.filter((e) => e.receivedAt > thread.summarizedUntil!)
    : thread.emails;
  if (fresh.length === 0) return { status: "skipped", reason: "up_to_date" };

  const { org, text: orgContext } = await loadOrgContext(thread.organizationId);
  const mask = (s: string) => (org.maskSensitiveData ? maskSensitive(s).text : s);
  const newest = fresh[fresh.length - 1]!;
  const fmt = (e: (typeof fresh)[number], withText: boolean) =>
    [
      `- ${e.receivedAt.toISOString().slice(0, 16).replace("T", " ")} UTC, ${e.fromName ?? e.fromEmail}: ${mask(e.summary ?? e.subject)}`,
      ...(withText ? [`  Wortlaut (gekürzt): ${mask(e.bodyText).replace(/\s+/g, " ").slice(0, 1500)}`] : []),
    ].join("\n");

  const incremental = !!thread.summary && !!thread.summarizedUntil;
  const user = incremental
    ? `Betreff des Verlaufs: ${mask(thread.subject)}\n\nBisherige Zusammenfassung:\n${thread.summary}\n\nNeue Nachrichten seitdem:\n${fresh.map((e) => fmt(e, e.id === newest.id)).join("\n")}\n\nAktualisiere die Zusammenfassung.`
    : `Betreff des Verlaufs: ${mask(thread.subject)}\n\nNachrichten (älteste zuerst):\n${thread.emails.map((e) => fmt(e, e.id === newest.id)).join("\n")}\n\nFasse den Verlauf zusammen.`;

  const result = await deps.caller({
    operation: "thread_summary",
    model: modelForOperation("thread_summary", org),
    system: system(THREAD_INSTRUCTIONS, orgContext),
    user,
    schema: threadSummarySchema,
    maxTokens: 2_000,
    effort: "low",
    // Kosten der Thread-Zusammenfassung werden der auslösenden (neuesten) E-Mail zugerechnet.
    onAttempt: usageLogger(org.id, newest.id),
  });
  if (!result.ok) return { status: "skipped", reason: result.error };

  await db.thread.update({
    where: { id: threadId },
    data: { summary: result.data.summary, summaryUpdatedAt: now, summarizedUntil: newest.receivedAt },
  });
  return { status: "updated", mode: incremental ? "incremental" : "initial", newEmails: fresh.length };
}

// ---------------------------------------------------------------------------
// Manuelle Korrekturen
// ---------------------------------------------------------------------------

export function senderDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "unbekannt";
}

/**
 * Speichert eine manuelle Korrektur (Kategorie/Priorität). Sie fließt ab dem
 * nächsten KI-Aufruf als Beispiel in den Firmenkontext ein.
 */
export async function recordCorrection(input: {
  organizationId: string;
  emailId: string;
  userId: string;
  field: "category" | "priority";
  fromValue: string | null;
  toValue: string;
  subject: string;
  fromEmail: string;
  mask: boolean;
}) {
  if (input.fromValue === input.toValue) return null;
  const subject = (input.mask ? maskSensitive(input.subject).text : input.subject).replace(/\s+/g, " ").trim().slice(0, 120);
  return db.classificationCorrection.create({
    data: {
      organizationId: input.organizationId,
      emailId: input.emailId,
      userId: input.userId,
      field: input.field,
      fromValue: input.fromValue,
      toValue: input.toValue,
      subject,
      senderDomain: senderDomain(input.fromEmail),
    },
  });
}

export { PRIORITY_LABEL };
