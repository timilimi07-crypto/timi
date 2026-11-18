/**
 * CLI:  pnpm analyse ./rechnung.(xml|pdf) [--ohne-validator]
 * Gibt die Analyse als lesbares JSON aus. Validator-Adresse über VALIDATOR_URL (Standard http://localhost:8081).
 * Exit-Code: 0 = ok/warnungen/keine_e_rechnung/pruefung_ausstehend, 2 = fehlerhaft, 1 = Aufruf-/Lesefehler.
 */
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { analyseInvoice } from "./analyse.js";

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a) => !a.startsWith("--"));
  const noValidator = argv.includes("--ohne-validator");
  const file = args[0];
  if (!file) {
    console.error("Aufruf: pnpm analyse <datei.xml|datei.pdf> [--ohne-validator]");
    return 1;
  }
  // pnpm führt Root-Skripte im Projekt-Root aus; INIT_CWD ist das Verzeichnis des Aufrufs.
  const path = resolve(process.env["INIT_CWD"] ?? process.cwd(), file);
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch {
    console.error(`Datei nicht lesbar: ${path}`);
    return 1;
  }
  const analysis = await analyseInvoice(
    bytes,
    basename(path),
    noValidator ? { validator: null } : {},
  );
  console.log(JSON.stringify(analysis, null, 2));
  return analysis.status === "fehlerhaft" ? 2 : 0;
}

process.exitCode = await main(process.argv.slice(2));
