import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Kategorien" };

/** Kategorien der Firma. Bearbeiten (anlegen, umbenennen, Farbe) folgt in Phase 6. */
export default async function CategoriesPage() {
  const session = await requireSession();
  const categories = await db.category.findMany({
    where: scoped(session),
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { emails: true } } },
  });

  return (
    <Card className="divide-y">
      {categories.map((c) => (
        <div key={c.id} className="flex items-start gap-3 px-4 py-3">
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", colorClasses(c.color).dot)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {c.name}
              {c.autoCollapse && <Badge variant="secondary">wird eingeklappt</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{c._count.emails} E-Mails</span>
        </div>
      ))}
    </Card>
  );
}
