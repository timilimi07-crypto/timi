// Datenbank-Schicht (SQLite, eingebaut in Node 22).
// Jede Tabelle mit Firmendaten hat eine company_id. Alle Abfragen der App
// filtern danach, damit Firmen niemals die Daten anderer Firmen sehen.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'start',          -- start | team | business
  tone TEXT NOT NULL DEFAULT 'freundlich und professionell, Sie-Form',
  signature TEXT NOT NULL DEFAULT '',
  knowledge TEXT NOT NULL DEFAULT '',           -- Firmenwissen: Preise, Zeiten, Abläufe
  followup_hours INTEGER NOT NULL DEFAULT 48,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'           -- admin | member
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'demo',            -- demo | imap | webhook
  imap_host TEXT, imap_port INTEGER, imap_user TEXT, imap_pass TEXT, imap_tls INTEGER DEFAULT 1,
  smtp_host TEXT, smtp_port INTEGER, smtp_user TEXT, smtp_pass TEXT, smtp_tls INTEGER DEFAULT 1,
  inbound_token TEXT UNIQUE,
  last_uid INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT,                                -- passt auf diese Kategorie ...
  keyword TEXT,                                 -- ... oder auf dieses Stichwort
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mailbox_id INTEGER NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  message_id TEXT,
  in_reply_to TEXT,
  thread_key TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'in',         -- in | out
  from_name TEXT, from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',          -- open | answered | done | spam
  category TEXT, priority TEXT, sentiment TEXT, summary TEXT,
  draft TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  analyzed_by TEXT,
  UNIQUE(mailbox_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_emails_company ON emails(company_id, received_at);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(company_id, thread_key);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS digests (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  content TEXT NOT NULL,                        -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(file = process.env.DB_FILE || "data/postfach.db") {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

// Kleine Helfer, damit der restliche Code kurz bleibt.
export const one = (db, sql, ...p) => db.prepare(sql).get(...p);
export const all = (db, sql, ...p) => db.prepare(sql).all(...p);
export const run = (db, sql, ...p) => db.prepare(sql).run(...p);

export function audit(db, companyId, userId, action, detail = "") {
  run(db, "INSERT INTO audit_log (company_id, user_id, action, detail) VALUES (?,?,?,?)",
    companyId, userId ?? null, action, String(detail).slice(0, 500));
}
