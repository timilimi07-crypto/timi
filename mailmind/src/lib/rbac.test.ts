import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "./rbac";

describe("Rollen & Berechtigungen", () => {
  it("Admin darf alles", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can("ADMIN", p)).toBe(true);
    }
  });

  it("Manager darf zuweisen und Regeln pflegen, aber keine Postfächer verwalten", () => {
    expect(can("MANAGER", "email.assign")).toBe(true);
    expect(can("MANAGER", "rules.manage")).toBe(true);
    expect(can("MANAGER", "mailbox.manage")).toBe(false);
    expect(can("MANAGER", "audit.read")).toBe(false);
  });

  it("Mitarbeiter darf E-Mails bearbeiten, aber nicht zuweisen oder löschen", () => {
    expect(can("MEMBER", "email.update")).toBe(true);
    expect(can("MEMBER", "email.assign")).toBe(false);
    expect(can("MEMBER", "email.delete")).toBe(false);
    expect(can("MEMBER", "settings.manage")).toBe(false);
  });
});
