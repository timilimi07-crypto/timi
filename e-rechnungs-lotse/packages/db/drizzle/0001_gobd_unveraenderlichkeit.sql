-- GoBD: Original-Referenz und Hash einer Rechnung dürfen nach Eingang nicht mehr geändert werden.
CREATE OR REPLACE FUNCTION erl_protect_invoice_original() RETURNS trigger AS $$
BEGIN
  IF NEW.original_object_key IS DISTINCT FROM OLD.original_object_key
     OR NEW.original_sha256 IS DISTINCT FROM OLD.original_sha256
     OR NEW.original_size_bytes IS DISTINCT FROM OLD.original_size_bytes
     OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
    RAISE EXCEPTION 'Original-Referenz einer Rechnung ist unveränderlich (GoBD)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER invoices_protect_original
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION erl_protect_invoice_original();
--> statement-breakpoint
-- Rechnungen werden nicht gelöscht (Aufbewahrungsfrist). Löschung nach Fristablauf erfolgt über einen eigenen, protokollierten Prozess.
CREATE OR REPLACE FUNCTION erl_forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Löschen ist für % nicht erlaubt (GoBD)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER invoices_forbid_delete BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION erl_forbid_delete();
--> statement-breakpoint
-- Audit-Log ist append-only.
CREATE OR REPLACE FUNCTION erl_audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events ist nur anfügbar';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION erl_audit_append_only();
