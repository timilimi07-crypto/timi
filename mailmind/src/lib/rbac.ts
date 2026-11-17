import type { Role } from "@prisma/client";

/**
 * Rollenbasierte Berechtigungen. Bewusst als statische Matrix gehalten –
 * leicht testbar und an einer Stelle nachvollziehbar.
 */
export const PERMISSIONS = {
  "email.read": ["ADMIN", "MANAGER", "MEMBER"],
  "email.update": ["ADMIN", "MANAGER", "MEMBER"],
  "email.assign": ["ADMIN", "MANAGER"],
  "email.delete": ["ADMIN"],
  "task.manage": ["ADMIN", "MANAGER", "MEMBER"],
  "mailbox.manage": ["ADMIN"],
  "rules.manage": ["ADMIN", "MANAGER"],
  "categories.manage": ["ADMIN", "MANAGER"],
  "team.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "audit.read": ["ADMIN"],
  "stats.team": ["ADMIN", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Mitarbeiter",
};
