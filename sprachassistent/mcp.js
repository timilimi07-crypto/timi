// Verbindungen zu weiteren Diensten (Notion, Canva, …) über das Model Context Protocol.
// Jeder Dienst wird einmal per Knopfdruck angemeldet; die Zugangsdaten liegen in data/mcp/.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, "data", "mcp");
const LIST_FILE = path.join(here, "data", "verbindungen.json");
const DEFAULT_LIST = path.join(here, "verbindungen.standard.json");

let redirectUrl = null;
export function configureMcp(uri) {
  redirectUrl = uri;
}

// ---------------------------------------------------------------------------
// Liste der Dienste (Standardliste + eigene Ergänzungen)

export async function listConnectors() {
  try {
    return JSON.parse(await fs.readFile(LIST_FILE, "utf8"));
  } catch {
    return JSON.parse(await fs.readFile(DEFAULT_LIST, "utf8"));
  }
}

async function saveConnectors(list) {
  await fs.mkdir(path.dirname(LIST_FILE), { recursive: true });
  await fs.writeFile(LIST_FILE, JSON.stringify(list, null, 2));
}

export async function addConnector(name, url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Die Adresse muss mit https:// beginnen.");
  const list = await listConnectors();
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "dienst";
  while (list.some((c) => c.id === id)) id += "_";
  list.push({ id, name, url: parsed.href });
  await saveConnectors(list);
  return id;
}

export async function removeConnector(id) {
  await disconnectConnector(id);
  await saveConnectors((await listConnectors()).filter((c) => c.id !== id));
}

// ---------------------------------------------------------------------------
// OAuth-Zugangsdaten pro Dienst in einer Datei

class FileAuthProvider {
  constructor(id) {
    this.id = id;
    this.file = path.join(DATA_DIR, `${id}.json`);
    this.pendingUrl = null;
  }
  async read() {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  async write(patch) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify({ ...(await this.read()), ...patch }, null, 2));
  }
  get redirectUrl() {
    return redirectUrl;
  }
  get clientMetadata() {
    return {
      client_name: "Timi Sprachassistent",
      redirect_uris: [redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }
  state() {
    return this.id;
  }
  async clientInformation() {
    return (await this.read()).client;
  }
  async saveClientInformation(client) {
    await this.write({ client });
  }
  async tokens() {
    return (await this.read()).tokens;
  }
  async saveTokens(tokens) {
    await this.write({ tokens, connected: true });
  }
  redirectToAuthorization(url) {
    this.pendingUrl = url.href;
  }
  async saveCodeVerifier(codeVerifier) {
    await this.write({ codeVerifier });
  }
  async codeVerifier() {
    return (await this.read()).codeVerifier;
  }
  async invalidateCredentials(scope) {
    const data = await this.read();
    if (scope === "all" || scope === "client") delete data.client;
    if (scope === "all" || scope === "tokens") delete data.tokens;
    if (scope === "all" || scope === "verifier") delete data.codeVerifier;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Verbinden

const clients = new Map(); // id -> { client, tools }

async function findConnector(id) {
  const c = (await listConnectors()).find((x) => x.id === id);
  if (!c) throw new Error(`Unbekannter Dienst: ${id}`);
  return c;
}

async function openClient(connector, provider) {
  const transport = new StreamableHTTPClientTransport(new URL(connector.url), { authProvider: provider });
  const client = new Client({ name: "timi", version: "1.0.0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const entry = { client, tools };
  clients.set(connector.id, entry);
  await provider.write({ connected: true });
  return entry;
}

// Startet die Verbindung. Gibt eine Anmelde-Adresse zurück, falls sich der Nutzer anmelden muss.
export async function startConnect(id) {
  const connector = await findConnector(id);
  const provider = new FileAuthProvider(id);
  try {
    await openClient(connector, provider);
    return { connected: true };
  } catch (err) {
    if (err instanceof UnauthorizedError && provider.pendingUrl) return { authUrl: provider.pendingUrl };
    throw err;
  }
}

export async function finishConnect(id, code) {
  const connector = await findConnector(id);
  const provider = new FileAuthProvider(id);
  const transport = new StreamableHTTPClientTransport(new URL(connector.url), { authProvider: provider });
  await transport.finishAuth(code);
  await openClient(connector, provider);
}

export async function disconnectConnector(id) {
  const entry = clients.get(id);
  clients.delete(id);
  await entry?.client.close().catch(() => {});
  await fs.rm(path.join(DATA_DIR, `${id}.json`), { force: true });
}

async function isMarkedConnected(id) {
  return Boolean((await new FileAuthProvider(id).read()).connected);
}

const lastFailure = new Map(); // id -> Zeitpunkt; verhindert ständige Neuversuche bei Störungen

async function ensureClient(connector) {
  if (clients.has(connector.id)) return clients.get(connector.id);
  if (!(await isMarkedConnected(connector.id))) return null;
  if (Date.now() - (lastFailure.get(connector.id) ?? 0) < 60000) return null;
  try {
    return await openClient(connector, new FileAuthProvider(connector.id));
  } catch (err) {
    lastFailure.set(connector.id, Date.now());
    console.error(`${connector.name}: Verbindung fehlgeschlagen –`, err.message);
    return null;
  }
}

export async function connectorStatus() {
  const list = await listConnectors();
  return Promise.all(
    list.map(async (c) => ({
      ...c,
      connected: clients.has(c.id) || (await isMarkedConnected(c.id)),
      tools: clients.get(c.id)?.tools.length ?? null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Werkzeuge für Claude

const SEP = "__";
const toolMap = new Map(); // Claude-Werkzeugname -> { id, name }

function claudeName(id, toolName) {
  return `${id}${SEP}${toolName}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

export function isMcpTool(name) {
  return toolMap.has(name);
}

function cleanSchema(schema) {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const { $schema, ...rest } = schema;
  return { type: "object", properties: {}, ...rest };
}

export async function mcpTools() {
  const list = await listConnectors();
  const tools = [];
  for (const connector of list) {
    const entry = await ensureClient(connector);
    if (!entry) continue;
    for (const t of entry.tools) {
      const name = claudeName(connector.id, t.name);
      toolMap.set(name, { id: connector.id, name: t.name });
      tools.push({
        name,
        description: `[${connector.name}] ${t.description ?? t.name}`.slice(0, 1024),
        input_schema: cleanSchema(t.inputSchema),
      });
    }
  }
  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

export async function executeMcpTool(name, input) {
  const target = toolMap.get(name);
  if (!target) return { fehler: `Unbekanntes Werkzeug: ${name}` };
  const connector = await findConnector(target.id);
  const entry = await ensureClient(connector);
  if (!entry) return { fehler: `${connector.name} ist nicht verbunden. Der Nutzer soll es im Fenster 'Verbindungen' verbinden.` };
  try {
    const result = await entry.client.callTool({ name: target.name, arguments: input ?? {} });
    const text = (result.content ?? [])
      .map((part) => (part.type === "text" ? part.text : part.type === "resource" ? part.resource?.text ?? "" : `[${part.type}]`))
      .join("\n");
    const out = text || JSON.stringify(result.structuredContent ?? {});
    return result.isError ? { fehler: out } : out.length > 30000 ? out.slice(0, 30000) + "\n[…gekürzt]" : out;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      clients.delete(target.id);
      return { fehler: `Die Anmeldung bei ${connector.name} ist abgelaufen. Der Nutzer muss es neu verbinden.` };
    }
    return { fehler: `${connector.name} meldet einen Fehler: ${err.message}` };
  }
}
