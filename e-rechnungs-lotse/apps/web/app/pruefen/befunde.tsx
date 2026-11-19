import type { ExplainedFinding } from "@erl/core";

const SCHWERE = {
  error: { label: "Fehler", cls: "bg-red-100 text-red-900 ring-red-700" },
  warning: { label: "Bitte prüfen", cls: "bg-amber-100 text-amber-950 ring-amber-700" },
  info: { label: "Hinweis", cls: "bg-slate-100 text-slate-800 ring-slate-500" },
} as const;

function Befund({ f }: { f: ExplainedFinding }) {
  const e = f.erklaerung;
  const s = SCHWERE[f.severity];
  return (
    <li className="rounded-lg border border-slate-300 bg-white p-4 break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ${s.cls}`}>
          {s.label}
        </span>
        <h4 className="text-base font-semibold text-slate-900">{e.titel}</h4>
        {e.quelle === "automatisch" && (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
            automatisch erklärt
          </span>
        )}
      </div>
      <p className="mt-2 text-slate-800">{e.erklaerung_einfach}</p>
      <p className="mt-2 text-slate-800">
        <strong>Was tun?</strong> {e.was_tun}
      </p>
      {e.schwere_hinweis && <p className="mt-2 text-sm text-slate-700">{e.schwere_hinweis}</p>}
      <details className="mt-3 text-sm print:hidden">
        <summary className="cursor-pointer rounded text-lotse-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lotse-600">
          Technische Meldung anzeigen
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-700">
          <dt className="font-medium">Regel</dt>
          <dd>
            <code>{f.ruleId}</code>
          </dd>
          {f.location && (
            <>
              <dt className="font-medium">Fundstelle</dt>
              <dd className="break-all">
                <code>{f.location}</code>
              </dd>
            </>
          )}
          <dt className="font-medium">Meldung</dt>
          <dd className="break-words">{f.technicalMessage}</dd>
          <dt className="font-medium">Quelle</dt>
          <dd>
            {f.source === "validator" ? "Offizielles Prüfprogramm (KoSIT)" : "E-Rechnungs-Lotse"}
          </dd>
        </dl>
        {f.verwandt && f.verwandt.length > 0 && (
          <div className="mt-3 text-slate-700">
            <p className="font-medium">Dasselbe Problem meldet auch:</p>
            <ul className="mt-1 list-disc pl-5">
              {f.verwandt.map((v) => (
                <li key={v.ruleId} className="break-words">
                  <code>{v.ruleId}</code> (
                  {v.source === "validator" ? "KoSIT" : "E-Rechnungs-Lotse"}): {v.technicalMessage}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </li>
  );
}

export function Befunde({ befunde }: { befunde: ExplainedFinding[] }) {
  const wichtig = befunde.filter((f) => f.severity !== "info");
  const hinweise = befunde.filter((f) => f.severity === "info");
  return (
    <section aria-labelledby="befunde-titel" className="mt-8">
      <h3 id="befunde-titel" className="text-xl font-semibold text-lotse-900">
        Was ist aufgefallen?
      </h3>
      {wichtig.length === 0 ? (
        <p className="mt-2 text-slate-800">Keine Fehler und keine offenen Punkte.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {wichtig.map((f, i) => (
            <Befund key={`${f.ruleId}-${i}`} f={f} />
          ))}
        </ul>
      )}
      {hinweise.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer rounded font-medium text-lotse-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lotse-600">
            Weitere Hinweise ({hinweise.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {hinweise.map((f, i) => (
              <Befund key={`${f.ruleId}-${i}`} f={f} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
