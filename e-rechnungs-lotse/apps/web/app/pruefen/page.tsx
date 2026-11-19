import type { Metadata } from "next";
import Link from "next/link";
import { llmFallbackEnabled } from "@/lib/explainer";
import { SchlossIcon } from "./icons";
import { PruefenFormular } from "./pruefen-formular";

export const metadata: Metadata = {
  title: "Rechnung prüfen – E-Rechnungs-Lotse",
  description:
    "E-Rechnung hochladen und in Sekunden verstehen: Von wem, wie viel, bis wann – und ist sie in Ordnung?",
};

// Umgebungsvariablen (LLM-Flag) zur Laufzeit lesen, nicht beim Build.
export const dynamic = "force-dynamic";

export default function PruefenSeite() {
  const llm = llmFallbackEnabled();
  return (
    <main id="inhalt" className="mx-auto max-w-4xl px-4 py-10 sm:px-6 print:max-w-none print:py-0">
      <nav aria-label="Brotkrumen" className="text-sm print:hidden">
        <Link href="/" className="text-lotse-800 underline underline-offset-2">
          E-Rechnungs-Lotse
        </Link>{" "}
        <span aria-hidden="true">›</span> Rechnung prüfen
      </nav>
      <h1 className="mt-3 text-3xl font-bold text-lotse-900 sm:text-4xl print:hidden">
        Rechnung prüfen
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-800 print:hidden">
        Laden Sie eine E-Rechnung hoch (XRechnung oder ZUGFeRD). Sie sehen sofort, von wem sie ist,
        wie viel Sie zahlen sollen, bis wann – und ob alles in Ordnung ist.
      </p>

      <div
        id="datenschutz-hinweis"
        className="mt-6 flex gap-3 rounded-xl border border-lotse-600 bg-lotse-50 p-4 text-lotse-900 print:hidden"
      >
        <SchlossIcon className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">Ihre Datei wird nach der Prüfung sofort gelöscht.</p>
          <p className="mt-1 text-sm">
            Wir speichern weder die Datei noch die Rechnungsdaten. Die Prüfung läuft nur im
            Arbeitsspeicher.
            {llm &&
              " Für seltene technische Meldungen kann ein KI-Dienst in der EU eine Erklärung schreiben – dabei werden keine Rechnungsdaten übertragen, nur die Kennung der Meldung."}
          </p>
        </div>
      </div>

      <PruefenFormular />
    </main>
  );
}
