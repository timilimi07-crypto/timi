"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/** Fehlergrenze für alle App-Seiten – zeigt eine verständliche Meldung statt eines weißen Bildschirms. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-6 pt-20">
      <EmptyState
        icon={AlertTriangle}
        title="Da ist etwas schiefgelaufen"
        description={
          process.env.NODE_ENV === "development"
            ? error.message
            : "Die Seite konnte nicht geladen werden. Bitte versuche es erneut."
        }
        action={<Button onClick={reset}>Erneut versuchen</Button>}
      />
      {error.digest && <p className="mt-3 text-center text-xs text-muted-foreground">Fehler-ID: {error.digest}</p>}
    </div>
  );
}
