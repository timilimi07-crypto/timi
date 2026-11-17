"use client";

import { useEffect, useRef } from "react";

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

/** true, wenn der Fokus in einem Eingabefeld liegt – dann keine Kürzel auslösen. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Leichtgewichtige Tastaturkürzel.
 * Schlüssel-Syntax: "k", "shift+e", "mod+k" (mod = ⌘ auf Mac, Strg sonst)
 * und Sequenzen mit Leerzeichen, z. B. "g i" (innerhalb von 1 s).
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const combo = [mod && "mod", e.shiftKey && key.length > 1 && "shift", e.altKey && "alt", key]
        .filter(Boolean)
        .join("+");

      // Kombinationen mit mod funktionieren auch in Eingabefeldern (z. B. ⌘K).
      if (!mod && isTypingTarget(e.target)) return;

      const handlers = mapRef.current;
      if (pending) {
        const seq = `${pending} ${key}`;
        pending = null;
        clearTimeout(timer);
        if (handlers[seq]) {
          e.preventDefault();
          handlers[seq](e);
          return;
        }
      }
      if (handlers[combo]) {
        e.preventDefault();
        handlers[combo](e);
        return;
      }
      // Beginn einer Sequenz?
      if (!mod && Object.keys(handlers).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        timer = setTimeout(() => (pending = null), 1000);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [enabled]);
}
