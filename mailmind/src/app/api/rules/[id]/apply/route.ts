import { db } from "@/lib/db";
import { apiRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { applyRules, parseRule } from "@/server/rules/engine";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rules/:id/apply – eine Regel nachträglich auf offene E-Mails der
 * letzten 30 Tage anwenden (z. B. direkt nach dem Anlegen).
 */
export const POST = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("rules.manage");
  const { id } = await params;
  const raw = await db.rule.findFirst({ where: scoped(session, { id }) });
  if (!raw) throw new HttpError(404, "Regel nicht gefunden");
  const rule = parseRule(raw);
  if (!rule) throw new HttpError(400, "Regel ist fehlerhaft gespeichert");

  const emails = await db.email.findMany({
    where: scoped(session, { deletedAt: null, status: { not: "DONE" as const }, receivedAt: { gte: new Date(Date.now() - 30 * 864e5) } }),
    select: { id: true },
    take: 2000,
  });
  let matched = 0;
  for (const e of emails) {
    const r = await applyRules(e.id, { rules: [{ ...rule, stopProcessing: false }], force: true, skipCounter: true });
    if (r.matched.length) matched++;
  }
  if (matched) await db.rule.update({ where: { id }, data: { matchCount: { increment: matched } } });
  await audit(session, "rule.apply_existing", { type: "rule", id }, { matched, checked: emails.length });
  return { checked: emails.length, matched };
});
