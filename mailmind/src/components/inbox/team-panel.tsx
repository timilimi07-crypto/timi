"use client";

import { useState } from "react";
import { History, LoaderCircle, MessageSquare, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { UserInitials } from "@/components/shared/user-initials";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useComments, type EmailDetail } from "./data";

const relFmt = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
function relative(iso: string): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "gerade eben";
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return relFmt.format(Math.round(diff / 86400), "day");
  return formatDateTime(new Date(iso));
}

/**
 * Interne Zusammenarbeit an einem Verlauf: angeheftete Notizen, Kommentare
 * und der Bearbeitungsverlauf („wer hat was gemacht“). Nie für Absender sichtbar.
 */
export function TeamPanel({ email, currentUserId, isAdmin }: { email: EmailDetail; currentUserId: string; isAdmin: boolean }) {
  const { add, remove, pin } = useComments(email.id);
  const [text, setText] = useState("");
  const [asNote, setAsNote] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const notes = email.comments.filter((c) => c.isNote);
  const comments = email.comments.filter((c) => !c.isNote);

  function submit() {
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate({ body, isNote: asNote }, { onSuccess: () => { setText(""); setAsNote(false); } });
  }

  const item = (c: EmailDetail["comments"][number]) => (
    <li key={c.id} className={cn("group rounded-lg px-3 py-2", c.isNote ? "border border-amber-500/30 bg-amber-500/10" : "bg-muted/50")}>
      <div className="flex items-center gap-2 text-xs">
        <UserInitials name={c.author.name} me={c.author.id === currentUserId} />
        <span className="font-medium">{c.author.name}</span>
        <span className="text-muted-foreground" title={formatDateTime(new Date(c.createdAt))}>
          {relative(c.createdAt)}
          {c.edited ? " · bearbeitet" : ""}
        </span>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <Button variant="ghost" size="icon-sm" className="size-6" aria-label={c.isNote ? "Notiz lösen" : "Als Notiz anheften"} onClick={() => pin.mutate({ commentId: c.id, isNote: !c.isNote })}>
            {c.isNote ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
          {(c.author.id === currentUserId || isAdmin) && (
            <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Löschen" onClick={() => remove.mutate(c.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
    </li>
  );

  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="size-4 text-muted-foreground" /> Intern
          <span className="font-normal text-muted-foreground">· nur für das Team sichtbar</span>
        </h2>
        <button type="button" onClick={() => setShowActivity((s) => !s)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-expanded={showActivity}>
          <History className="size-3.5" /> Verlauf ({email.activity.length})
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Angeheftete Notizen">
          {notes.map(item)}
        </ul>
      )}
      {comments.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Kommentare">
          {comments.map(item)}
        </ul>
      )}

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={asNote ? "Notiz für alle, die diesen Verlauf bearbeiten …" : "Kommentar schreiben … (z. B. „Habe die Kundin angerufen“)"}
          aria-label="Interner Kommentar"
          className="w-full resize-y rounded-md border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" className="accent-[var(--primary)]" checked={asNote} onChange={(e) => setAsNote(e.target.checked)} />
            Als Notiz anheften
          </label>
          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
            <Kbd>⌘</Kbd>/<Kbd>Strg</Kbd> + <Kbd>Enter</Kbd>
          </span>
          <Button size="sm" onClick={submit} disabled={!text.trim() || add.isPending}>
            {add.isPending && <LoaderCircle className="animate-spin" />}
            {asNote ? "Notiz anheften" : "Kommentieren"}
          </Button>
        </div>
      </div>

      {showActivity && (
        <ol className="mt-4 space-y-1.5 border-l pl-3 text-xs" aria-label="Bearbeitungsverlauf">
          {email.activity.length === 0 && <li className="text-muted-foreground">Noch keine Bearbeitung.</li>}
          {email.activity.map((a) => (
            <li key={a.id}>
              <span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.text}</span>
              <span className="ml-1.5 text-muted-foreground/70" title={formatDateTime(new Date(a.at))}>
                · {relative(a.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
