import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { categorySchema, slugifyKey } from "@/server/validation/team";

/** POST /api/categories – neue Kategorie. Die Beschreibung fließt in den KI-Prompt ein. */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("categories.manage");
  const input = categorySchema.parse(await readJson(req));
  const existing = await db.category.findMany({ where: scoped(session), select: { key: true, sortOrder: true } });
  let key = slugifyKey(input.name);
  for (let i = 2; existing.some((c) => c.key === key); i++) key = `${slugifyKey(input.name)}-${i}`;
  const category = await db.category.create({
    data: { organizationId: session.organizationId, key, ...input, sortOrder: Math.max(-1, ...existing.map((c) => c.sortOrder)) + 1 },
  });
  await audit(session, "category.create", { type: "category", id: category.id }, { name: input.name });
  return category;
});
