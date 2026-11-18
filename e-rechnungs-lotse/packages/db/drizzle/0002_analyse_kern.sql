CREATE TYPE "public"."analysis_status" AS ENUM('ok', 'warnungen', 'fehlerhaft', 'keine_e_rechnung', 'pruefung_ausstehend');--> statement-breakpoint
CREATE TYPE "public"."invoice_file_format" AS ENUM('ubl', 'cii', 'zugferd_pdf', 'pdf_ohne_xml', 'unbekannt');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "profile" SET DATA TYPE text;--> statement-breakpoint
-- Altwert aus Phase 0 ohne Profilangabe: genaues Profil ist nur durch Neuanalyse bestimmbar.
UPDATE "invoices" SET "profile" = 'UNBEKANNT' WHERE "profile" = 'ZUGFERD_FACTURX';--> statement-breakpoint
DROP TYPE "public"."invoice_profile";--> statement-breakpoint
CREATE TYPE "public"."invoice_profile" AS ENUM('MINIMUM', 'BASIC_WL', 'BASIC', 'EN16931', 'EXTENDED', 'XRECHNUNG', 'UNBEKANNT');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "profile" SET DATA TYPE "public"."invoice_profile" USING "profile"::"public"."invoice_profile";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "file_format" "invoice_file_format";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "analysis_status" "analysis_status";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "embedded_xml_filename" text;