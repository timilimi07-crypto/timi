// Passwortschutz für den Cloud-Betrieb (z. B. für die Nutzung auf dem iPad).
// Lokal auf dem eigenen Rechner ist er aus; im Internet ist er Pflicht.

import crypto from "crypto";

const COOKIE = "timi_sitzung";
const MAX_AGE_DAYS = 30;

// Fehlversuche pro IP begrenzen: höchstens 8 in 15 Minuten.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function secret() {
  // Ohne eigenes Geheimnis wird es aus dem Passwort abgeleitet – ändert sich das
  // Passwort, sind damit auch alle alten Anmeldungen ungültig.
  return process.env.TIMI_SESSION_SECRET || `timi:${process.env.TIMI_PASSWORT}`;
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

function validSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !safeEqual(sig, sign(expires))) return false;
  return Number(expires) > Date.now();
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}

const PUBLIC_PATHS = new Set(["/login", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"]);

export function authMiddleware() {
  return (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path) || validSession(req)) return next();
    // Rückleitungen von Google, Spotify usw. kommen ohne Anmeldung nicht durch.
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Nicht angemeldet." });
    res.redirect("/login");
  };
}

export function loginRoutes(app, { secure }) {
  app.get("/login", (_req, res) => res.send(loginPage()));

  app.post("/login", (req, res) => {
    const ip = req.ip ?? "unbekannt";
    if (tooManyAttempts(ip)) {
      return res.status(429).send(loginPage("Zu viele Versuche. Bitte in 15 Minuten noch einmal."));
    }
    if (!safeEqual(req.body?.passwort ?? "", process.env.TIMI_PASSWORT)) {
      attempts.get(ip).push(Date.now());
      return res.status(401).send(loginPage("Falsches Passwort."));
    }
    attempts.delete(ip);
    const expires = String(Date.now() + MAX_AGE_DAYS * 86400000);
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${expires}.${sign(expires)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_DAYS * 86400}${secure ? "; Secure" : ""}`,
    );
    res.redirect("/");
  });

  app.post("/api/abmelden", (_req, res) => {
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
    res.json({ ok: true });
  });
}

function loginPage(error = "") {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#01070d" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Timi" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<title>T.I.M.I. – Anmelden</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(ellipse at 50% 40%, rgba(20,110,150,.35), transparent 65%), #01070d;
    color: #d4f7ff; font: 500 17px/1.4 system-ui, sans-serif; }
  form { width: min(360px, 100%); display: grid; gap: 14px; padding: 28px; text-align: center;
    border: 1px solid rgba(62,232,255,.35); background: rgba(4,22,36,.7);
    clip-path: polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px); }
  img { width: 96px; height: 96px; margin: 0 auto; filter: drop-shadow(0 0 18px rgba(62,232,255,.6)); }
  h1 { margin: 0; font-size: 22px; letter-spacing: .35em; color: #3ee8ff; }
  input { font: inherit; padding: 12px; color: #fff; background: rgba(0,0,0,.35);
    border: 1px solid rgba(62,232,255,.35); text-align: center; }
  button { font: inherit; font-weight: 700; letter-spacing: .15em; padding: 12px; cursor: pointer;
    color: #01070d; background: #3ee8ff; border: 0; }
  .err { color: #ffb547; margin: 0; }
</style></head>
<body><form method="post" action="/login">
  <img src="/icons/icon.svg" alt="" />
  <h1>T.I.M.I.</h1>
  ${error ? `<p class="err">${esc(error)}</p>` : ""}
  <input type="password" name="passwort" placeholder="Passwort" autocomplete="current-password" autofocus required />
  <button type="submit">ANMELDEN</button>
</form></body></html>`;
}
