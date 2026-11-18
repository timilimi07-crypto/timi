"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical, ListTodo, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PhishingBadge } from "@/components/inbox/email-row";
import { UserInitials } from "@/components/shared/user-initials";
import { shortDate } from "@/lib/format";
import { api } from "@/lib/api-client";
import { colorClasses } from "@/lib/colors";
import { PRIORITY_META, STATUS_LABEL, type PriorityKey } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { EmailListItem } from "@/server/queries/emails";

import { STATUSES, type Columns, type Status } from "./statuses";

const COLUMN_HINT: Record<Status, string> = {
  NEW: "Noch niemand dran",
  IN_PROGRESS: "Wird bearbeitet",
  WAITING: "Wartet auf Antwort/Rückmeldung",
  DONE: "Zuletzt erledigt",
};

function Card({ item, dragging, overlay }: { item: EmailListItem; dragging?: boolean; overlay?: boolean }) {
  const prio = item.priority ? PRIORITY_META[item.priority as PriorityKey] : null;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs transition-shadow",
        dragging && "opacity-40",
        overlay && "rotate-1 shadow-lg ring-2 ring-primary/30",
        item.phishingSuspected && "border-red-500/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        {prio && <span className={cn("rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide", prio.badge)}>{prio.label}</span>}
        <span className={cn("truncate text-xs", item.isRead ? "text-muted-foreground" : "font-semibold")}>{item.fromName ?? item.fromEmail}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {item.assignee && <UserInitials name={item.assignee.name} />}
          <span className="text-[11px] tabular-nums text-muted-foreground">{shortDate(item.receivedAt)}</span>
        </span>
      </div>
      <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{item.subject}</div>
      {item.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {item.phishingSuspected && <PhishingBadge />}
        {item.category && <span className={cn("rounded px-1.5 py-px text-[10px] font-medium", colorClasses(item.category.color).badge)}>{item.category.name}</span>}
        {item.needsReview && <span className="rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">Bitte prüfen</span>}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {item.hasAttachments && <Paperclip className="size-3" />}
          {item.openTasks > 0 && (
            <span className="flex items-center gap-0.5">
              <ListTodo className="size-3" /> {item.openTasks}
            </span>
          )}
          {item.thread && item.thread.messageCount > 1 && <span>{item.thread.messageCount} Nachr.</span>}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ item, status, onMove }: { item: EmailListItem; status: Status; onMove: (id: string, to: Status) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, data: { item } });
  return (
    <div ref={setNodeRef} className="group relative" data-kanban-card={item.id}>
      <Link href={`/inbox?view=all&id=${item.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Card item={item} dragging={isDragging} />
      </Link>
      {/* Touch-Geräte: Status direkt wählen (zuverlässiger als Ziehen über den Bildschirmrand). */}
      <select
        aria-label={`Status von „${item.subject}“ ändern`}
        value={status}
        onChange={(e) => onMove(item.id, e.target.value as Status)}
        className="mt-1 hidden h-8 w-full rounded-md border bg-background px-2 text-xs text-muted-foreground [@media(hover:none)]:block"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            Status: {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`„${item.subject}“ verschieben (Leertaste, dann ← →, Leertaste zum Ablegen)`}
        className="absolute right-1 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  );
}

function Column({ status, items, total, onMove }: { status: Status; items: EmailListItem[]; total: number; onMove: (id: string, to: Status) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS_LABEL[status]}
      data-kanban-column={status}
      className={cn(
        "flex min-h-0 w-[85vw] shrink-0 snap-start flex-col rounded-xl border bg-muted/30 sm:w-72 xl:w-auto xl:flex-1",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{total}</span>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">{COLUMN_HINT[status]}</span>
      </header>
      <div className="min-h-24 flex-1 space-y-2 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {items.map((i) => (
          <DraggableCard key={i.id} item={i} status={status} onMove={onMove} />
        ))}
        {items.length === 0 && <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Hierher ziehen</p>}
      </div>
    </section>
  );
}

/**
 * Tastatur: ← / → springen direkt zur Nachbarspalte (statt in kleinen
 * Pixelschritten), Leertaste legt ab.
 */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();
  const activeId = context.active?.id;
  const current =
    (context.over?.id as Status | undefined) ??
    (STATUSES.find((s) => document.querySelector(`[data-kanban-column="${s}"] [data-kanban-card="${String(activeId)}"]`)) as Status | undefined);
  const idx = current ? STATUSES.indexOf(current) : 0;
  const next = STATUSES[Math.min(Math.max(idx + (event.code === "ArrowRight" ? 1 : -1), 0), STATUSES.length - 1)]!;
  const rect = context.droppableRects.get(next);
  if (!rect) return currentCoordinates;
  return { x: rect.left + 16, y: rect.top + 56 };
};

/**
 * Kanban: Verläufe nach Bearbeitungsstatus. Verschieben per Maus (ziehen)
 * oder Tastatur (Griff fokussieren, Leertaste, Pfeiltasten, Leertaste).
 * Optimistisch: Karte springt sofort, bei Fehler zurück; mit „Rückgängig“.
 */
export function KanbanBoard({ initial }: { initial: Columns }) {
  const router = useRouter();
  const [cols, setCols] = useState(initial);
  const [active, setActive] = useState<EmailListItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }));

  const statusOf = (id: string) => STATUSES.find((s) => cols[s].some((i) => i.id === id));

  function move(state: Columns, id: string, to: Status): Columns {
    const from = STATUSES.find((s) => state[s].some((i) => i.id === id));
    if (!from || from === to) return state;
    const item = state[from].find((i) => i.id === id)!;
    const moved = { ...item, status: to };
    const target = [moved, ...state[to]].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    return { ...state, [from]: state[from].filter((i) => i.id !== id), [to]: target };
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const to = e.over?.id as Status | undefined;
    if (to) void moveTo(String(e.active.id), to);
  }

  async function moveTo(id: string, to: Status) {
    const from = statusOf(id);
    if (!to || !from || to === from) return;
    const before = cols;
    setCols((c) => move(c, id, to));
    try {
      const r = await api<{ previous: { id: string; status: Status }[] }>(`/api/emails/${id}/status`, { body: { status: to, scope: "thread" } });
      toast.success(`Nach „${STATUS_LABEL[to]}“ verschoben`, {
        action: {
          label: "Rückgängig",
          onClick: async () => {
            setCols((c) => move(c, id, from));
            try {
              await api("/api/emails/restore-status", { body: { items: r.previous } });
            } catch (err) {
              toast.error((err as Error).message);
              router.refresh();
            }
          },
        },
      });
    } catch (err) {
      setCols(before);
      toast.error(`Konnte nicht verschoben werden: ${(err as Error).message}`);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActive((e.active.data.current as { item: EmailListItem }).item)}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "Leertaste zum Aufnehmen, Pfeil links/rechts wechselt die Spalte, Leertaste zum Ablegen, Escape zum Abbrechen." },
      }}
    >
      <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {STATUSES.map((s) => (
          <Column key={s} status={s} items={cols[s]} total={cols[s].length} onMove={(id, to) => void moveTo(id, to)} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-72"><Card item={active} overlay /></div> : null}</DragOverlay>
    </DndContext>
  );
}
