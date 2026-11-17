/**
 * Farbpalette für Kategorien/Labels. Klassen stehen hier als vollständige
 * Strings, damit Tailwind sie beim Build erkennt (keine dynamischen Klassennamen).
 */
export const COLOR_CLASSES = {
  zinc: { dot: "bg-zinc-400", badge: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
  blue: { dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  amber: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  rose: { dot: "bg-rose-500", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  cyan: { dot: "bg-cyan-500", badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  orange: { dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  slate: { dot: "bg-slate-400", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  red: { dot: "bg-red-500", badge: "bg-red-500/10 text-red-700 dark:text-red-300" },
} as const;

export type ColorName = keyof typeof COLOR_CLASSES;

export function colorClasses(color: string | null | undefined) {
  return COLOR_CLASSES[(color as ColorName) ?? "zinc"] ?? COLOR_CLASSES.zinc;
}
