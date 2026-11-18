/**
 * Regressionstest für eine Fehlerklasse, die zweimal aufgetreten ist:
 * Server-Komponenten dürfen aus "use client"-Modulen nur Komponenten
 * (PascalCase) und Typen importieren – keine Funktionen oder Konstanten.
 * Sonst stürzt die Seite erst zur Laufzeit ab („Attempted to call … from the server“).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

const isClient = (src: string) => /^\s*["']use client["']/.test(src);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

describe("Client/Server-Grenze", () => {
  it("Server-Module importieren aus Client-Modulen nur Komponenten und Typen", () => {
    const all = files(SRC);
    const sources = new Map(all.map((f) => [f, readFileSync(f, "utf8")]));
    const violations: string[] = [];
    for (const [file, src] of sources) {
      if (isClient(src)) continue;
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        if (m[1]) continue; // reiner Typ-Import
        const target = resolveImport(file, m[3]!);
        if (!target || !isClient(sources.get(target) ?? "")) continue;
        for (const raw of m[2]!.split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/)[0]!;
          if (!/^[A-Z]/.test(local)) violations.push(`${path.relative(SRC, file)}: „${local}“ aus Client-Modul ${path.relative(SRC, target)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
