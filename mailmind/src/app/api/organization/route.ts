import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession } from "@/server/session";
import { organizationSettingsSchema } from "@/server/validation/settings";

/** PATCH /api/organization – Firmeneinstellungen (Abruf, Limits, KI-Modelle). Nur Admin. */
export const PATCH = apiRoute(async (req) => {
  const session = await assertSession("settings.manage");
  const input = organizationSettingsSchema.parse(await readJson(req));
  const org = await db.organization.update({
    where: { id: session.organizationId },
    data: input,
    select: { syncIntervalMinutes: true, initialSyncDays: true, maxEmailsPerSync: true, aiModel: true, aiModelFast: true },
  });
  await audit(session, "settings.update", { type: "organization", id: session.organizationId }, input);
  return org;
});
