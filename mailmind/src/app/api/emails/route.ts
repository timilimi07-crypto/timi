import { can } from "@/lib/rbac";
import { apiRoute } from "@/server/api";
import { listEmails, parseInboxFilters } from "@/server/queries/emails";
import { assertSession } from "@/server/session";

/** GET /api/emails?view=open&q=…&cursor=… – Posteingang (eine Zeile pro Thread). */
export const GET = apiRoute(async (req) => {
  const session = await assertSession("email.read");
  const params = new URL(req.url).searchParams;
  const filters = parseInboxFilters(params);
  return listEmails(session.organizationId, filters, {
    cursor: params.get("cursor"),
    limit: Number(params.get("limit")) || 50,
    showCosts: can(session.role, "ai.costs"),
    userId: session.userId,
  });
});
