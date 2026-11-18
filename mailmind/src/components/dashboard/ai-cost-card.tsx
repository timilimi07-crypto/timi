import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { modelLabel } from "@/lib/ai/models";
import { formatInt, formatUsd } from "@/lib/format";
import type { AiCostStats } from "@/server/queries/ai-costs";
import { modelColor } from "@/lib/ai/colors";
import { AiCostChart } from "./ai-cost-chart";

/** Reihenfolge im Stapel: günstigstes Modell unten. */
const STACK_ORDER = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];
const rank = (id: string) => (STACK_ORDER.includes(id) ? STACK_ORDER.indexOf(id) : STACK_ORDER.length);

/** KI-Kosten für Admins: heute, Monat, Hochrechnung, Verlauf und Aufteilung nach Modell. */
export function AiCostCard({
  stats,
  models,
  providerNote,
}: {
  stats: AiCostStats;
  models: { main: string; fast: string };
  /** z. B. „Ollama (lokal) aktiv – keine API-Kosten“ */
  providerNote?: string;
}) {
  const used = new Set([...stats.byModelMonth.map((m) => m.model), ...stats.daily.flatMap((d) => Object.keys(d.byModel))]);
  const chartModels = [...used]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => ({ id, label: modelLabel(id) }));
  const data = stats.daily.map((d) => ({ day: d.day, total: d.total, ...d.byModel }));
  const delta = stats.previousMonth > 0 ? (stats.monthForecast - stats.previousMonth) / stats.previousMonth : null;

  const tiles = [
    { label: "Heute", value: formatUsd(stats.today) },
    { label: "Dieser Monat", value: formatUsd(stats.month), hint: `${formatInt(stats.callsMonth)} KI-Aufrufe` },
    {
      label: "Hochrechnung Monat",
      value: formatUsd(stats.monthForecast),
      hint:
        delta === null
          ? "kein Vormonat"
          : `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} % ggü. Vormonat (${formatUsd(stats.previousMonth)})`,
      trend: delta,
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> KI-Kosten
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {providerNote ?? `Hauptmodell ${modelLabel(models.main)} · Einfache Aufgaben ${modelLabel(models.fast)}`} · nur für Admins sichtbar
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg bg-muted/50 px-3 py-2.5">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">{t.value}</div>
            {t.hint && (
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                {t.trend != null && (t.trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />)}
                {t.hint}
              </div>
            )}
          </div>
        ))}
      </div>

      {chartModels.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Noch keine KI-Aufrufe protokolliert.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_15rem]">
          <div>
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
              {chartModels.map((m) => (
                <span key={m.id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: modelColor(m.id) }} />
                  {m.label}
                </span>
              ))}
              <span className="ml-auto hidden sm:inline">Letzte 30 Tage</span>
              <span className="ml-auto sm:hidden">Letzte 14 Tage</span>
            </div>
            <AiCostChart data={data} models={chartModels} />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Nach Modell (dieser Monat)</div>
            <table className="w-full text-sm">
              <tbody>
                {stats.byModelMonth.map((m) => (
                  <tr key={m.model} className="border-b last:border-none">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-sm" style={{ background: modelColor(m.model) }} />
                        <span className="truncate">{modelLabel(m.model)}</span>
                      </span>
                      <span className="block pl-4 text-[11px] text-muted-foreground">{formatInt(m.calls)} Aufrufe</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
