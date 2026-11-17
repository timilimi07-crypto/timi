import type { Metadata } from "next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSession();
  const users = await db.user.findMany({
    where: scoped(session),
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, lastLoginAt: true, isActive: true },
  });

  return (
    <Card className="divide-y">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar>
            <AvatarFallback>{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {u.name} {u.id === session.userId && <span className="text-muted-foreground">(du)</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {u.lastLoginAt ? `Zuletzt aktiv: ${formatDateTime(u.lastLoginAt)}` : "Noch nie angemeldet"}
          </div>
          <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{ROLE_LABELS[u.role]}</Badge>
        </div>
      ))}
    </Card>
  );
}
