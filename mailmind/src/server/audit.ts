import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AppSession } from "@/server/session";

/**
 * Schreibt einen Eintrag ins Audit-Log (DSGVO: Nachvollziehbarkeit, wer welche
 * E-Mail geöffnet/bearbeitet hat). Fehler beim Protokollieren dürfen die
 * eigentliche Aktion nicht abbrechen, werden aber geloggt.
 */
export async function audit(
  session: Pick<AppSession, "organizationId" | "userId">,
  action: string,
  entity: { type: string; id?: string },
  metadata?: Prisma.InputJsonValue,
) {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action,
        entityType: entity.type,
        entityId: entity.id,
        metadata,
        ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Eintrag fehlgeschlagen", err);
  }
}
