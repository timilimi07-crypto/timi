import { describe, expect, it } from "vitest";
import { imapMailboxSchema, organizationSettingsSchema } from "./settings";

describe("Firmeneinstellungen", () => {
  it("akzeptiert Sonnet und Opus als Hauptmodell, Haiku als schnelles Modell", () => {
    expect(organizationSettingsSchema.safeParse({ aiModel: "claude-opus-5-5", aiModelFast: "claude-haiku-5-5" }).success).toBe(true);
    expect(organizationSettingsSchema.safeParse({ aiModel: null }).success).toBe(true);
  });

  it("lehnt Haiku als Hauptmodell ab", () => {
    const r = organizationSettingsSchema.safeParse({ aiModel: "claude-haiku-5-5" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("Hauptmodell");
  });

  it("begrenzt Zeitfenster und Limit", () => {
    expect(organizationSettingsSchema.safeParse({ initialSyncDays: 0 }).success).toBe(false);
    expect(organizationSettingsSchema.safeParse({ initialSyncDays: 400 }).success).toBe(false);
    expect(organizationSettingsSchema.safeParse({ maxEmailsPerSync: 5000 }).success).toBe(false);
    expect(organizationSettingsSchema.safeParse({ initialSyncDays: 30, maxEmailsPerSync: 100 }).success).toBe(true);
  });
});

describe("IMAP-Postfach", () => {
  it("setzt sinnvolle Standardwerte und normalisiert die Adresse", () => {
    const r = imapMailboxSchema.parse({ name: "Info", emailAddress: " Info@Firma.DE ", host: "imap.firma.de", username: "info", password: "x" });
    expect(r).toMatchObject({ emailAddress: "info@firma.de", port: 993, secure: true, folder: "INBOX", initialSyncDays: null });
  });

  it("meldet fehlende Pflichtfelder auf Deutsch", () => {
    const r = imapMailboxSchema.safeParse({ name: "Info", emailAddress: "info@firma.de", host: "", username: "u", password: "p" });
    expect(r.error?.issues[0]?.message).toBe("Bitte den IMAP-Server angeben");
  });
});
