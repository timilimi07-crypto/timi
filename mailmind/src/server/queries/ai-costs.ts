import "server-only";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";

export type DailyCost = { day: string; byModel: Record<string, number>; total: number };

export type AiCostStats = {
  today: number;
  month: number;
  previousMonth: number;
  /** Hochrechnung für den laufenden Monat auf Basis der bisherigen Tage. */
  monthForecast: number;
  callsMonth: number;
  byModelMonth: { model: string; cost: number; calls: number; inputTokens: number; outputTokens: number }[];
  daily: DailyCost[];
};

/**
 * KI-Kosten einer Firma (Grundlage: AiUsageLog). Tages- und Monatsgrenzen
 * werden in Europe/Berlin berechnet, damit „heute“ dem Kalendertag der Nutzer entspricht.
 */
export async function getAiCostStats(organizationId: string, days = 30): Promise<AiCostStats> {
  const [totals] = await db.$queryRaw<{ today: number; month: number; prev: number; calls: bigint; days_elapsed: number; days_in_month: number }[]>`
    WITH now_local AS (SELECT (NOW() AT TIME ZONE ${TIME_ZONE}) AS t)
    SELECT
      COALESCE(SUM("costUsd") FILTER (WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})::date = (SELECT t FROM now_local)::date), 0)::float AS today,
      COALESCE(SUM("costUsd") FILTER (WHERE date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE}) = date_trunc('month', (SELECT t FROM now_local))), 0)::float AS month,
      COALESCE(SUM("costUsd") FILTER (WHERE date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE}) = date_trunc('month', (SELECT t FROM now_local)) - interval '1 month'), 0)::float AS prev,
      COUNT(*) FILTER (WHERE date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE}) = date_trunc('month', (SELECT t FROM now_local))) AS calls,
      EXTRACT(DAY FROM (SELECT t FROM now_local))::int AS days_elapsed,
      EXTRACT(DAY FROM (date_trunc('month', (SELECT t FROM now_local)) + interval '1 month - 1 day'))::int AS days_in_month
    FROM "AiUsageLog"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" AT TIME ZONE 'UTC' >= NOW() - interval '70 days'`;

  const byModel = await db.$queryRaw<{ model: string; cost: number; calls: bigint; input: bigint; output: bigint }[]>`
    SELECT model, SUM("costUsd")::float AS cost, COUNT(*) AS calls, SUM("inputTokens") AS input, SUM("outputTokens") AS output
    FROM "AiUsageLog"
    WHERE "organizationId" = ${organizationId}
      AND date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE}) = date_trunc('month', NOW() AT TIME ZONE ${TIME_ZONE})
    GROUP BY model
    ORDER BY cost DESC`;

  const dailyRows = await db.$queryRaw<{ day: string; model: string; cost: number }[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS day, model, SUM("costUsd")::float AS cost
    FROM "AiUsageLog"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" AT TIME ZONE 'UTC' >= (date_trunc('day', NOW() AT TIME ZONE ${TIME_ZONE}) - make_interval(days => ${days - 1}::int)) AT TIME ZONE ${TIME_ZONE}
    GROUP BY 1, 2`;

  // Lückenlose Tagesreihe (auch Tage ohne Kosten).
  const daily: DailyCost[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD
  for (let i = days - 1; i >= 0; i--) {
    const day = fmt.format(new Date(Date.now() - i * 86_400_000));
    const rows = dailyRows.filter((r) => r.day === day);
    const entry: DailyCost = { day, byModel: {}, total: 0 };
    for (const r of rows) {
      entry.byModel[r.model] = r.cost;
      entry.total += r.cost;
    }
    daily.push(entry);
  }

  const t = totals ?? { today: 0, month: 0, prev: 0, calls: 0n, days_elapsed: 1, days_in_month: 30 };
  return {
    today: t.today,
    month: t.month,
    previousMonth: t.prev,
    monthForecast: t.days_elapsed > 0 ? (t.month / t.days_elapsed) * t.days_in_month : t.month,
    callsMonth: Number(t.calls),
    byModelMonth: byModel.map((m) => ({
      model: m.model,
      cost: m.cost,
      calls: Number(m.calls),
      inputTokens: Number(m.input),
      outputTokens: Number(m.output),
    })),
    daily,
  };
}
