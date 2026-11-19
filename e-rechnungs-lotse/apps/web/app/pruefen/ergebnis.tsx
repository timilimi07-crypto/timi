import type { AmpelFarbe, CheckView } from "@erl/core";
import { forwardRef } from "react";
import { Befunde } from "./befunde";
import { AmpelIcon } from "./icons";
import { RechnungPapier } from "./rechnung-papier";
import { Rueckfrage } from "./rueckfrage";

const FARBE: Record<AmpelFarbe, string> = {
  gruen: "border-green-700 bg-green-50 text-green-950",
  gelb: "border-amber-600 bg-amber-50 text-amber-950",
  rot: "border-red-700 bg-red-50 text-red-950",
  grau: "border-slate-500 bg-slate-100 text-slate-950",
};

const ICON_FARBE: Record<AmpelFarbe, string> = {
  gruen: "text-green-700",
  gelb: "text-amber-700",
  rot: "text-red-700",
  grau: "text-slate-700",
};

export const Ergebnis = forwardRef<HTMLHeadingElement, { view: CheckView }>(function Ergebnis(
  { view },
  headingRef,
) {
  const { ampel, eckdaten } = view;
  return (
    <section aria-labelledby="ergebnis-titel" className="mt-10" data-ampel={ampel.farbe}>
      <div className={`rounded-xl border-l-8 p-5 ${FARBE[ampel.farbe]}`}>
        <div className="flex items-center gap-3">
          <AmpelIcon
            symbol={ampel.symbol}
            className={`h-10 w-10 shrink-0 ${ICON_FARBE[ampel.farbe]}`}
          />
          <div>
            <p className="text-sm font-medium">Ergebnis der Prüfung</p>
            <h2
              id="ergebnis-titel"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-bold focus:outline-none"
            >
              {ampel.label}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-lg">{view.zusammenfassung}</p>
        {view.rechnung && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm">Von</dt>
              <dd className="font-semibold break-words">
                {eckdaten.lieferant ?? "nicht angegeben"}
              </dd>
            </div>
            <div>
              <dt className="text-sm">Betrag</dt>
              <dd className="font-semibold">{eckdaten.betrag ?? "nicht angegeben"}</dd>
            </div>
            <div>
              <dt className="text-sm">Zahlbar bis</dt>
              <dd className="font-semibold">{eckdaten.faellig ?? "nicht angegeben"}</dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-sm">
          Datei: {view.dateiname} · {view.formatLabel}
        </p>
      </div>

      {view.hinweis && (
        <div
          role="note"
          aria-labelledby="hinweis-titel"
          className="mt-6 rounded-xl border-2 border-slate-500 bg-white p-5 text-slate-900"
        >
          <h3 id="hinweis-titel" className="text-xl font-bold">
            {view.hinweis.titel}
          </h3>
          <p className="mt-2">{view.hinweis.text}</p>
          {view.hinweis.schwere_hinweis && (
            <p className="mt-2 text-sm text-slate-800">{view.hinweis.schwere_hinweis}</p>
          )}
        </div>
      )}

      <Befunde befunde={view.befunde} />
      {view.rueckfrage && <Rueckfrage r={view.rueckfrage} />}
      {view.rechnung && <RechnungPapier r={view.rechnung} />}

      <div className="mt-8 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border-2 border-lotse-600 px-4 py-2 font-semibold text-lotse-800 hover:bg-lotse-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lotse-600"
        >
          Drucken
        </button>
      </div>
    </section>
  );
});
