import { fetchJson } from "../http";
import { ensureAccessToken } from "../oauth";
import { parseRawMessage } from "../parse";
import type { ChangeList, FetchedMessage, MailConnector, OAuthCredentials, ProviderCursor } from "../types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
/** Sicherheitsgrenze für die Erstliste (das Zeitfenster begrenzt ohnehin). */
const MAX_INITIAL_IDS = 5000;

type GmailCursor = { historyId: string };

/**
 * Gmail-Anbindung über die REST-API (nur Lesezugriff).
 * Erster Abruf: messages.list mit "after:<Datum>", danach inkrementell über
 * history.list. Ist die historyId zu alt (404), wird ab `since` neu gelistet.
 */
export class GmailConnector implements MailConnector {
  constructor(
    private readonly creds: OAuthCredentials,
    private readonly onRefresh: (c: OAuthCredentials) => Promise<void>,
  ) {}

  private async get<T>(path: string): Promise<T | null> {
    const token = await ensureAccessToken("google", this.creds, this.onRefresh);
    return fetchJson<T>(`${API}${path}`, { provider: "Gmail", headers: { Authorization: `Bearer ${token}` } });
  }

  async verify() {
    const p = await this.get<{ emailAddress: string }>("/profile");
    return { emailAddress: p?.emailAddress };
  }

  private async listSince(since: Date): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    const q = encodeURIComponent(`in:inbox after:${Math.floor(since.getTime() / 1000)}`);
    do {
      const page = await this.get<{ messages?: { id: string }[]; nextPageToken?: string }>(
        `/messages?q=${q}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      ids.push(...(page?.messages ?? []).map((m) => m.id));
      pageToken = page?.nextPageToken;
    } while (pageToken && ids.length < MAX_INITIAL_IDS);
    return ids; // Gmail liefert neueste zuerst.
  }

  async listChanges(cursor: ProviderCursor | null, since: Date): Promise<ChangeList> {
    const c = cursor as GmailCursor | null;
    const profile = await this.get<{ historyId: string }>("/profile");
    const latestHistoryId = profile?.historyId ?? c?.historyId ?? "0";

    if (c?.historyId) {
      const added: string[] = [];
      let pageToken: string | undefined;
      let expired = false;
      do {
        const page = await this.get<{
          history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[];
          nextPageToken?: string;
        }>(`/history?startHistoryId=${c.historyId}&historyTypes=messageAdded&labelId=INBOX${pageToken ? `&pageToken=${pageToken}` : ""}`);
        if (!page) {
          expired = true;
          break;
        }
        for (const h of page.history ?? []) for (const m of h.messagesAdded ?? []) added.push(m.message.id);
        pageToken = page.nextPageToken;
      } while (pageToken);

      if (!expired) {
        return { ids: [...new Set(added)].reverse(), cursor: { historyId: latestHistoryId } satisfies GmailCursor };
      }
    }
    return { ids: await this.listSince(since), cursor: { historyId: latestHistoryId } satisfies GmailCursor };
  }

  async fetchMessage(id: string): Promise<FetchedMessage | null> {
    const m = await this.get<{ id: string; threadId: string; labelIds?: string[]; internalDate: string; raw: string }>(
      `/messages/${id}?format=raw`,
    );
    if (!m) return null;
    return parseRawMessage(Buffer.from(m.raw, "base64url"), {
      providerMessageId: m.id,
      providerThreadId: m.threadId,
      isRead: !(m.labelIds ?? []).includes("UNREAD"),
      fallbackDate: new Date(Number(m.internalDate)),
    });
  }

  async close() {}
}
