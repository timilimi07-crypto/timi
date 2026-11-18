import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { CategoriesEditor } from "./categories-editor";

export const metadata: Metadata = { title: "Kategorien & Labels" };

export default async function CategoriesPage() {
  const session = await requireSession();
  const [categories, labels] = await Promise.all([
    db.category.findMany({ where: scoped(session), orderBy: { sortOrder: "asc" }, include: { _count: { select: { emails: true } } } }),
    db.label.findMany({ where: scoped(session), orderBy: { name: "asc" }, include: { _count: { select: { emails: true } } } }),
  ]);
  return (
    <CategoriesEditor
      canEdit={can(session.role, "categories.manage")}
      categories={categories.map((c) => ({ id: c.id, key: c.key, name: c.name, description: c.description, color: c.color, autoCollapse: c.autoCollapse, isSystem: c.isSystem, emailCount: c._count.emails }))}
      labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color, emailCount: l._count.emails }))}
    />
  );
}
