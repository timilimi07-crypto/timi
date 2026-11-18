import type { STATUS_LABEL } from "@/lib/labels";
import type { EmailListItem } from "@/server/queries/emails";

/** Gemeinsam für Server-Seite und Client-Board (bewusst KEIN Client-Modul). */
export type Status = keyof typeof STATUS_LABEL;
export type Columns = Record<Status, EmailListItem[]>;
export const STATUSES: Status[] = ["NEW", "IN_PROGRESS", "WAITING", "DONE"];
