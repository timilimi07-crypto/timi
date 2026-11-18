"use client";

import { memo } from "react";
import { AlertTriangle, ListTodo, Paperclip, ShieldAlert, Sparkles } from "lucide-react";
import { colorClasses } from "@/lib/colors";
import { formatUsd, shortDate } from "@/lib/format";
import { PRIORITY_META, type PriorityKey } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { EmailListItem } from "./data";


/** Roter Warnhinweis für mögliche Phishing-Mails (Liste und Detail). */
export function PhishingBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm dark:bg-red-500",
        className,
      )}
    >
      <ShieldAlert className="size-3" /> Möglicher Phishing-Versuch
    </span>
  );
}

/** Eine Zeile im Posteingang (ein Thread). Memoisiert – Liste bleibt bei j/k flüssig. */
export const EmailRow = memo(function EmailRow({
  item,
  selected,
  showCosts,
  onSelect,
  onHover,
}: {
  item: EmailListItem;
  selected: boolean;
  showCosts: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
}) {
  const prio = item.priority ? PRIORITY_META[item.priority as PriorityKey] : null;
  const pending = item.aiStatus === "PENDING" || item.aiStatus === "PROCESSING";

  return (
    <button
      type="button"
      data-email-id={item.id}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onMouseEnter={() => onHover(item.id)}
      className={cn(
        "relative block w-full border-b px-4 py-2.5 text-left outline-none transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/50",
        item.phishingSuspected && !selected && "bg-red-500/[0.04]",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-primary")} aria-label={item.isRead ? undefined : "ungelesen"} />
        <span className={cn("min-w-0 truncate text-[13px]", item.isRead ? "text-foreground/80" : "font-semibold text-foreground")}>
          {item.fromName || item.fromEmail}
        </span>
        {item.thread && item.thread.messageCount > 1 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.thread.messageCount}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {prio && (item.priority === "URGENT" || item.priority === "HIGH") && (
            <span className={cn("rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide", prio.badge)}>{prio.label}</span>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground">{shortDate(item.receivedAt)}</span>
        </span>
      </div>

      <div className="mt-0.5 flex items-center gap-1.5 pl-3.5">
        <span className={cn("truncate text-[13px]", item.isRead ? "text-muted-foreground" : "text-foreground")}>{item.subject}</span>
        {item.hasAttachments && <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Anhang" />}
      </div>

      <p className="mt-0.5 line-clamp-1 pl-3.5 text-xs text-muted-foreground">
        {item.summary ? (
          <>
            <Sparkles className="mr-1 inline size-3 -translate-y-px text-primary" aria-label="KI-Zusammenfassung" />
            {item.summary}
          </>
        ) : (
          item.snippet
        )}
      </p>

      {(item.phishingSuspected || item.category || item.needsReview || item.openTasks > 0 || pending || (showCosts && item.aiModels.length > 0)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-3.5">
          {item.phishingSuspected && <PhishingBadge />}
          {item.category && (
            <span className={cn("rounded px-1.5 py-px text-[10px] font-medium", colorClasses(item.category.color).badge)}>{item.category.name}</span>
          )}
          {item.needsReview && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300" title={item.reviewReason ?? undefined}>
              <AlertTriangle className="size-2.5" /> Bitte prüfen
            </span>
          )}
          {item.openTasks > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ListTodo className="size-3" /> {item.openTasks}
            </span>
          )}
          {pending && <span className="text-[10px] text-muted-foreground">KI-Auswertung ausstehend</span>}
          {showCosts && item.aiModels.length > 0 && (
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/80" title="KI-Kosten (nur Admins)">
              {formatUsd(item.aiCostUsd)}
            </span>
          )}
        </div>
      )}
    </button>
  );
});
