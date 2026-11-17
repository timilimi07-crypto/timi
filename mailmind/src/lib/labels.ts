/** Deutsche Bezeichnungen und Farben für Priorität, Status und Stimmung. */
export const PRIORITY_META = {
  URGENT: { label: "Dringend", badge: "bg-red-500/12 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  HIGH: { label: "Hoch", badge: "bg-orange-500/12 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  NORMAL: { label: "Normal", badge: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-400" },
  LOW: { label: "Niedrig", badge: "bg-zinc-500/8 text-zinc-500 dark:text-zinc-400", dot: "bg-zinc-300 dark:bg-zinc-600" },
} as const;

export type PriorityKey = keyof typeof PRIORITY_META;
export const PRIORITY_ORDER: PriorityKey[] = ["URGENT", "HIGH", "NORMAL", "LOW"];

export const SENTIMENT_LABEL = { POSITIVE: "positiv", NEUTRAL: "neutral", NEGATIVE: "verärgert" } as const;

export const STATUS_LABEL = { NEW: "Neu", IN_PROGRESS: "In Bearbeitung", WAITING: "Wartet", DONE: "Erledigt" } as const;
