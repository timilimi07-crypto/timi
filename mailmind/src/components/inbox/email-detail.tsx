"use client";

import { forwardRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Mail,
  MailOpen,
  Paperclip,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { modelLabel } from "@/lib/ai/models";
import { colorClasses } from "@/lib/colors";
import { formatDateTime, formatUsd } from "@/lib/format";
import { PRIORITY_META, PRIORITY_ORDER, SENTIMENT_LABEL, STATUS_LABEL, type PriorityKey } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { BodyFrame } from "./body-frame";
import { detailKey, fetchDetail, useEmailPatch, useTaskToggle, type EmailDetail, type EmailListItem } from "./data";
import { PhishingBadge, shortDate } from "./email-row";
import { ReplyPanel, type ReplyPanelHandle } from "./reply-panel";

const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30";

const pct = (v: number | null) => (v == null ? null : `${Math.round(v * 100)} %`);
const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
const dueFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

function IconAction({ label, kbd, onClick, children, disabled }: { label: string; kbd?: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} {kbd && <span className="ml-1 opacity-70">{kbd}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export type DetailProps = {
  id: string;
  row?: EmailListItem;
  categories: { key: string; name: string }[];
  showCosts: boolean;
  aiEnabled: boolean;
  position: { index: number; total: number };
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleDone: () => void;
  onToggleRead: () => void;
  onSelectEmail: (id: string) => void;
};

/** Rechte Spalte: Original, KI-Auswertung, Aufgaben, Verlauf, Antwortvorschlag. */
export const EmailDetailPane = forwardRef<ReplyPanelHandle, DetailProps>(function EmailDetailPane(props, replyRef) {
  const { id, row } = props;
  const [images, setImages] = useState(false);
  const { data, isError, refetch } = useQuery({
    queryKey: detailKey(id, images),
    queryFn: () => fetchDetail(id, images),
    staleTime: 60_000,
  });
  const patch = useEmailPatch();
  const tasks = useTaskToggle(id);

  // Kopfbereich sofort aus der Listenzeile zeigen, Rest sobald geladen (meist schon vorgeladen).
  const subject = data?.subject ?? row?.subject ?? "";
  const status = data?.status ?? row?.status ?? "NEW";
  const isRead = data?.isRead ?? row?.isRead ?? true;
  const done = status === "DONE";
  const priority = (data?.priority ?? row?.priority ?? null) as PriorityKey | null;
  const categoryKey = data?.category?.key ?? row?.category?.key ?? null;

  function setClassification(body: { categoryKey?: string; priority?: PriorityKey }) {
    const cat = body.categoryKey ? props.categories.find((c) => c.key === body.categoryKey) : undefined;
    const prevColor = data?.category?.color ?? row?.category?.color ?? "zinc";
    patch.mutate({
      id,
      body,
      rowPatch: {
        ...(body.priority ? { priority: body.priority } : {}),
        ...(cat ? { category: { key: cat.key, name: cat.name, color: prevColor } } : {}),
        needsReview: false,
      },
      detailPatch: { manualOverride: true },
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Werkzeugleiste */}
      <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
        <Button variant="ghost" size="icon-sm" onClick={props.onBack} className="lg:hidden" aria-label="Zurück zur Liste">
          <ArrowLeft />
        </Button>
        <Button variant={done ? "outline" : "default"} size="sm" onClick={props.onToggleDone}>
          {done ? <RotateCcw /> : <CircleCheck />}
          {done ? "Wieder öffnen" : "Erledigt"}
          <Kbd className={cn("ml-0.5", !done && "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground")}>E</Kbd>
        </Button>
        <select
          aria-label="Status"
          className={selectCls}
          value={status}
          onChange={(e) =>
            patch.mutate({ id, body: { status: e.target.value }, rowPatch: { status: e.target.value as EmailListItem["status"] }, silent: true })
          }
        >
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <IconAction label={isRead ? "Als ungelesen markieren" : "Als gelesen markieren"} kbd="U" onClick={props.onToggleRead}>
          {isRead ? <Mail /> : <MailOpen />}
        </IconAction>
        <div className="ml-auto flex items-center gap-0.5">
          <span className="mr-1 hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {props.position.index >= 0 ? `${props.position.index + 1} von ${props.position.total}` : ""}
          </span>
          <IconAction label="Vorherige" kbd="K" onClick={props.onPrev} disabled={props.position.index <= 0}>
            <ChevronUp />
          </IconAction>
          <IconAction label="Nächste" kbd="J" onClick={props.onNext} disabled={props.position.index < 0 || props.position.index >= props.position.total - 1}>
            <ChevronDown />
          </IconAction>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <article className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
          {/* Kopf */}
          <header className="space-y-2">
            <h1 className="text-lg font-semibold leading-snug tracking-tight">{subject}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {(data?.phishingSuspected ?? row?.phishingSuspected) && <PhishingBadge />}
              {priority && <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", PRIORITY_META[priority].badge)}>{PRIORITY_META[priority].label}</span>}
              {(data?.category ?? row?.category) && (
                <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", colorClasses((data?.category ?? row?.category)!.color).badge)}>
                  {(data?.category ?? row?.category)!.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{data?.mailbox.name ?? row?.mailbox.name}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{data?.fromName ?? row?.fromName ?? data?.fromEmail ?? row?.fromEmail}</span>{" "}
              <span className="text-muted-foreground">&lt;{data?.fromEmail ?? row?.fromEmail}&gt;</span>
              <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(new Date(data?.receivedAt ?? row?.receivedAt ?? Date.now()))}</span>
            </div>
            {data && (data.to.length > 0 || data.cc.length > 0) && (
              <div className="text-xs text-muted-foreground">
                An: {data.to.map((a) => a.name ?? a.email).join(", ")}
                {data.cc.length > 0 && <> · Cc: {data.cc.map((a) => a.name ?? a.email).join(", ")}</>}
              </div>
            )}
          </header>

          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Die E-Mail konnte nicht geladen werden.{" "}
              <button className="font-medium underline" onClick={() => refetch()}>
                Erneut versuchen
              </button>
            </div>
          )}

          {/* Phishing-Warnung */}
          {data?.phishingSuspected && (
            <div role="alert" className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                <ShieldAlert className="size-5" /> Möglicher Phishing-Versuch
              </div>
              {data.phishingReason && <p className="mt-1.5 text-red-800/90 dark:text-red-200/90">{data.phishingReason}</p>}
              <p className="mt-2 text-xs text-red-800/80 dark:text-red-200/80">
                Keine Links oder Anhänge öffnen und keine Daten eingeben. Im Zweifel beim Absender über eine bekannte Telefonnummer nachfragen – nicht über
                Kontaktdaten aus dieser E-Mail.
              </p>
            </div>
          )}

          {/* Bitte prüfen */}
          {data?.needsReview && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
              <AlertTriangle className="size-4 text-amber-600" />
              <span className="font-medium text-amber-900 dark:text-amber-200">Bitte prüfen:</span>
              <span className="text-amber-900/80 dark:text-amber-200/80">{data.reviewReason ?? "Die KI war sich unsicher."}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7"
                onClick={() => patch.mutate({ id, body: { confirmReview: true }, rowPatch: { needsReview: false }, detailPatch: { needsReview: false } })}
              >
                <Check /> Einordnung passt
              </Button>
            </div>
          )}

          {/* KI-Auswertung */}
          <section className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> KI-Auswertung
              </h2>
              <div className="flex items-center gap-1.5">
                <select aria-label="Kategorie ändern" className={selectCls} value={categoryKey ?? ""} onChange={(e) => setClassification({ categoryKey: e.target.value })}>
                  {!categoryKey && <option value="">Kategorie …</option>}
                  {props.categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select aria-label="Priorität ändern" className={selectCls} value={priority ?? ""} onChange={(e) => setClassification({ priority: e.target.value as PriorityKey })}>
                  {!priority && <option value="">Priorität …</option>}
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!data ? (
              <div className="mt-3 space-y-2">
                {row?.summary ? <p className="text-sm leading-relaxed">{row.summary}</p> : <Skeleton className="h-4 w-4/5" />}
                <Skeleton className="h-4 w-2/5" />
              </div>
            ) : data.aiStatus === "DONE" ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed">{data.summary}</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Priorität</dt>
                    <dd>
                      {priority ? PRIORITY_META[priority].label : "–"}
                      {pct(data.priorityConfidence) && <span className="text-muted-foreground"> · Sicherheit {pct(data.priorityConfidence)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Kategorie</dt>
                    <dd>
                      {data.category?.name ?? "–"}
                      {pct(data.categoryConfidence) && <span className="text-muted-foreground"> · Sicherheit {pct(data.categoryConfidence)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Stimmung</dt>
                    <dd className={cn(data.sentiment === "NEGATIVE" && "font-medium text-red-600 dark:text-red-400")}>
                      {data.sentiment ? SENTIMENT_LABEL[data.sentiment] : "–"}
                    </dd>
                  </div>
                </dl>
                {data.priorityReason && <p className="text-xs text-muted-foreground">Begründung: {data.priorityReason}</p>}
                {data.manualOverride && <p className="text-xs text-muted-foreground">Einordnung manuell festgelegt – die KI ändert sie nicht mehr.</p>}

                {data.tasks.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Aufgaben</h3>
                    <ul className="space-y-1">
                      {data.tasks.map((t) => (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent/50">
                            <input
                              type="checkbox"
                              className="mt-1 accent-[var(--primary)]"
                              checked={t.status === "DONE"}
                              onChange={(e) => tasks.mutate({ taskId: t.id, status: e.target.checked ? "DONE" : "OPEN" })}
                            />
                            <span className={cn("flex-1", t.status === "DONE" && "text-muted-foreground line-through")}>{t.title}</span>
                            {t.dueDate && (
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground" title={t.dueDateText ?? undefined}>
                                bis {dueFmt.format(new Date(t.dueDate))}
                              </span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.entities.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Erkannte Daten</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {data.entities.map((en) => (
                        <span key={en.id} className="rounded-md border bg-background px-2 py-0.5 text-xs">
                          <span className="text-muted-foreground">{en.label}: </span>
                          {en.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {props.showCosts && data.aiModels.length > 0 && (
                  <p className="border-t pt-2 text-[11px] text-muted-foreground">
                    Ausgewertet mit {data.aiModels.map(modelLabel).join(" + ")} · Kosten {formatUsd(data.aiCostUsd)}{" "}
                    <span className="opacity-70">(nur für Admins sichtbar)</span>
                  </p>
                )}
              </div>
            ) : data.aiStatus === "FAILED" ? (
              <p className="mt-3 text-sm text-destructive">Auswertung fehlgeschlagen: {data.aiError}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">KI-Auswertung ausstehend – erscheint automatisch, sobald sie fertig ist.</p>
            )}
          </section>

          {/* Verlauf */}
          {data?.thread && (
            <section className="rounded-xl border bg-card p-4 shadow-xs">
              <h2 className="text-sm font-semibold">Verlauf · {data.thread.messageCount} Nachrichten</h2>
              {data.thread.summary && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{data.thread.summary}</p>}
              <ol className="mt-3 space-y-0.5 border-l pl-3">
                {data.thread.messages.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => !m.isCurrent && props.onSelectEmail(m.id)}
                      className={cn("w-full rounded-md px-2 py-1 text-left text-xs transition-colors", m.isCurrent ? "bg-accent" : "hover:bg-accent/50")}
                    >
                      <span className="font-medium">{m.fromName ?? m.fromEmail}</span>
                      <span className="ml-2 text-muted-foreground">{shortDate(m.receivedAt)}</span>
                      <span className="mt-0.5 line-clamp-1 block text-muted-foreground">{m.summary ?? m.snippet}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Original */}
          <section className="rounded-xl border bg-card p-4 shadow-xs">
            <h2 className="mb-3 text-sm font-semibold">Original</h2>
            {data ? (
              <BodyFrame body={data.body} onLoadImages={() => setImages(true)} />
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}
            {data && data.attachments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                {data.attachments.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                    <Paperclip className="size-3 text-muted-foreground" />
                    {a.filename}
                    <span className="text-muted-foreground">{formatSize(a.size)}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {data && <ReplyPanel ref={replyRef} email={data as EmailDetail} aiEnabled={props.aiEnabled} />}
        </article>
      </div>
    </div>
  );
});
