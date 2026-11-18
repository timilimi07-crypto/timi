import { z } from "zod";
import { COLOR_CLASSES } from "@/lib/colors";

const color = z.enum(Object.keys(COLOR_CLASSES) as [string, ...string[]]);

export const labelSchema = z.object({ name: z.string().trim().min(1, "Bitte einen Namen angeben").max(40), color: color.default("zinc") });

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(40),
  description: z.string().trim().max(300).default(""),
  color: color.default("zinc"),
  autoCollapse: z.boolean().default(false),
});

export const categoryUpdateSchema = categorySchema.partial().refine((v) => Object.keys(v).length > 0, "Keine Änderung angegeben");

export const teamCreateSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(80),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse"),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).default("MEMBER"),
});

export const teamUpdateSchema = z
  .object({ role: z.enum(["ADMIN", "MANAGER", "MEMBER"]), isActive: z.boolean(), name: z.string().trim().min(1).max(80) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Keine Änderung angegeben");

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Bitte einen Text eingeben").max(5000),
  isNote: z.boolean().default(false),
});

export const commentUpdateSchema = z.object({ body: z.string().trim().min(1).max(5000).optional(), isNote: z.boolean().optional() });

export const emailLabelSchema = z.object({ labelId: z.string().min(1), on: z.boolean() });

/** Schlüssel aus dem Namen ableiten („Projekt Phoenix“ → „projekt-phoenix“). */
export function slugifyKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "kategorie"
  );
}
