"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Logo } from "@/components/shared/logo";
import { MAIN_NAV, SETTINGS_NAV } from "@/lib/navigation";
import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import type { SidebarCategory, SidebarCounts, SidebarMailbox, SidebarUser } from "./types";

export type SidebarProps = {
  user: SidebarUser;
  categories: SidebarCategory[];
  mailboxes: SidebarMailbox[];
  counts: SidebarCounts;
  /** Wird in der mobilen Navigation genutzt, um das Panel nach Klick zu schließen. */
  onNavigate?: () => void;
};

const MAILBOX_STATUS_DOT: Record<SidebarMailbox["status"], string> = {
  ACTIVE: "bg-emerald-500",
  SYNCING: "bg-blue-500 animate-pulse",
  ERROR: "bg-red-500",
  DISABLED: "bg-zinc-400",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 pt-4 text-[11px] font-medium text-muted-foreground">{children}</div>;
}

function NavLink({
  href,
  active,
  children,
  count,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  count?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-sidebar-accent text-foreground",
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{count}</span>
      )}
    </Link>
  );
}

/** Linke Seitenleiste: Navigation, Kategorien, Postfächer, Nutzermenü. */
export function Sidebar({ user, categories, mailboxes, counts, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const palette = useCommandPalette();
  const activeCategory = pathname === "/inbox" ? params.get("category") : null;
  const activeMailbox = pathname === "/inbox" ? params.get("mailbox") : null;

  const navCounts: Record<string, number | undefined> = {
    "/inbox": counts.inboxUnread,
    "/tasks": counts.openTasks,
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex h-12 items-center gap-2 px-3", onNavigate && "pr-10")}>
        <Logo className="text-sm" />
        <span className="truncate text-xs text-muted-foreground">· {user.organizationName}</span>
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={palette.open}
          className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2 text-[13px] text-muted-foreground shadow-xs transition-colors hover:text-foreground"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Suchen …</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin" aria-label="Hauptnavigation">
        <div className="mt-3 space-y-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              onNavigate={onNavigate}
              active={pathname.startsWith(item.href) && !activeCategory && !activeMailbox}
              count={navCounts[item.href]}
            >
              <item.icon className="size-4 shrink-0 opacity-80" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <SectionTitle>Kategorien</SectionTitle>
        <div className="space-y-0.5">
          {categories.map((c) => (
            <NavLink
              key={c.id}
              href={`/inbox?category=${c.key}`}
              onNavigate={onNavigate}
              active={activeCategory === c.key}
              count={c.openCount}
            >
              <span className={cn("ml-1 mr-0.5 size-2 shrink-0 rounded-full", colorClasses(c.color).dot)} />
              <span className="truncate">{c.name}</span>
            </NavLink>
          ))}
        </div>

        <SectionTitle>Postfächer</SectionTitle>
        <div className="space-y-0.5">
          {mailboxes.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Noch kein Postfach verbunden.</p>
          )}
          {mailboxes.map((m) => (
            <NavLink
              key={m.id}
              href={`/inbox?mailbox=${m.id}`}
              onNavigate={onNavigate}
              active={activeMailbox === m.id}
            >
              <span
                className={cn("ml-1 mr-0.5 size-1.5 shrink-0 rounded-full", MAILBOX_STATUS_DOT[m.status])}
                title={m.status}
              />
              <span className="truncate" title={m.emailAddress}>
                {m.name}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2">
        <NavLink href={SETTINGS_NAV.href} active={pathname.startsWith("/settings")} onNavigate={onNavigate}>
          <SETTINGS_NAV.icon className="size-4 shrink-0 opacity-80" />
          {SETTINGS_NAV.label}
        </NavLink>
        <UserMenu user={user} />
      </div>
    </div>
  );
}
