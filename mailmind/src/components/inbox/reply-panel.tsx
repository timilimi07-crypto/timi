"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { EmailDetail } from "./data";

type Tone = "FORMAL" | "CASUAL" | "SHORT";
const TONES: [Tone, string][] = [
  ["FORMAL", "Förmlich"],
  ["CASUAL", "Locker"],
  ["SHORT", "Kurz"],
];

export type ReplyPanelHandle = { generate: () => void };

/** Antwortvorschlag auf Knopfdruck (R). MailMind verschickt nichts – Kopieren oder im E-Mail-Programm öffnen. */
export const ReplyPanel = forwardRef<ReplyPanelHandle, { email: EmailDetail; aiEnabled: boolean }>(function ReplyPanel({ email, aiEnabled }, ref) {
  const [tone, setTone] = useState<Tone>("FORMAL");
  const [text, setText] = useState(email.replyDrafts[0]?.body ?? "");
  const [subject, setSubject] = useState(`AW: ${email.subject.replace(/^(AW|RE|Re|Aw):\s*/i, "")}`);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(email.replyDrafts[0]?.body ?? "");
  }, [email.id, email.replyDrafts]);

  async function generate(t: Tone = tone) {
    if (!aiEnabled) {
      toast.error("Antwortvorschläge brauchen einen ANTHROPIC_API_KEY.");
      return;
    }
    setBusy(true);
    container.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const r = await api<{ subject: string; draft: { body: string } }>(`/api/emails/${email.id}/reply`, { body: { tone: t } });
      setText(r.draft.body);
      setSubject(r.subject);
      requestAnimationFrame(() => area.current?.focus());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({ generate: () => void generate() }));

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const mailto = `mailto:${encodeURIComponent(email.replyTo ?? email.fromEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return (
    <div ref={container} className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Antwortvorschlag
        </h3>
        <div className="flex rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="Ton">
          {TONES.map(([v, label]) => (
            <button
              key={v}
              role="radio"
              aria-checked={tone === v}
              onClick={() => setTone(v)}
              className={cn("rounded px-2 py-0.5", tone === v ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={() => generate()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {text ? "Neu vorschlagen" : "Vorschlag erstellen"}
          <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">R</Kbd>
        </Button>
      </div>
      {(text || busy) && (
        <>
          <textarea
            ref={area}
            value={busy ? "Wird erstellt …" : text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={Math.min(18, Math.max(6, text.split("\n").length + 1))}
            className="mt-3 w-full resize-y rounded-md border bg-background p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
            aria-label="Antworttext"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={copy} disabled={!text || busy}>
              {copied ? <Check /> : <Copy />} {copied ? "Kopiert" : "Kopieren"}
            </Button>
            <Button size="sm" variant="outline" asChild disabled={!text || busy}>
              <a href={mailto}>
                <ExternalLink /> Im E-Mail-Programm öffnen
              </a>
            </Button>
            <span className="text-xs text-muted-foreground">Platzhalter in [eckigen Klammern] vor dem Senden ersetzen.</span>
          </div>
        </>
      )}
    </div>
  );
});
