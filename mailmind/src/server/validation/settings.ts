import { z } from "zod";
import { isAllowedModel } from "@/lib/ai/models";

/** Firmeneinstellungen (nur Admin). Alle Felder optional – es wird nur geändert, was gesendet wird. */
export const organizationSettingsSchema = z
  .object({
    syncIntervalMinutes: z.number().int().min(1, "Abrufintervall: mindestens 1 Minute").max(1440, "Abrufintervall: höchstens 1440 Minuten"),
    initialSyncDays: z.number().int().min(1, "Zeitraum: mindestens 1 Tag").max(365, "Zeitraum: höchstens 365 Tage"),
    maxEmailsPerSync: z.number().int().min(10, "Limit: mindestens 10 E-Mails").max(1000, "Limit: höchstens 1000 E-Mails"),
    aiDailyEmailLimit: z.number().int().min(10, "KI-Tageslimit: mindestens 10 E-Mails").max(20000, "KI-Tageslimit: höchstens 20.000 E-Mails"),
    aiModel: z
      .string()
      .nullable()
      .refine((v) => v === null || isAllowedModel(v, "main"), "Dieses Modell ist als Hauptmodell nicht verfügbar"),
    aiModelFast: z
      .string()
      .nullable()
      .refine((v) => v === null || isAllowedModel(v, "fast"), "Dieses Modell ist als schnelles Modell nicht verfügbar"),
  })
  .partial();

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

/** IMAP-Postfach verbinden. */
export const imapMailboxSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(60),
  emailAddress: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse"),
  host: z.string().trim().min(1, "Bitte den IMAP-Server angeben"),
  port: z.number().int().min(1).max(65535).default(993),
  secure: z.boolean().default(true),
  username: z.string().trim().min(1, "Bitte den Benutzernamen angeben"),
  password: z.string().min(1, "Bitte das Passwort angeben"),
  folder: z.string().trim().min(1).default("INBOX"),
  initialSyncDays: z.number().int().min(1).max(365).nullable().default(null),
});

export type ImapMailboxInput = z.infer<typeof imapMailboxSchema>;

export const mailboxUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Namen angeben").max(60),
    syncEnabled: z.boolean(),
  })
  .partial();

/** Manuelle Änderung einer E-Mail (Einordnung, Status, gelesen). */
export const emailUpdateSchema = z
  .object({
    categoryKey: z.string().min(1),
    priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]),
    status: z.enum(["NEW", "IN_PROGRESS", "WAITING", "DONE"]),
    isRead: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Keine Änderung angegeben");
