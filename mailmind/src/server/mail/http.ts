import { MailboxError } from "./types";

/**
 * fetch-Wrapper für Gmail/Graph mit verständlichen Fehlermeldungen.
 * 404 liefert null (z. B. Nachricht inzwischen gelöscht).
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { provider: string },
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(30_000) });
  } catch (err) {
    throw new MailboxError(`${init.provider} ist nicht erreichbar. Bitte später erneut versuchen.`, "network", { cause: err });
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new MailboxError(
      `Zugriff auf ${init.provider} verweigert. Bitte das Postfach in den Einstellungen neu verbinden.`,
      "auth",
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MailboxError(`${init.provider} meldet Fehler ${res.status}: ${body.slice(0, 200)}`, "provider");
  }
  return (await res.json()) as T;
}
