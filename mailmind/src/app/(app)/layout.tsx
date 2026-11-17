import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/server/session";
import { getSidebarData } from "@/server/queries/sidebar";

/** Layout für alle angemeldeten Bereiche. Lädt Sitzung + Seitenleisten-Daten. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const data = await getSidebarData(session);

  return (
    <AppShell
      user={{
        name: session.name,
        email: session.email,
        role: session.role,
        organizationName: session.organizationName,
      }}
      {...data}
    >
      {children}
    </AppShell>
  );
}
