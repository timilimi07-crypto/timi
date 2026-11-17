import { fetchJson } from "../http";
import { ensureAccessToken } from "../oauth";
import { htmlToText, MAX_HTML_LENGTH, MAX_TEXT_LENGTH } from "../parse";
import { cleanMessageId } from "../threading";
import type { Address, ChangeList, FetchedMessage, MailConnector, OAuthCredentials, ProviderCursor } from "../types";

const API = "https://graph.microsoft.com/v1.0";

type GraphRecipient = { emailAddress: { name?: string; address?: string } };
type GraphMessage = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  replyTo?: GraphRecipient[];
  receivedDateTime: string;
  body?: { contentType: "html" | "text"; content: string };
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageHeaders?: { name: string; value: string }[];
};
type GraphAttachment = { id: string; name?: string; contentType?: string; size?: number; isInline?: boolean; contentId?: string };
type DeltaPage = {
  value: { id: string; receivedDateTime?: string; "@removed"?: unknown }[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

type OutlookCursor = { deltaLink: string };

function toAddress(r?: GraphRecipient): Address | null {
  const email = r?.emailAddress?.address?.toLowerCase();
  if (!email) return null;
  return r?.emailAddress.name ? { name: r.emailAddress.name, email } : { email };
}

/**
 * Outlook / Microsoft 365 / Exchange Online über Microsoft Graph.
 * Delta-Abfrage auf den Posteingang: erster Aufruf mit Datumsfilter, danach
 * nur Änderungen über den gespeicherten deltaLink.
 */
export class OutlookConnector implements MailConnector {
  constructor(
    private readonly creds: OAuthCredentials,
    private readonly onRefresh: (c: OAuthCredentials) => Promise<void>,
  ) {}

  private async get<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
    const token = await ensureAccessToken("microsoft", this.creds, this.onRefresh);
    return fetchJson<T>(url.startsWith("http") ? url : `${API}${url}`, {
      provider: "Microsoft 365",
      headers: { Authorization: `Bearer ${token}`, ...headers },
    });
  }

  async verify() {
    const me = await this.get<{ mail?: string; userPrincipalName?: string }>("/me?$select=mail,userPrincipalName");
    return { emailAddress: (me?.mail ?? me?.userPrincipalName)?.toLowerCase() };
  }

  async listChanges(cursor: ProviderCursor | null, since: Date): Promise<ChangeList> {
    const c = cursor as OutlookCursor | null;
    let url: string | undefined =
      c?.deltaLink ??
      `/me/mailFolders/inbox/messages/delta?$select=id,receivedDateTime&$filter=receivedDateTime+ge+${since.toISOString()}`;
    const items: { id: string; received: number }[] = [];
    let deltaLink = c?.deltaLink ?? "";

    while (url) {
      const page: DeltaPage | null = await this.get<DeltaPage>(url, { Prefer: "odata.maxpagesize=200" });
      if (!page) {
        // deltaLink ungültig → neu ab `since` (Dubletten werden beim Speichern übersprungen).
        if (c?.deltaLink) return this.listChanges(null, since);
        break;
      }
      for (const v of page.value) {
        if (!v["@removed"]) items.push({ id: v.id, received: v.receivedDateTime ? Date.parse(v.receivedDateTime) : 0 });
      }
      url = page["@odata.nextLink"];
      if (page["@odata.deltaLink"]) deltaLink = page["@odata.deltaLink"];
    }

    items.sort((a, b) => b.received - a.received);
    return { ids: [...new Set(items.map((i) => i.id))], cursor: { deltaLink } satisfies OutlookCursor };
  }

  async fetchMessage(id: string): Promise<FetchedMessage | null> {
    const select =
      "id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,replyTo,receivedDateTime,body,isRead,hasAttachments,internetMessageHeaders";
    const m = await this.get<GraphMessage>(`/me/messages/${encodeURIComponent(id)}?$select=${select}`, {
      Prefer: 'outlook.body-content-type="html"',
    });
    if (!m) return null;

    const header = (name: string) => m.internetMessageHeaders?.find((h) => h.name.toLowerCase() === name)?.value;
    const html = m.body?.contentType === "html" ? m.body.content : undefined;
    const text = (html ? htmlToText(html) : (m.body?.content ?? "")).slice(0, MAX_TEXT_LENGTH);

    let attachments: FetchedMessage["attachments"] = [];
    if (m.hasAttachments) {
      const list = await this.get<{ value: GraphAttachment[] }>(
        `/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline`,
      );
      attachments = (list?.value ?? [])
        .filter((a) => !a.isInline)
        .map((a) => ({
          filename: a.name ?? "Anhang",
          mimeType: a.contentType ?? "application/octet-stream",
          size: a.size ?? 0,
          providerAttachmentId: a.id,
        }));
    }

    const inReplyTo = cleanMessageId(header("in-reply-to"));
    const replyTo = toAddress(m.replyTo?.[0]);
    return {
      providerMessageId: m.id,
      ...(m.conversationId ? { providerThreadId: m.conversationId } : {}),
      ...(cleanMessageId(m.internetMessageId) ? { messageIdHeader: cleanMessageId(m.internetMessageId) } : {}),
      ...(inReplyTo ? { inReplyTo } : {}),
      references: (header("references") ?? "").split(/\s+/).map(cleanMessageId).filter((x): x is string => !!x),
      subject: m.subject?.trim() || "(kein Betreff)",
      from: toAddress(m.from) ?? { email: "unbekannt@unbekannt" },
      to: (m.toRecipients ?? []).map(toAddress).filter((a): a is Address => !!a),
      cc: (m.ccRecipients ?? []).map(toAddress).filter((a): a is Address => !!a),
      ...(replyTo ? { replyTo: replyTo.email } : {}),
      date: new Date(m.receivedDateTime),
      text,
      ...(html ? { html: html.slice(0, MAX_HTML_LENGTH) } : {}),
      isRead: m.isRead ?? false,
      attachments,
    };
  }

  async close() {}
}
