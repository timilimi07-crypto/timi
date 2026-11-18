import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { assertSession } from "@/server/session";

/** PATCH /api/me – eigene Einstellungen (Tages-Digest an/aus). */
export const PATCH = apiRoute(async (req) => {
  const session = await assertSession();
  const input = z.object({ digestOptIn: z.boolean() }).parse(await readJson(req));
  await db.user.update({ where: { id: session.userId }, data: input });
  return input;
});
