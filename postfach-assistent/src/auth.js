// Anmeldung, Sitzungen und Verschlüsselung gespeicherter Postfach-Passwörter.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { one, run } from "./db.js";

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = (stored || "").split("$");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

const SESSION_DAYS = 7;

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  run(db, "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", token, userId, expires);
  return token;
}

export function userFromToken(db, token) {
  if (!token) return null;
  return one(db, `SELECT u.id, u.company_id, u.department_id, u.name, u.email, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=? AND s.expires_at > ?`, token, new Date().toISOString()) || null;
}

export function destroySession(db, token) {
  run(db, "DELETE FROM sessions WHERE token=?", token);
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((c) => c.trim().split("=")).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
}

// Postfach-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert.
let key = null;
function secretKey() {
  if (key) return key;
  if (process.env.APP_SECRET) {
    key = crypto.createHash("sha256").update(process.env.APP_SECRET).digest();
  } else {
    const file = process.env.SECRET_FILE || "data/secret.key";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
    key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  }
  return key;
}

export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1:${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(blob) {
  if (!blob || !blob.startsWith("v1:")) return blob;
  const [, iv, tag, data] = blob.split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "hex"));
  d.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([d.update(Buffer.from(data, "hex")), d.final()]).toString("utf8");
}
