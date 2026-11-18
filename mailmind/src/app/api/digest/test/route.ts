import { apiRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { sendDigest } from "@/server/digest/send";
import { assertSession, HttpError } from "@/server/session";

/** POST /api/digest/test – eigenen Digest sofort an sich selbst schicken (auch wenn er leer wäre). */
export const POST = apiRoute(async () => {
  const session = await assertSession();
  const r = await sendDigest(session.userId, { force: true });
  if (r.status === "no_smtp") throw new HttpError(400, "Kein Mailversand eingerichtet (SMTP_URL fehlt in der .env). Die Vorschau unten zeigt den Inhalt.");
  await audit(session, "digest.test", { type: "user", id: session.userId });
  return r;
});
