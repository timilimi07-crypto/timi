"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { modelColor } from "@/lib/ai/colors";
import { formatShortDay, formatUsd } from "@/lib/format";


export type ChartModel = { id: string; label: string };
type Row = { day: string; total: number } & Record<string, number | string>;

function CostTooltip({ active, payload, label, models }: TooltipContentProps<number, string> & { models: ChartModel[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload as Row;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-foreground">{formatShortDay(String(label))}</div>
      {models.map((m) => (
        <div key={m.id} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-sm" style={{ background: modelColor(m.id) }} />
          <span className="flex-1 text-muted-foreground">{m.label}</span>
          <span className="tabular-nums text-foreground">{formatUsd(Number(row[m.id] ?? 0))}</span>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between border-t pt-1.5 font-medium text-foreground">
        <span>Gesamt</span>
        <span className="tabular-nums">{formatUsd(row.total)}</span>
      </div>
    </div>
  );
}

/** Gestapelte Tageskosten der letzten 30 Tage, je Modell eine Farbe. */
export function AiCostChart({ data, models }: { data: Row[]; models: ChartModel[] }) {
  // Auf schmalen Bildschirmen nur die letzten 14 Tage, damit die Balken lesbar bleiben.
  const [compact, setCompact] = useState(false);
  const shown = compact ? data.slice(-14) : data;
  return (
    <div className="h-48 w-full" role="img" aria-label={`KI-Kosten pro Tag der letzten ${shown.length} Tage, gestapelt nach Modell`}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setCompact(w < 480)}>
        <BarChart data={shown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickFormatter={formatShortDay}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatUsd(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.6 }}
            content={(props) => <CostTooltip {...(props as TooltipContentProps<number, string>)} models={models} />}
          />
          {models.map((m, i) => (
            <Bar
              key={m.id}
              dataKey={m.id}
              stackId="cost"
              fill={modelColor(m.id)}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === models.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
