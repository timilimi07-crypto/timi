import type { MailboxProvider, MailboxStatus, Role } from "@prisma/client";

/** Serialisierbare Daten, die das Server-Layout an die Client-Sidebar übergibt. */
export type SidebarCategory = {
  id: string;
  key: string;
  name: string;
  color: string;
  openCount: number;
};

export type SidebarMailbox = {
  id: string;
  name: string;
  emailAddress: string;
  provider: MailboxProvider;
  status: MailboxStatus;
};

export type SidebarUser = {
  name: string;
  email: string;
  role: Role;
  organizationName: string;
};

export type SidebarCounts = {
  inboxUnread: number;
  openTasks: number;
};
