import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ValidatorClient, ValidatorResult } from "../src/index";

export const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));

/** Textinhalt einer Fixture-Datei relativ zu fixtures/ (z. B. "synthetic/xrechnung-ubl-minimal.xml"). */
export function fixture(path: string): string {
  return readFileSync(FIXTURES + path, "utf8");
}

export function fixtureBytes(path: string): Buffer {
  return readFileSync(FIXTURES + path);
}

export function listFixtures(dir: string): string[] {
  return readdirSync(FIXTURES + dir)
    .filter((f) => !f.endsWith(".md"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

/** Validator-Attrappe, die immer das gegebene Ergebnis liefert. */
export function stubValidator(
  result: Partial<Extract<ValidatorResult, { status: "geprueft" }>> = {},
): ValidatorClient {
  return {
    validate: async () => ({
      status: "geprueft",
      accepted: true,
      scenario: "Testszenario",
      engine: "KoSIT Validator (Attrappe)",
      findings: [],
      reportXml: "",
      ...result,
    }),
  };
}
