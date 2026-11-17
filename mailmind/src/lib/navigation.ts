import {
  LayoutDashboard,
  Inbox,
  SquareKanban,
  ListTodo,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tastenkombination "g + x" für die Navigation. */
  shortcut?: string;
};

/** Hauptnavigation – wird von Sidebar, mobiler Navigation und Befehlspalette genutzt. */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/inbox", label: "Posteingang", icon: Inbox, shortcut: "G I" },
  { href: "/kanban", label: "Kanban", icon: SquareKanban, shortcut: "G K" },
  { href: "/tasks", label: "Aufgaben", icon: ListTodo, shortcut: "G A" },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Einstellungen", icon: Settings, shortcut: "G E" };
