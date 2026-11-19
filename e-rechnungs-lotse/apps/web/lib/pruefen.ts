import "server-only";
import { analyseInvoice, buildCheckView, createValidatorClient, type CheckView } from "@erl/core";
import { explainOptions } from "./explainer";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PruefErgebnis = { ok: true; view: CheckView } | { ok: false; fehler: string };

/**
 * Prüfmodus: Die Datei wird ausschließlich im Arbeitsspeicher verarbeitet.
 * Es wird NICHTS gespeichert – keine Datei im Objektspeicher, kein Eintrag in der Datenbank,
 * keine temporäre Datei, kein Log mit Inhalten. Nach der Analyse wird der Puffer überschrieben.
 */
export async function pruefeDatei(file: File | null): Promise<PruefErgebnis> {
  if (!file || file.size === 0) {
    return { ok: false, fehler: "Bitte wählen Sie eine Rechnungsdatei aus (XML oder PDF)." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      fehler: "Die Datei ist größer als 10 MB. Bitte wählen Sie eine kleinere Datei.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const analysis = await analyseInvoice(bytes, file.name || "rechnung", {
      maxBytes: MAX_UPLOAD_BYTES,
      validator: createValidatorClient({
        baseUrl: process.env["VALIDATOR_URL"] ?? "http://localhost:8081",
        timeoutMs: 20_000,
      }),
    });
    return { ok: true, view: await buildCheckView(analysis, await explainOptions()) };
  } catch {
    // Keine Details loggen – sie könnten Rechnungsinhalte enthalten.
    return {
      ok: false,
      fehler: "Die Datei konnte nicht geprüft werden. Bitte versuchen Sie es erneut.",
    };
  } finally {
    bytes.fill(0);
  }
}
