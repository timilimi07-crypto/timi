// Spotify-Anbindung: Musik abspielen, steuern und suchen.
// Einmalige Anmeldung über OAuth; das Token liegt danach in data/spotify-token.json.

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { dataPath } from "./paths.js";

const TOKEN_FILE = dataPath("spotify-token.json");
const API = "https://api.spotify.com/v1";
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
];

let redirectUri = null;
let token = null; // { access_token, refresh_token, expires_at, scope }
const pendingStates = new Set();

export function configureSpotify(uri) {
  redirectUri = uri;
}

export function spotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function loadToken() {
  if (token) return token;
  try {
    token = JSON.parse(await fs.readFile(TOKEN_FILE, "utf8"));
  } catch {
    token = null;
  }
  return token;
}

async function saveToken(t) {
  token = t;
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(t, null, 2));
}

export async function spotifyConnected() {
  return spotifyConfigured() && Boolean(await loadToken());
}

export async function spotifyDisconnect() {
  token = null;
  await fs.rm(TOKEN_FILE, { force: true });
}

export function spotifyAuthUrl() {
  const state = randomUUID();
  pendingStates.add(state);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function tokenRequest(body) {
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || `Spotify ${res.status}`);
  return data;
}

export async function spotifyCallback(code, state) {
  if (!pendingStates.delete(state)) throw new Error("Ungültige Anmeldung, bitte noch einmal versuchen.");
  const data = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  await saveToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  });
}

