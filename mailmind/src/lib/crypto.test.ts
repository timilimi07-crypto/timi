import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, decryptJson, encrypt, encryptJson } from "./crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("crypto (AES-256-GCM)", () => {
  it("verschlüsselt und entschlüsselt Text verlustfrei", () => {
    const secret = "IMAP-Passwort mit Ümläuten & Sonderzeichen!";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decrypt(enc)).toBe(secret);
  });

  it("erzeugt bei gleichem Klartext unterschiedliche Chiffrate (zufälliger IV)", () => {
    expect(encrypt("abc")).not.toBe(encrypt("abc"));
  });

  it("erkennt Manipulation am Chiffrat", () => {
    const enc = encrypt("geheim");
    const buf = Buffer.from(enc.slice(3), "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decrypt(`v1:${buf.toString("base64")}`)).toThrow();
  });

  it("unterstützt JSON-Objekte", () => {
    const creds = { host: "imap.example.de", port: 993, user: "info", password: "x" };
    expect(decryptJson(encryptJson(creds))).toEqual(creds);
  });

  it("lehnt einen falsch langen Schlüssel ab", () => {
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from("zu-kurz").toString("base64");
    expect(() => encrypt("x")).toThrow(/32 Byte/);
    process.env.ENCRYPTION_KEY = original;
  });
});
