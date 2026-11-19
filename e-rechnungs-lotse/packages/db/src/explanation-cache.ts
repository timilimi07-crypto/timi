import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { explanationCache } from "./schema";

/** Erklärungseintrag – strukturgleich zu `ExplanationEntry` aus @erl/core (ohne Abhängigkeit). */
export interface CachedExplanation {
  titel: string;
  erklaerung_einfach: string;
  was_tun: string;
  betrifft_mich_als_empfaenger: boolean;
}

/** Implementiert das `ExplanationCache`-Interface aus @erl/core auf PostgreSQL. */
export function createDbExplanationCache(db: Db) {
  return {
    async get(ruleId: string): Promise<CachedExplanation | null> {
      const [row] = await db
        .select()
        .from(explanationCache)
        .where(eq(explanationCache.ruleId, ruleId))
        .limit(1);
      return row
        ? {
            titel: row.titel,
            erklaerung_einfach: row.erklaerungEinfach,
            was_tun: row.wasTun,
            betrifft_mich_als_empfaenger: row.betrifftMichAlsEmpfaenger,
          }
        : null;
    },
    async set(ruleId: string, e: CachedExplanation): Promise<void> {
      await db
        .insert(explanationCache)
        .values({
          ruleId,
          titel: e.titel,
          erklaerungEinfach: e.erklaerung_einfach,
          wasTun: e.was_tun,
          betrifftMichAlsEmpfaenger: e.betrifft_mich_als_empfaenger,
        })
        .onConflictDoNothing();
    },
  };
}
