import { z } from "zod";

/**
 * Zentral validierte Umgebungsvariablen. Fehlkonfiguration fällt so beim
 * ersten Zugriff mit einer verständlichen Meldung auf statt irgendwo tief im Code.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET muss mindestens 16 Zeichen lang sein"),
  NEXTAUTH_URL: z.string().optional(),
  /** 32 Byte, base64-kodiert – Schlüssel für Postfach-Zugangsdaten. */
  ENCRYPTION_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Hauptmodell (Standard Sonnet 5.5) – siehe src/lib/ai/models.ts */
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  /** Modell für einfache Aufgaben (Standard Haiku 5.5) */
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("MailMind <no-reply@mailmind.local>"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Ungültige Umgebungsvariablen:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
