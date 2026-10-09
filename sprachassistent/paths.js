// Wo Timi seine Dateien findet und speichert – als Entwicklungsversion
// (npm start) genauso wie als fertige App (eine einzelne ausführbare Datei).

import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

// Als fertige App läuft der Code gebündelt; dann gibt es import.meta.url nicht.
export const IS_PACKAGED = (() => {
  try {
    // eslint-disable-next-line no-undef
    return typeof require === "function" && require("node:sea").isSea();
  } catch {
    return false;
  }
})();

export const APP_DIR = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();

function defaultDataDir() {
  if (!IS_PACKAGED) return path.join(APP_DIR, "data");
  const home = os.homedir();
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Timi");
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "Timi");
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "timi");
}

export const DATA_DIR = process.env.TIMI_DATA_DIR ?? defaultDataDir();
export const dataPath = (...parts) => path.join(DATA_DIR, ...parts);

// ---------------------------------------------------------------------------
// Einstellungen, die in der App eingegeben werden (statt in einer .env-Datei)

export const SETTING_KEYS = [
  "ANTHROPIC_API_KEY",
  "ASSISTANT_NAME",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
];
const SETTINGS_FILE = dataPath("einstellungen.json");

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

// Beim Start: gespeicherte Einstellungen übernehmen, wo nichts per Umgebung gesetzt ist.
export function loadSettings() {
  for (const [key, value] of Object.entries(readSettings())) {
    if (SETTING_KEYS.includes(key) && value && !process.env[key]) process.env[key] = value;
  }
}

export function saveSettings(changes) {
  const current = readSettings();
  for (const key of SETTING_KEYS) {
    if (!(key in changes)) continue;
    const value = String(changes[key] ?? "").trim();
    if (value) {
      current[key] = value;
      process.env[key] = value;
    } else {
      delete current[key];
      delete process.env[key];
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), { mode: 0o600 });
}
