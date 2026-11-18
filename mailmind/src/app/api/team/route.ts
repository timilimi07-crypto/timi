import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { teamCreateSchema } from "@/server/validation/team";

/** Lesbares Startpasswort (ohne verwechselbare Zeichen), wird nur einmal angezeigt. */
function initialPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join("");
}

/** POST /api/team – Person anlegen (nur Admin). Das Startpasswort wird einmalig zurückgegeben. */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("team.manage");
  const input = teamCreateSchema.parse(await readJson(req));
  const password = initialPassword();
  try {
    const user = await db.user.create({
      data: { organizationId: session.organizationId, name: input.name, email: input.email, role: input.role, passwordHash: await bcrypt.hash(password, 10) },
      select: { id: true, name: true, email: true, role: true },
    });
    await audit(session, "team.create", { type: "user", id: user.id }, { email: user.email, role: user.role });
    return { user, initialPassword: password };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError(409, "Diese E-Mail-Adresse ist bereits vergeben");
    throw err;
  }
});
