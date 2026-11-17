import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MailboxError } from "@/server/mail/types";
import { HttpError } from "@/server/session";

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

/**
 * Einheitliche Fehlerbehandlung für Route Handler:
 * HttpError → Status, Validierungsfehler → 400 mit deutscher Meldung,
 * Postfach-Fehler → 400 mit Klartext, alles andere → 500 ohne interne Details.
 */
export function apiRoute<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const data = await handler(req, ctx);
      if (data instanceof Response) return data;
      return NextResponse.json(data ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: first?.message ?? "Ungültige Eingabe", field: first?.path.join(".") },
          { status: 400 },
        );
      }
      if (err instanceof MailboxError) return NextResponse.json({ error: err.message, kind: err.kind }, { status: 400 });
      console.error("[api]", err);
      return NextResponse.json({ error: "Interner Fehler. Bitte später erneut versuchen." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Ungültiger JSON-Inhalt");
  }
}
