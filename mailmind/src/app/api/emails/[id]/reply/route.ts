import { apiRoute, readJson } from "@/server/api";
import { AI_NOT_CONFIGURED_MESSAGE, createAiCaller, isAiConfigured } from "@/server/ai/provider";
import { generateReply } from "@/server/ai/reply";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { replyRequestSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/emails/:id/reply – Antwortvorschlag erzeugen (Ton: FORMAL, CASUAL, SHORT). */
export const POST = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  if (!isAiConfigured()) throw new HttpError(503, AI_NOT_CONFIGURED_MESSAGE);
  const { id } = await params;
  const { tone } = replyRequestSchema.parse(await readJson(req));
  const r = await generateReply({
    organizationId: session.organizationId,
    emailId: id,
    userId: session.userId,
    userName: session.name,
    tone,
    caller: createAiCaller(),
  });
  if (!r.ok) throw new HttpError(502, r.error);
  await audit(session, "email.reply_suggested", { type: "email", id }, { tone });
  return r;
});