async function accessToken() {
  const t = await loadToken();
  if (!t) return null;
  if (Date.now() < t.expires_at - 60000) return t.access_token;
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await saveToken({
    ...t,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? t.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

class SpotifyError extends Error {
  constructor(status, reason, message) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function api(method, pathAndQuery, body) {
  const at = await accessToken();
  if (!at) throw new SpotifyError(401, "NOT_CONNECTED", "Spotify ist nicht verbunden.");
  const res = await fetch(API + pathAndQuery, {
    method,
    headers: { Authorization: `Bearer ${at}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new SpotifyError(res.status, data?.error?.reason, data?.error?.message ?? `Spotify ${res.status}`);
  return data;
}

// ---------------------------------------------------------------------------
// Hilfen

function describeTrack(item) {
  if (!item) return null;
  return {
    titel: item.name,
    kuenstler: item.artists ? item.artists.map((a) => a.name).join(", ") : item.show?.name,
    album: item.album?.name,
    cover: item.album?.images?.[0]?.url ?? item.images?.[0]?.url,
    dauer_ms: item.duration_ms,
    uri: item.uri,
  };
}

export async function nowPlaying() {
  const state = await api("GET", "/me/player?additional_types=episode");
  if (!state) return { spielt: false, hinweis: "Gerade läuft nichts." };
  return {
    spielt: state.is_playing,
    titel: describeTrack(state.item),
    fortschritt_ms: state.progress_ms,
    geraet: state.device?.name,
    lautstaerke: state.device?.volume_percent,
    zufall: state.shuffle_state,
    wiederholen: state.repeat_state,
  };
}

// Wenn kein Gerät aktiv ist, das zuletzt bekannte nehmen.
async function fallbackDevice() {
  const { devices } = await api("GET", "/me/player/devices");
  const device = devices.find((d) => d.is_active) ?? devices[0];
  if (!device) {
    throw new SpotifyError(404, "NO_DEVICE", "Kein Spotify-Gerät gefunden. Der Nutzer soll Spotify auf Handy oder Computer kurz öffnen.");
  }
  return device.id;
}

async function withDevice(fn) {
  try {
    return await fn("");
  } catch (err) {
    if (err.status !== 404) throw err;
    const id = await fallbackDevice();
    return fn(`device_id=${encodeURIComponent(id)}`);
  }
}

const TYPES = { song: "track", kuenstler: "artist", album: "album", playlist: "playlist" };

async function search(query, art = "song", limit = 5) {
  const type = TYPES[art] ?? "track";
  const params = new URLSearchParams({ q: query, type, limit: String(limit) });
  const data = await api("GET", `/search?${params}`);
  return (data[`${type}s`]?.items ?? []).filter(Boolean);
}

async function findPlaylist(query) {
  // Eigene Playlists zuerst, dann öffentliche
  const mine = await api("GET", "/me/playlists?limit=50");
  const q = query.toLowerCase();
  const own = mine.items.filter(Boolean).find((p) => p.name.toLowerCase().includes(q));
  if (own) return own;
  return (await search(query, "playlist", 1))[0];
}

// ---------------------------------------------------------------------------
// Werkzeuge

export const SPOTIFY_TOOLS = [
  {
    name: "spotify_status",
    description: "Zeigt, was auf Spotify gerade läuft (Titel, Künstler, Gerät, Lautstärke).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "spotify_abspielen",
    description:
      "Spielt Musik auf Spotify ab. Mit suche wird gesucht und das beste Ergebnis gestartet (bei 'playlist' zuerst die eigenen Playlists des Nutzers). Ohne suche wird die Wiedergabe fortgesetzt.",
    input_schema: {
      type: "object",
      properties: {
        suche: { type: "string", description: "z. B. 'Get Lucky Daft Punk', 'Coldplay', 'Lernmusik'" },
        art: { type: "string", enum: ["song", "kuenstler", "album", "playlist"] },
      },
    },
  },
  {
    name: "spotify_steuern",
    description: "Steuert die Spotify-Wiedergabe.",
    input_schema: {
      type: "object",
      properties: {
        aktion: {
          type: "string",
          enum: ["pause", "fortsetzen", "weiter", "zurueck", "lautstaerke", "zufall_an", "zufall_aus", "wiederholen_an", "wiederholen_aus"],
        },
        lautstaerke: { type: "integer", description: "0 bis 100, nur bei aktion 'lautstaerke'" },
      },
      required: ["aktion"],
    },
  },
  {
    name: "spotify_warteschlange",
    description: "Sucht einen Song und hängt ihn an die Warteschlange an.",
    input_schema: { type: "object", properties: { suche: { type: "string" } }, required: ["suche"] },
  },
  {
    name: "spotify_suchen",
    description: "Sucht auf Spotify nach Songs, Künstlern, Alben oder Playlists, ohne etwas abzuspielen.",
    input_schema: {
      type: "object",
      properties: {
        suche: { type: "string" },
        art: { type: "string", enum: ["song", "kuenstler", "album", "playlist"] },
      },
      required: ["suche"],
    },
  },
];

export async function control(aktion, lautstaerke) {
  const q = (base, extra) => `${base}${base.includes("?") ? "&" : "?"}${extra}`;
  switch (aktion) {
    case "pause":
      await withDevice((d) => api("PUT", d ? q("/me/player/pause", d) : "/me/player/pause"));
      break;
    case "fortsetzen":
      await withDevice((d) => api("PUT", d ? q("/me/player/play", d) : "/me/player/play"));
      break;
    case "weiter":
      await withDevice((d) => api("POST", d ? q("/me/player/next", d) : "/me/player/next"));
      break;
    case "zurueck":
      await withDevice((d) => api("POST", d ? q("/me/player/previous", d) : "/me/player/previous"));
      break;
    case "lautstaerke": {
      const v = Math.min(100, Math.max(0, Math.round(Number(lautstaerke))));
      if (Number.isNaN(v)) return { fehler: "Lautstärke fehlt (0 bis 100)." };
      await withDevice((d) => api("PUT", q(`/me/player/volume?volume_percent=${v}`, d)));
      break;
    }
    case "zufall_an":
    case "zufall_aus":
      await withDevice((d) => api("PUT", q(`/me/player/shuffle?state=${aktion === "zufall_an"}`, d)));
      break;
    case "wiederholen_an":
    case "wiederholen_aus":
      await withDevice((d) => api("PUT", q(`/me/player/repeat?state=${aktion === "wiederholen_an" ? "context" : "off"}`, d)));
      break;
    default:
      return { fehler: `Unbekannte Aktion: ${aktion}` };
  }
  return { ok: true };
}

async function play(suche, art) {
  if (!suche) return control("fortsetzen");
  let body, label;
  if (art === "playlist") {
    const p = await findPlaylist(suche);
    if (!p) return { fehler: `Keine Playlist zu „${suche}“ gefunden.` };
    body = { context_uri: p.uri };
    label = `Playlist ${p.name}`;
  } else if (art === "kuenstler" || art === "album") {
    const hit = (await search(suche, art, 1))[0];
    if (!hit) return { fehler: `Nichts zu „${suche}“ gefunden.` };
    body = { context_uri: hit.uri };
    label = hit.name;
  } else {
    const hit = (await search(suche, "song", 1))[0];
    if (!hit) return { fehler: `Keinen Song zu „${suche}“ gefunden.` };
    body = { uris: [hit.uri] };
    label = `${hit.name} von ${hit.artists.map((a) => a.name).join(", ")}`;
  }
  await withDevice((d) => api("PUT", d ? `/me/player/play?${d}` : "/me/player/play", body));
  return { ok: true, spielt: label };
}

export async function executeSpotifyTool(name, input) {
  if (!spotifyConfigured() || !(await loadToken())) {
    return { fehler: "Spotify ist nicht verbunden. Der Nutzer soll es im Fenster 'Verbindungen' verbinden." };
  }
  try {
    switch (name) {
      case "spotify_status":
        return await nowPlaying();
      case "spotify_abspielen":
        return await play(input.suche?.trim(), input.art);
      case "spotify_steuern":
        return await control(input.aktion, input.lautstaerke);
      case "spotify_warteschlange": {
        const hit = (await search(input.suche, "song", 1))[0];
        if (!hit) return { fehler: `Keinen Song zu „${input.suche}“ gefunden.` };
        await withDevice((d) => api("POST", `/me/player/queue?uri=${encodeURIComponent(hit.uri)}${d ? "&" + d : ""}`));
        return { ok: true, eingereiht: `${hit.name} von ${hit.artists.map((a) => a.name).join(", ")}` };
      }
      case "spotify_suchen": {
        const items = await search(input.suche, input.art, 8);
        return {
          ergebnisse: items.map((i) => ({
            name: i.name,
            von: i.artists?.map((a) => a.name).join(", ") ?? i.owner?.display_name,
            uri: i.uri,
          })),
        };
      }
    }
  } catch (err) {
    return { fehler: spotifyMessage(err) };
  }
  return { fehler: `Unbekanntes Werkzeug: ${name}` };
}

export function spotifyMessage(err) {
  console.error("Spotify:", err.message);
  if (err.reason === "PREMIUM_REQUIRED" || err.status === 403) {
    return "Spotify erlaubt das Steuern der Wiedergabe nur mit Premium-Konto.";
  }
  if (err.status === 401) return "Die Spotify-Anmeldung ist abgelaufen. Der Nutzer muss Spotify neu verbinden.";
  if (err.reason === "NO_DEVICE") return err.message;
  return `Spotify meldet einen Fehler: ${err.message}`;
}
