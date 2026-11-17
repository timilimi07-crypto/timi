import "server-only";

/**
 * Mandantentrennung: Hilfsfunktion, die jedem Prisma-`where` die
 * organizationId des angemeldeten Nutzers hinzufügt. Wird in allen
 * Abfragen fachlicher Daten verwendet, damit nie versehentlich Daten einer
 * anderen Firma gelesen werden können.
 *
 *   db.email.findMany({ where: scoped(session, { status: "NEW" }) })
 */
export function scoped<T extends object>(
  session: { organizationId: string },
  where?: T,
): T & { organizationId: string } {
  return { ...(where ?? ({} as T)), organizationId: session.organizationId };
}
