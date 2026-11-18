import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { factsFromEmail, matchesRule } from "@/server/rules/engine";
import { ruleConditionsSchema } from "@/server/rules/schema";
import { assertSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { z } from "zod";

/** Wie viele der letzten E-Mails würden diese Bedingungen treffen? (Live-Vorschau im Editor) */
const SAMPLE = 300;

export const POST = apiRoute(async (req) => {
  const session = await assertSession("rules.manage");
  const { conditions } = z.object({ conditions: ruleConditionsSchema }).parse(await readJson(req));
  const emails = await db.email.findMany({
    where: scoped(session, { deletedAt: null }),
    orderBy: { receivedAt: "desc" },
    take: SAMPLE,
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      subject: true,
      bodyText: true,
      priority: true,
      mailboxId: true,
      hasAttachments: true,
      receivedAt: true,
      category: { select: { key: true } },
    },
  });
  const hits = emails.filter((e) => matchesRule(conditions, factsFromEmail(e)));
  return {
    checked: emails.length,
    matches: hits.length,
    examples: hits.slice(0, 5).map((e) => ({ id: e.id, subject: e.subject, from: e.fromName ?? e.fromEmail, receivedAt: e.receivedAt.toISOString() })),
  };
});
