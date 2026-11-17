"use client";

import { Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { CommandPaletteProvider } from "./command-palette";
import { Sidebar, type SidebarProps } from "./sidebar";

/**
 * Grundlayout: feste Seitenleiste ab lg, darunter ein ausklappbares Panel mit
 * kompakter Kopfzeile (Tablet/Handy).
 */
export function AppShell({ children, ...sidebar }: SidebarProps & { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CommandPaletteProvider categories={sidebar.categories}>
      <div className="flex h-dvh overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">
          <Suspense>
            <Sidebar {...sidebar} />
          </Suspense>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Suspense>
              <Sidebar {...sidebar} onNavigate={() => setMobileOpen(false)} />
            </Suspense>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 lg:hidden">
            <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label="Navigation öffnen">
              <Menu />
            </Button>
            <Logo className="text-sm" />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
