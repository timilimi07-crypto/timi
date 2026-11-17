"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import type { SidebarUser } from "./types";

export function UserMenu({ user }: { user: SidebarUser }) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50">
        <Avatar className="size-7">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="text-foreground">
          <div className="font-medium">{user.name}</div>
          <div className="truncate font-normal text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Darstellung</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {(
            [
              { value: "light", label: "Hell", icon: Sun },
              { value: "dark", label: "Dunkel", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              data-active={theme === t.value}
              className="flex flex-col items-center gap-1 rounded-md border border-transparent py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-border data-[active=true]:bg-accent data-[active=true]:text-foreground"
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Einstellungen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
          <LogOut /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
