import { apiRoute, readJson } from "@/server/api";
import { createAnthropicCaller, isAiConfigured } from "@/server/ai/client";
import { generateReply } from "@/server/ai/reply";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { replyRequestSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/emails/:id/reply – Antwortvorschlag erzeugen (Ton: FORMAL, CASUAL, SHORT). */
export const POST = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  if (!isAiConfigured()) throw new HttpError(503, "Antwortvorschläge sind nicht verfügbar: Es ist kein ANTHROPIC_API_KEY hinterlegt.");
  const { id } = await params;
  const { tone } = replyRequestSchema.parse(await readJson(req));
  const r = await generateReply({
    organizationId: session.organizationId,
    emailId: id,
    userId: session.userId,
    userName: session.name,
    tone,
    caller: createAnthropicCaller(),
  });
  if (!r.ok) throw new HttpError(502, r.error);
  await audit(session, "email.reply_suggested", { type: "email", id }, { tone });
  return r;
});
