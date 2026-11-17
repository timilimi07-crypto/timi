"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { EmailDetail } from "@/server/queries/email-detail";
import type { EmailListItem, EmailPage, InboxFilters } from "@/server/queries/emails";

/**
 * Datenzugriff für den Posteingang (TanStack Query).
 * - Liste: unendliche Abfrage pro Filterkombination
 * - Details: eigener Cache-Eintrag pro E-Mail → Vorladen der nächsten E-Mails
 * - Aktionen: optimistisch (Liste/Details sofort ändern, bei Fehler zurückrollen)
 */

export type { EmailDetail, EmailListItem, EmailPage, InboxFilters };
export type ListData = InfiniteData<EmailPage, string | null>;
type StatusValue = EmailListItem["status"];

/** Filter → URL-Parameter (ohne Standardwerte, stabile Reihenfolge). */
export function filtersToParams(f: Partial<InboxFilters>): URLSearchParams {
  const p = new URLSearchParams();
  const defaults: Record<string, unknown> = { view: "open", sort: "newest" };
  for (const key of Object.keys(f).sort() as (keyof InboxFilters)[]) {
    const v = f[key];
    if (v === undefined || v === null || v === "" || v === false || defaults[key] === v) continue;
    p.set(key, v === true ? "1" : String(v));
  }
  return p;
}

export const listKey = (f: Partial<InboxFilters>) => ["emails", filtersToParams(f).toString()] as const;
export const detailKey = (id: string, images = false) => ["email", id, images] as const;

export async function fetchListPage(f: Partial<InboxFilters>, cursor: string | null): Promise<EmailPage> {
  const p = filtersToParams(f);
  if (cursor) p.set("cursor", cursor);
  return api<EmailPage>(`/api/emails?${p}`);
}

export const fetchDetail = (id: string, images = false) => api<EmailDetail>(`/api/emails/${id}${images ? "?images=1" : ""}`);

/** Detail vorladen (z. B. nächste E-Mail beim Durchklicken, Hover). */
export function prefetchDetail(qc: QueryClient, id: string) {
  return qc.prefetchQuery({ queryKey: detailKey(id), queryFn: () => fetchDetail(id), staleTime: 60_000 });
}

/** Alle geladenen Listen gleichzeitig ändern (verschiedene Filter teilen sich Zeilen). */
function updateLists(qc: QueryClient, fn: (items: EmailListItem[]) => EmailListItem[]) {
  qc.setQueriesData<ListData>({ queryKey: ["emails"] }, (old) =>
    old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: fn(p.items) })) } : old,
  );
}

export function patchRow(qc: QueryClient, id: string, patch: Partial<EmailListItem>) {
  updateLists(qc, (items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

function patchDetail(qc: QueryClient, id: string, patch: Partial<EmailDetail>) {
  for (const images of [false, true]) {
    qc.setQueryData<EmailDetail>(detailKey(id, images), (old) => (old ? { ...old, ...patch } : old));
  }
}

function snapshot(qc: QueryClient) {
  return [...qc.getQueriesData({ queryKey: ["emails"] }), ...qc.getQueriesData({ queryKey: ["email"] })];
}
function restore(qc: QueryClient, snap: ReturnType<typeof snapshot>) {
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

/**
 * Status ändern (Erledigt / wieder öffnen) – optimistisch, mit „Rückgängig“.
 * Die Zeile verschwindet sofort aus Listen, in die sie nicht mehr passt.
 */
export function useStatusAction() {
  const qc = useQueryClient();
  const undoStack = useRef<{ id: string; status: StatusValue }[][]>([]);

  const restoreMutation = useMutation({
    mutationFn: (items: { id: string; status: StatusValue }[]) => api("/api/emails/restore-status", { body: { items } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["emails"] }),
    onSuccess: () => toast.success("Rückgängig gemacht"),
    onError: (err) => toast.error((err as Error).message),
  });

  const undo = useCallback(() => {
    const last = undoStack.current.pop();
    if (last?.length) restoreMutation.mutate(last);
  }, [restoreMutation]);

  const mutation = useMutation({
    mutationFn: (v: { id: string; threadId: string | null; status: StatusValue; removeFromList: boolean; label: string }) =>
      api<{ previous: { id: string; status: StatusValue }[] }>(`/api/emails/${v.id}/status`, { body: { status: v.status, scope: "thread" } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["emails"] });
      const snap = snapshot(qc);
      if (v.removeFromList) {
        updateLists(qc, (items) => items.filter((i) => i.id !== v.id && (!v.threadId || i.threadId !== v.threadId)));
      } else {
        patchRow(qc, v.id, { status: v.status });
      }
      patchDetail(qc, v.id, { status: v.status });
      return { snap };
    },
    onError: (err, _v, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      toast.error(`Konnte nicht gespeichert werden: ${(err as Error).message}`);
    },
    onSuccess: (data, v) => {
      undoStack.current.push(data.previous);
      toast.success(v.label, { action: { label: "Rückgängig (Z)", onClick: undo }, duration: 5000 });
    },
  });

  return { setStatus: mutation.mutate, undo };
}

/** Gelesen/ungelesen, Kategorie, Priorität, „Einordnung passt“ – optimistisch. */
export function useEmailPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown>; rowPatch: Partial<EmailListItem>; detailPatch?: Partial<EmailDetail>; silent?: boolean }) =>
      api<{ correctionsSaved: number }>(`/api/emails/${v.id}`, { method: "PATCH", body: v.body }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["emails"] });
      const snap = snapshot(qc);
      patchRow(qc, v.id, v.rowPatch);
      patchDetail(qc, v.id, { ...(v.rowPatch as Partial<EmailDetail>), ...v.detailPatch });
      return { snap };
    },
    onError: (err, _v, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      toast.error(`Konnte nicht gespeichert werden: ${(err as Error).message}`);
    },
    onSuccess: (r, v) => {
      if (v.silent) return;
      toast.success(r.correctionsSaved ? "Gespeichert – die KI lernt aus dieser Korrektur." : "Gespeichert");
    },
  });
}

/** Geöffnet: gelesen markieren + Audit (fire-and-forget, optimistisch). */
export function markOpened(qc: QueryClient, id: string) {
  patchRow(qc, id, { isRead: true });
  patchDetail(qc, id, { isRead: true });
  void api(`/api/emails/${id}/open`, { method: "POST" }).catch(() => {});
}

export function useTaskToggle(emailId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; status: "OPEN" | "DONE" }) => api(`/api/tasks/${v.taskId}`, { method: "PATCH", body: { status: v.status } }),
    onMutate: (v) => {
      const snap = snapshot(qc);
      for (const images of [false, true]) {
        qc.setQueryData<EmailDetail>(detailKey(emailId, images), (old) =>
          old ? { ...old, tasks: old.tasks.map((t) => (t.id === v.taskId ? { ...t, status: v.status } : t)) } : old,
        );
      }
      updateLists(qc, (items) => items.map((i) => (i.id === emailId ? { ...i, openTasks: Math.max(0, i.openTasks + (v.status === "DONE" ? -1 : 1)) } : i)));
      return { snap };
    },
    onError: (err, _v, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      toast.error((err as Error).message);
    },
  });
}
