/**
 * Feste Diagrammfarbe je KI-Modell (Farbe folgt dem Modell, nicht seiner
 * Reihenfolge). Werte als CSS-Variablen, definiert in globals.css für Hell/Dunkel.
 * Bewusst kein Client-Modul, damit Server- und Client-Komponenten es nutzen können.
 */
export const MODEL_COLORS: Record<string, string> = {
  "claude-haiku-5-5": "var(--series-haiku)",
  "claude-sonnet-5-5": "var(--series-sonnet)",
  "claude-opus-5-5": "var(--series-opus)",
};

export const FALLBACK_MODEL_COLOR = "var(--muted-foreground)";

export const modelColor = (id: string) => MODEL_COLORS[id] ?? FALLBACK_MODEL_COLOR;
