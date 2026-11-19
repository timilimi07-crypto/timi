/**
 * Prüfmodus speichert nichts: Nach einer Prüfung liegt keine Datei im Objektspeicher und es gibt
 * keinen neuen Eintrag in der Rechnungstabelle (oder anderen Tabellen mit Rechnungsbezug).
 * Benötigt die lokalen Dienste (docker compose: postgres, minio) und DATABASE_URL / S3_*.
 */
import { ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { pruefe } from "./helpers";

const DATABASE_URL = process.env["DATABASE_URL"];
const S3_ENDPOINT = process.env["S3_ENDPOINT"];

test.skip(
  !DATABASE_URL || !S3_ENDPOINT,
  "DATABASE_URL und S3_ENDPOINT nötig (docker compose up postgres minio)",
);

async function zaehleObjekte(s3: S3Client): Promise<number> {
  const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
  let n = 0;
  for (const b of Buckets) {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: b.Name! }));
    n += r.KeyCount ?? 0;
  }
  return n;
}

test("nach der Prüfung: keine Datei im Objektspeicher, kein Eintrag in der Datenbank", async ({
  page,
}) => {
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const s3 = new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env["S3_REGION"] ?? "eu-central-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env["S3_ACCESS_KEY_ID"] ?? "erl-local",
      secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"] ?? "erl-local-secret",
    },
  });
  const zaehleZeilen = async () => {
    const [r] = await sql`
      select (select count(*) from invoices)::int as invoices,
             (select count(*) from validation_runs)::int as runs,
             (select count(*) from audit_events)::int as audit`;
    return r;
  };

  try {
    const vorher = { zeilen: await zaehleZeilen(), objekte: await zaehleObjekte(s3) };

    for (const datei of [
      "broken/falsche-summe.xml",
      "official/ferd-zugferd-2.2/EN16931_Einfach.pdf",
    ]) {
      await pruefe(page, datei);
    }

    expect(await zaehleZeilen()).toEqual(vorher.zeilen);
    expect(await zaehleObjekte(s3)).toBe(vorher.objekte);
    expect(vorher.objekte).toBe(0);
    expect(vorher.zeilen).toMatchObject({ invoices: 0 });
  } finally {
    await sql.end();
    s3.destroy();
  }
});
