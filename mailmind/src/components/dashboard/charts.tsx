"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatShortDay } from "@/lib/format";

/**
 * Dashboard-Diagramme. Je eine Datenreihe → eine Farbe (--series-1), keine
 * Legende nötig (der Titel benennt die Reihe), Werte per Hover und als Beschriftung.
 */

const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

function Tip({ active, payload, label, render }: TooltipContentProps<number, string> & { render: (p: Record<string, unknown>, label: string) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">{render(payload[0]!.payload as Record<string, unknown>, String(label))}</div>;
}

export function EmailsPerDayChart({ data }: { data: { day: string; total: number; urgent: number }[] }) {
  return (
    <div className="h-44 w-full" role="img" aria-label={`E-Mails pro Tag, letzte ${data.length} Tage`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickFormatter={formatShortDay} tickLine={false} axisLine={false} minTickGap={16} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.6 }}
            content={(p) => (
              <Tip
                {...(p as TooltipContentProps<number, string>)}
                render={(row) => (
                  <>
                    <div className="mb-1 font-medium text-foreground">{weekday.format(new Date(`${row.day as string}T12:00:00Z`))}</div>
                    <div className="tabular-nums text-foreground">{row.total as number} E-Mails</div>
                    {(row.urgent as number) > 0 && <div className="tabular-nums text-muted-foreground">davon {row.urgent as number} dringend</div>}
                  </>
                )}
              />
            )}
          />
          <Bar dataKey="total" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmailsPerCategoryChart({ data }: { data: { name: string; count: number }[] }) {
  const height = Math.max(120, data.length * 30 + 10);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label="E-Mails pro Kategorie, letzte 7 Tage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.6 }}
            content={(p) => (
              <Tip
                {...(p as TooltipContentProps<number, string>)}
                render={(row) => (
                  <span className="text-foreground">
                    {row.name as string}: <span className="tabular-nums font-medium">{row.count as number}</span>
                  </span>
                )}
              />
            )}
          />
          <Bar dataKey="count" fill="var(--series-1)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
