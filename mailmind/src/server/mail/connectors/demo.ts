import { DEMO_EMAILS, DEMO_RECIPIENTS, type DemoEmail, type DemoSet } from "../demo/emails";
import type { ChangeList, FetchedMessage, MailConnector, ProviderCursor } from "../types";

type DemoCursor = { listed: string[] };

const messageId = (id: string) => `${id}@demo.mailmind.local`;

/**
 * Demo-Postfach: liefert die Beispiel-E-Mails aus demo/emails.ts so, als kämen
 * sie von einem echten Server. Zeitpunkte sind relativ zum Anlegen des
 * Postfachs (`anchor`); E-Mails mit negativem `minutesAgo` „treffen später ein“.
 */
export class DemoConnector implements MailConnector {
  private readonly emails: DemoEmail[];
  private readonly byId: Map<string, DemoEmail>;

  constructor(
    private readonly set: DemoSet,
    private readonly anchor: Date,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.emails = DEMO_EMAILS.filter((e) => e.set === set);
    this.byId = new Map(DEMO_EMAILS.map((e) => [e.id, e]));
  }

  private receivedAt(e: DemoEmail): Date {
    return new Date(this.anchor.getTime() - e.minutesAgo * 60_000);
  }

  async verify() {
    return { emailAddress: DEMO_RECIPIENTS[this.set].email };
  }

  async listChanges(cursor: ProviderCursor | null, since: Date): Promise<ChangeList> {
    const listed = new Set((cursor as DemoCursor | null)?.listed ?? []);
    const now = this.now().getTime();
    const fresh = this.emails
      .filter((e) => !listed.has(e.id))
      .filter((e) => {
        const t = this.receivedAt(e).getTime();
        return t <= now && t >= since.getTime();
      })
      .sort((a, b) => a.minutesAgo - b.minutesAgo); // neueste zuerst
    for (const e of fresh) listed.add(e.id);
    return { ids: fresh.map((e) => e.id), cursor: { listed: [...listed] } satisfies DemoCursor };
  }

  /** Referenzkette eines Threads, Wurzel zuerst. */
  private references(e: DemoEmail): string[] {
    const chain: string[] = [];
    let parent = e.inReplyTo ? this.byId.get(e.inReplyTo) : undefined;
    while (parent) {
      chain.unshift(messageId(parent.id));
      parent = parent.inReplyTo ? this.byId.get(parent.inReplyTo) : undefined;
    }
    return chain;
  }

  async fetchMessage(id: string): Promise<FetchedMessage | null> {
    const e = this.byId.get(id);
    if (!e || e.set !== this.set) return null;
    return {
      providerMessageId: e.id,
      messageIdHeader: messageId(e.id),
      ...(e.inReplyTo ? { inReplyTo: messageId(e.inReplyTo) } : {}),
      references: this.references(e),
      subject: e.subject,
      from: e.from,
      to: [DEMO_RECIPIENTS[this.set]],
      cc: e.cc ?? [],
      date: this.receivedAt(e),
      text: e.text,
      isRead: e.isRead ?? false,
      attachments: (e.attachments ?? []).map((a, i) => ({ ...a, providerAttachmentId: `demo:${i}` })),
    };
  }

  async close() {}
}
