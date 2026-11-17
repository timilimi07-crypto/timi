import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";

export type AppSession = {
  userId: string;
  name: string;
  email: string;
  role: import("@prisma/client").Role;
  organizationId: string;
  organizationName: string;
};

/** Aktuelle Sitzung oder null. */
export async function getAppSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const { id, ...rest } = session.user;
  return { userId: id, ...rest };
}

/** Für Seiten: ohne Sitzung zum Login umleiten. */
export async function requireSession(): Promise<AppSession> {
  const s = await getAppSession();
  if (!s) redirect("/login");
  return s;
}

/** Für Seiten: fehlende Berechtigung → Dashboard. */
export async function requirePermission(permission: Permission): Promise<AppSession> {
  const s = await requireSession();
  if (!can(s.role, permission)) redirect("/dashboard?error=forbidden");
  return s;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Für API-Routen / Server Actions: wirft HttpError statt umzuleiten. */
export async function assertSession(permission?: Permission): Promise<AppSession> {
  const s = await getAppSession();
  if (!s) throw new HttpError(401, "Nicht angemeldet");
  if (permission && !can(s.role, permission)) throw new HttpError(403, "Keine Berechtigung");
  return s;
}
