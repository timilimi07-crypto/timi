-- Phishing-Markierung
ALTER TABLE "Email" ADD COLUMN "phishingReason" TEXT,
ADD COLUMN "phishingSuspected" BOOLEAN NOT NULL DEFAULT false;

-- Volltextsuche (deutsche Stammformen). Generierte Spalte: Postgres hält sie
-- bei jeder Änderung von Betreff, Absender, KI-Zusammenfassung oder Text aktuell.
-- Gewichtung: A = Betreff/Absender, B = KI-Zusammenfassung, C = Text.
ALTER TABLE "Email" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('german'::regconfig, coalesce("subject", '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, coalesce("fromName", '') || ' ' || coalesce("fromEmail", '')), 'A') ||
  setweight(to_tsvector('german'::regconfig, coalesce("summary", '')), 'B') ||
  setweight(to_tsvector('german'::regconfig, left(coalesce("bodyText", ''), 50000)), 'C')
) STORED;

CREATE INDEX "Email_searchVector_idx" ON "Email" USING GIN ("searchVector");

-- Schnelle Listenabfrage pro Thread (neueste E-Mail je Thread).
CREATE INDEX "Email_organizationId_threadId_receivedAt_idx" ON "Email" ("organizationId", "threadId", "receivedAt" DESC);
