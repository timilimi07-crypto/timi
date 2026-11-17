"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { LogOut, Moon, Sun, Monitor, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { MAIN_NAV, SETTINGS_NAV } from "@/lib/navigation";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { colorClasses } from "@/lib/colors";
import type { SidebarCategory } from "./types";

type Ctx = { open: () => void };
const CommandPaletteContext = createContext<Ctx>({ open: () => {} });

export const useCommandPalette = () => useContext(CommandPaletteContext);

/**
 * Befehlspalette (⌘K / Strg+K) + globale Navigationskürzel (g d, g i, …).
 * Weitere Befehle (E-Mail-Aktionen) werden in späteren Phasen ergänzt.
 */
export function CommandPaletteProvider({
  categories,
  children,
}: {
  categories: SidebarCategory[];
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  useHotkeys({
    "mod+k": () => setOpen((o) => !o),
    "g d": () => router.push("/dashboard"),
    "g i": () => router.push("/inbox"),
    "g k": () => router.push("/kanban"),
    "g a": () => router.push("/tasks"),
    "g e": () => router.push("/settings"),
  });

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">Befehlspalette</DialogTitle>
          <Command loop>
            <CommandInput placeholder="Befehl oder Seite suchen …" />
            <CommandList>
              <CommandEmpty>Keine Treffer.</CommandEmpty>
              <CommandGroup heading="Navigation">
                {[...MAIN_NAV, SETTINGS_NAV].map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    <item.icon />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="flex gap-1">
                        {item.shortcut.split(" ").map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {categories.length > 0 && (
                <CommandGroup heading="Kategorien">
                  {categories.map((c) => (
                    <CommandItem key={c.id} value={`Kategorie ${c.name}`} onSelect={() => go(`/inbox?category=${c.key}`)}>
                      <Tag />
                      <span className={`size-2 rounded-full ${colorClasses(c.color).dot}`} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Darstellung">
                <CommandItem value="Helles Design" onSelect={() => { setTheme("light"); setOpen(false); }}>
                  <Sun /> Helles Design
                </CommandItem>
                <CommandItem value="Dunkles Design" onSelect={() => { setTheme("dark"); setOpen(false); }}>
                  <Moon /> Dunkles Design
                </CommandItem>
                <CommandItem value="Systemeinstellung Design" onSelect={() => { setTheme("system"); setOpen(false); }}>
                  <Monitor /> Wie System
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Konto">
                <CommandItem value="Abmelden" onSelect={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut /> Abmelden
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
