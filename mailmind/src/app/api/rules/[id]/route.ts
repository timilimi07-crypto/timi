import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { validateRuleRefs } from "@/server/rules/refs";
import { ruleInputSchema } from "@/server/rules/schema";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.union([ruleInputSchema, z.object({ enabled: z.boolean() })]);

/** PATCH /api/rules/:id – komplett ändern oder nur aktivieren/deaktivieren. */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("rules.manage");
  const { id } = await params;
  if (!(await db.rule.findFirst({ where: scoped(session, { id }), select: { id: true } }))) throw new HttpError(404, "Regel nicht gefunden");
  const input = patchSchema.parse(await readJson(req));
  if ("conditions" in input) await validateRuleRefs(session.organizationId, input);
  const rule = await db.rule.update({
    where: { id },
    data:
      "conditions" in input
        ? {
            name: input.name,
            enabled: input.enabled,
            stopProcessing: input.stopProcessing,
            conditions: input.conditions as Prisma.InputJsonValue,
            actions: input.actions as Prisma.InputJsonValue,
          }
        : { enabled: input.enabled },
  });
  await audit(session, "rule.update", { type: "rule", id }, { name: rule.name, enabled: rule.enabled });
  return rule;
});

/** DELETE /api/rules/:id */
export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("rules.manage");
  const { id } = await params;
  const r = await db.rule.deleteMany({ where: scoped(session, { id }) });
  if (r.count === 0) throw new HttpError(404, "Regel nicht gefunden");
  await audit(session, "rule.delete", { type: "rule", id });
  return { ok: true };
});
