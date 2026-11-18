CREATE TYPE "public"."invoice_profile" AS ENUM('XRECHNUNG', 'ZUGFERD_FACTURX', 'EN16931', 'UNBEKANNT');--> statement-breakpoint
CREATE TYPE "public"."invoice_source" AS ENUM('upload', 'email', 'api');--> statement-breakpoint
CREATE TYPE "public"."invoice_syntax" AS ENUM('UBL', 'CII');--> statement-breakpoint
CREATE TYPE "public"."validation_outcome" AS ENUM('akzeptiert', 'abgelehnt', 'fehler');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"invoice_id" uuid,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"source" "invoice_source" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"original_object_key" text NOT NULL,
	"original_sha256" char(64) NOT NULL,
	"original_size_bytes" bigint NOT NULL,
	"original_mime_type" text NOT NULL,
	"original_filename" text,
	"syntax" "invoice_syntax",
	"profile" "invoice_profile",
	"invoice_number" text,
	"issue_date" date,
	"due_date" date,
	"currency" char(3),
	"seller_name" text,
	"seller_vat_id" text,
	"payable_amount" numeric(19, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"validator_version" text NOT NULL,
	"configuration_version" text NOT NULL,
	"outcome" "validation_outcome" NOT NULL,
	"report_object_key" text,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_invoice_idx" ON "audit_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_sha256_uq" ON "invoices" USING btree ("organisation_id","original_sha256");--> statement-breakpoint
CREATE INDEX "invoices_org_issue_date_idx" ON "invoices" USING btree ("organisation_id","issue_date");--> statement-breakpoint
CREATE INDEX "validation_runs_invoice_idx" ON "validation_runs" USING btree ("invoice_id");