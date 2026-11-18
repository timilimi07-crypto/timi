import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const invoiceSyntax = pgEnum("invoice_syntax", ["UBL", "CII"]);
/** Muss mit `InvoiceProfile` in @erl/core übereinstimmen. */
export const invoiceProfile = pgEnum("invoice_profile", [
  "MINIMUM",
  "BASIC_WL",
  "BASIC",
  "EN16931",
  "EXTENDED",
  "XRECHNUNG",
  "UNBEKANNT",
]);
/** Muss mit `InvoiceFileFormat` in @erl/core übereinstimmen. */
export const invoiceFileFormat = pgEnum("invoice_file_format", [
  "ubl",
  "cii",
  "zugferd_pdf",
  "pdf_ohne_xml",
  "unbekannt",
]);
/** Muss mit `AnalysisStatus` in @erl/core übereinstimmen. */
export const analysisStatus = pgEnum("analysis_status", [
  "ok",
  "warnungen",
  "fehlerhaft",
  "keine_e_rechnung",
  "pruefung_ausstehend",
]);
export const invoiceSource = pgEnum("invoice_source", ["upload", "email", "api"]);
export const validationOutcome = pgEnum("validation_outcome", [
  "akzeptiert",
  "abgelehnt",
  "fehler",
]);

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Eingangsrechnung. Das Original liegt unverändert im Objektspeicher (`original_object_key`),
 * der SHA-256 wird beim Eingang berechnet. Diese beiden Spalten sind per DB-Trigger unveränderlich.
 * Alle fachlichen Felder sind deterministisch aus dem XML gelesen (nur Anzeige/Suche – maßgeblich ist das XML).
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    source: invoiceSource("source").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    originalObjectKey: text("original_object_key").notNull(),
    originalSha256: char("original_sha256", { length: 64 }).notNull(),
    originalSizeBytes: bigint("original_size_bytes", { mode: "number" }).notNull(),
    originalMimeType: text("original_mime_type").notNull(),
    originalFilename: text("original_filename"),
    syntax: invoiceSyntax("syntax"),
    fileFormat: invoiceFileFormat("file_format"),
    profile: invoiceProfile("profile"),
    analysisStatus: analysisStatus("analysis_status"),
    embeddedXmlFilename: text("embedded_xml_filename"),
    invoiceNumber: text("invoice_number"),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    currency: char("currency", { length: 3 }),
    sellerName: text("seller_name"),
    sellerVatId: text("seller_vat_id"),
    payableAmount: numeric("payable_amount", { precision: 19, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_org_sha256_uq").on(t.organisationId, t.originalSha256),
    index("invoices_org_issue_date_idx").on(t.organisationId, t.issueDate),
  ],
);

export const validationRuns = pgTable(
  "validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    validatorVersion: text("validator_version").notNull(),
    configurationVersion: text("configuration_version").notNull(),
    outcome: validationOutcome("outcome").notNull(),
    reportObjectKey: text("report_object_key"),
    findings: jsonb("findings")
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("validation_runs_invoice_idx").on(t.invoiceId)],
);

/** Append-only Protokoll (GoBD: Nachvollziehbarkeit). Keine personenbezogenen Inhalte in `details`. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").references(() => organisations.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    details: jsonb("details")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_invoice_idx").on(t.invoiceId)],
);
