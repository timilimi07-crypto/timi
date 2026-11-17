// Wählt die KI: Claude, wenn ein API-Schlüssel da ist, sonst die lokale Auswertung.
import { analyzeLocal, digestLocal, threadSummaryLocal } from "./local.js";

const useClaude = () => Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_PROVIDER !== "local";

let claude = null;
async function loadClaude() {
  claude ??= await import("./claude.js");
  return claude;
}

export function providerName() {
  return useClaude() ? `Claude (${process.env.AI_MODEL || "claude-opus-5-5"})` : "Lokal (Regeln)";
}

async function withFallback(label, viaClaude, viaLocal) {
  if (!useClaude()) return { result: viaLocal(), by: "lokal" };
  try {
    return { result: await viaClaude(await loadClaude()), by: "claude" };
  } catch (err) {
    console.warn(`[KI] ${label} fehlgeschlagen, nutze lokale Auswertung:`, err.message);
    return { result: viaLocal(), by: "lokal (Rückfall)" };
  }
}

export function analyze(email, company, departments, history) {
  return withFallback("Analyse",
    (c) => c.analyzeClaude(email, company, departments, history),
    () => analyzeLocal(email, company, departments));
}

export function digest(company, stats, items, periodLabel) {
  return withFallback("Zusammenfassung",
    (c) => c.digestClaude(company, stats, items, periodLabel),
    () => digestLocal(company, stats, items, periodLabel));
}

export function threadSummary(emails) {
  return withFallback("Verlauf",
    (c) => c.threadSummaryClaude(emails),
    () => threadSummaryLocal(emails));
}
