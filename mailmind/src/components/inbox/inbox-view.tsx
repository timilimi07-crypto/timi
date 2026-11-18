"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Keyboard, LoaderCircle, SearchX } from "lucide-react";
import { SyncButton } from "@/components/shared/sync-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { PRIORITY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fetchListPage, filtersToParams, listKey, markOpened, prefetchDetail, useAssign, useEmailPatch, useStatusAction, type EmailPage, type InboxFilters } from "./data";
import { EmailDetailPane } from "./email-detail";
import { EmailRow } from "./email-row";
import { FilterBar, type FilterOptions } from "./filter-bar";
import type { ReplyPanelHandle } from "./reply-panel";

/** Wie lange eine E-Mail ausgewählt sein muss, bis sie als gelesen gilt (schnelles j/k markiert nicht alles). */
const READ_DWELL_MS = 700;

const SHORTCUTS: [string[], string][] = [
  [["J", "↓"], "Nächste E-Mail"],
  [["K", "↑"], "Vorherige E-Mail"],
  [["E"], "Erledigt / wieder öffnen"],
  [["Z"], "Letzte Aktion rückgängig"],
  [["R"], "Antwortvorschlag erstellen"],
  [["U"], "Gelesen / ungelesen"],
  [["A"], "Übernehmen (mir zuweisen)"],
  [["1", "2", "3", "4"], "Priorität: Dringend, Hoch, Normal, Niedrig"],
  [["/"], "Suchen"],
  [["⌘", "K"], "Befehlspalette"],
  [["G", "I"], "Zum Posteingang (G D Dashboard)"],
  [["?"], "Diese Übersicht"],
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function InboxView({
  initialFilters,
  initialPage,
  initialSelectedId,
  options,
  showCosts,
  aiEnabled,
  title,
  currentUserId,
  canAssignOthers,
}: {
  initialFilters: InboxFilters;
  initialPage: EmailPage;
  initialSelectedId: string | null;
  options: FilterOptions;
  showCosts: boolean;
  aiEnabled: boolean;
  title: string;
  currentUserId: string;
  canAssignOthers: boolean;
}) {
  const qc = useQueryClient();
  const desktop = useIsDesktop();
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [mobileOpen, setMobileOpen] = useState(!!initialSelectedId);
  const [helpOpen, setHelpOpen] = useState(false);
  const userSelected = useRef(!!initialSelectedId);
  const searchRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<ReplyPanelHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialKey = useRef(listKey(initialFilters)[1]);

  const query = useInfiniteQuery({
    queryKey: listKey(filters),
    queryFn: ({ pageParam }) => fetchListPage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: listKey(filters)[1] === initialKey.current ? { pages: [initialPage], pageParams: [null] } : undefined,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const index = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
  const selectedRow = index >= 0 ? items[index] : undefined;

  const { setStatus, undo } = useStatusAction();
  const patch = useEmailPatch();
  const assign = useAssign();

  // --- URL synchron halten (ohne Neuladen der Seite) ---
  useEffect(() => {
    const p = filtersToParams(filters);
    if (selectedId) p.set("id", selectedId);
    const url = `/inbox${p.size ? `?${p}` : ""}`;
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url);
  }, [filters, selectedId]);

  // --- Auf dem Desktop immer eine E-Mail anzeigen (erst wenn die neue Liste da ist,
  //     nicht aus der noch angezeigten alten Liste während eines Filterwechsels) ---
  useEffect(() => {
    if (desktop && !selectedId && !query.isPlaceholderData && items[0]) setSelectedId(items[0].id);
  }, [desktop, selectedId, items, query.isPlaceholderData]);

  // --- Vorladen: nächste zwei und vorherige E-Mail; bei Listenende nächste Seite ---
  useEffect(() => {
    if (index < 0) return;
    for (const off of [1, 2, -1]) {
      const n = items[index + off];
      if (n) void prefetchDetail(qc, n.id);
    }
    if (index >= items.length - 5 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [index, items, qc, query]);

  // --- Gelesen + Audit erst nach kurzer Verweildauer ---
  useEffect(() => {
    if (!selectedId || !userSelected.current || (!desktop && !mobileOpen)) return;
    const row = items.find((i) => i.id === selectedId);
    if (row?.isRead) return;
    const t = setTimeout(() => markOpened(qc, selectedId), READ_DWELL_MS);
    return () => clearTimeout(t);
  }, [selectedId, desktop, mobileOpen, items, qc]);

  // --- Ausgewählte Zeile sichtbar halten ---
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-email-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const select = useCallback((id: string) => {
    userSelected.current = true;
    setSelectedId(id);
    setMobileOpen(true);
  }, []);

  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onHover = useCallback(
    (id: string) => {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => void prefetchDetail(qc, id), 60);
    },
    [qc],
  );

  const move = useCallback(
    (delta: number) => {
      const next = items[Math.min(Math.max(index + delta, 0), items.length - 1)];
      if (next) {
        userSelected.current = true;
        setSelectedId(next.id);
      }
    },
    [index, items],
  );

  const toggleDone = useCallback(() => {
    if (!selectedRow) return;
    const newStatus = selectedRow.status === "DONE" ? "NEW" : "DONE";
    const removeFromList =
      !!filters.status || (newStatus === "DONE" && filters.view === "open") || (newStatus !== "DONE" && filters.view === "done");
    if (removeFromList) {
      // Sofort zur nächsten E-Mail springen (optimistisch).
      const next = items[index + 1] ?? items[index - 1];
      setSelectedId(next?.id ?? null);
      if (!next) setMobileOpen(false);
    }
    setStatus({
      id: selectedRow.id,
      threadId: selectedRow.threadId,
      status: newStatus,
      removeFromList,
      label: newStatus === "DONE" ? "Erledigt" : "Wieder geöffnet",
    });
  }, [selectedRow, filters, items, index, setStatus]);

  const toggleRead = useCallback(() => {
    if (!selectedRow) return;
    userSelected.current = false; // nicht sofort wieder als gelesen markieren
    patch.mutate({ id: selectedRow.id, body: { isRead: !selectedRow.isRead }, rowPatch: { isRead: !selectedRow.isRead }, detailPatch: { isRead: !selectedRow.isRead }, silent: true });
  }, [selectedRow, patch]);

  const setPriority = useCallback(
    (n: number) => {
      const p = PRIORITY_ORDER[n - 1];
      if (!selectedRow || !p || selectedRow.priority === p) return;
      patch.mutate({ id: selectedRow.id, body: { priority: p }, rowPatch: { priority: p, needsReview: false }, detailPatch: { manualOverride: true } });
    },
    [selectedRow, patch],
  );

  const takeOver = useCallback(() => {
    if (!selectedRow || selectedRow.assignee?.id === currentUserId) return;
    const me = options.users.find((u) => u.id === currentUserId);
    if (me) assign.mutate({ id: selectedRow.id, threadId: selectedRow.threadId, assignee: me, label: "Übernommen" });
  }, [selectedRow, currentUserId, options.users, assign]);

  const onFilterChange = useCallback((p: Partial<InboxFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setSelectedId(null);
    userSelected.current = false;
    listRef.current?.scrollTo({ top: 0 });
  }, []);

  useHotkeys(
    {
      j: () => move(1),
      arrowdown: () => move(1),
      k: () => move(-1),
      arrowup: () => move(-1),
      e: toggleDone,
      z: undo,
      u: toggleRead,
      a: takeOver,
      r: () => {
        setMobileOpen(true);
        replyRef.current?.generate();
      },
      "/": () => searchRef.current?.focus(),
      "?": () => setHelpOpen(true),
      enter: () => selectedId && setMobileOpen(true),
      escape: () => setMobileOpen(false),
      1: () => setPriority(1),
      2: () => setPriority(2),
      3: () => setPriority(3),
      4: () => setPriority(4),
    },
    !helpOpen,
  );

  // Endlos-Scrollen: nächste Seite laden, sobald das Listenende sichtbar wird.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const loadingFirst = query.isPending && !query.data;

  return (
    <div className="flex h-full min-h-0">
      {/* Liste */}
      <section
        aria-label="E-Mail-Liste"
        className={cn("flex min-h-0 w-full flex-col border-r lg:w-[440px] lg:shrink-0 xl:w-[480px]", mobileOpen && "hidden lg:flex")}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          {query.isFetching && !query.isFetchingNextPage && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label="Lädt" />}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setHelpOpen(true)} aria-label="Tastaturkürzel">
              <Keyboard />
            </Button>
            <SyncButton />
          </div>
        </div>
        <FilterBar filters={filters} options={options} onChange={onFilterChange} searchRef={searchRef} />

        <div ref={listRef} className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-thin transition-opacity", query.isPlaceholderData && "opacity-60")}>
          {loadingFirst ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5 border-b px-4 py-3">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="mb-3 grid size-10 place-items-center rounded-full bg-muted">
                {filters.q ? <SearchX className="size-5 text-muted-foreground" /> : <Inbox className="size-5 text-muted-foreground" />}
              </span>
              <p className="text-sm font-medium">{filters.q ? "Keine Treffer" : filters.view === "open" ? "Alles erledigt 🎉" : "Keine E-Mails"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filters.q ? "Andere Suchbegriffe oder weniger Filter probieren." : "Hier gibt es gerade nichts zu tun."}
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <EmailRow key={item.id} item={item} selected={item.id === selectedId} showCosts={showCosts} currentUserId={currentUserId} onSelect={select} onHover={onHover} />
              ))}
              <div ref={sentinel} className="h-10">
                {query.isFetchingNextPage && <LoaderCircle className="mx-auto mt-3 size-4 animate-spin text-muted-foreground" />}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Detail */}
      <section aria-label="E-Mail-Detail" className={cn("min-h-0 min-w-0 flex-1", !mobileOpen && "hidden lg:block")}>
        {selectedId ? (
          <EmailDetailPane
            key={selectedId}
            ref={replyRef}
            id={selectedId}
            row={selectedRow}
            categories={options.categories}
            users={options.users}
            labels={options.labels}
            currentUserId={currentUserId}
            canAssignOthers={canAssignOthers}
            isAdmin={canAssignOthers && showCosts}
            showCosts={showCosts}
            aiEnabled={aiEnabled}
            position={{ index, total: items.length }}
            onBack={() => setMobileOpen(false)}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
            onToggleDone={toggleDone}
            onToggleRead={toggleRead}
            onSelectEmail={select}
          />
        ) : (
          <div className="hidden h-full place-items-center text-sm text-muted-foreground lg:grid">
            <div className="text-center">
              <Inbox className="mx-auto mb-2 size-6" />
              Keine E-Mail ausgewählt
              <p className="mt-1 text-xs">
                Mit <Kbd>J</Kbd> und <Kbd>K</Kbd> durch die Liste, <Kbd>?</Kbd> für alle Kürzel.
              </p>
            </div>
          </div>
        )}
      </section>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogTitle className="mb-3 text-base font-semibold">Tastaturkürzel</DialogTitle>
          <ul className="space-y-1.5">
            {SHORTCUTS.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
