import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSession();
  const users = await db.user.findMany({
    where: scoped(session),
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      _count: { select: { assignedEmails: { where: { status: { not: "DONE" }, deletedAt: null } } } },
    },
  });
  return (
    <TeamManager
      currentUserId={session.userId}
      canManage={can(session.role, "team.manage")}
      members={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, openAssigned: u._count.assignedEmails }))}
    />
  );
}
