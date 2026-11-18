import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { validateRuleRefs } from "@/server/rules/refs";
import { ruleInputSchema } from "@/server/rules/schema";
import { assertSession } from "@/server/session";
import { scoped } from "@/server/tenant";

/** GET /api/rules – alle Regeln der Firma in Ausführungsreihenfolge. */
export const GET = apiRoute(async () => {
  const session = await assertSession("rules.manage");
  return db.rule.findMany({ where: scoped(session), orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
});

/** POST /api/rules – neue Regel (wird ans Ende gestellt). */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("rules.manage");
  const input = ruleInputSchema.parse(await readJson(req));
  await validateRuleRefs(session.organizationId, input);
  const last = await db.rule.findFirst({ where: scoped(session), orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const rule = await db.rule.create({
    data: {
      organizationId: session.organizationId,
      name: input.name,
      enabled: input.enabled,
      stopProcessing: input.stopProcessing,
      conditions: input.conditions as Prisma.InputJsonValue,
      actions: input.actions as Prisma.InputJsonValue,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      createdById: session.userId,
    },
  });
  await audit(session, "rule.create", { type: "rule", id: rule.id }, { name: rule.name });
  return rule;
});
