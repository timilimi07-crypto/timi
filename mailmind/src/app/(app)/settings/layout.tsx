import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/lib/rbac";
import { requireSession } from "@/server/session";
import { SettingsNav, type SettingsLink } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const links: SettingsLink[] = [
    { href: "/settings", label: "Allgemein" },
    { href: "/settings/team", label: "Team" },
    { href: "/settings/mailboxes", label: "Postfächer" },
    { href: "/settings/categories", label: "Kategorien" },
    { href: "/settings/rules", label: "Regeln" },
    ...(can(session.role, "settings.manage") ? [{ href: "/settings/privacy", label: "Datenschutz" }] : []),
    ...(can(session.role, "audit.read") ? [{ href: "/settings/audit", label: "Audit-Log" }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Einstellungen" description={`Firma: ${session.organizationName}`} />
      <SettingsNav links={links} />
      {children}
    </div>
  );
}
