import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { labelSchema } from "@/server/validation/team";

export const GET = apiRoute(async () => {
  const session = await assertSession("email.read");
  return db.label.findMany({ where: scoped(session), orderBy: { name: "asc" } });
});

export const POST = apiRoute(async (req) => {
  const session = await assertSession("categories.manage");
  const input = labelSchema.parse(await readJson(req));
  try {
    const label = await db.label.create({ data: { organizationId: session.organizationId, ...input } });
    await audit(session, "label.create", { type: "label", id: label.id }, input);
    return label;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError(409, "Dieses Label gibt es bereits");
    throw err;
  }
});
