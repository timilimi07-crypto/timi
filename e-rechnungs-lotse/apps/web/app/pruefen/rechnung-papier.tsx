import type { PaperInvoice, PartyView } from "@erl/core";

const leer = <span className="text-slate-600">nicht angegeben</span>;

function Partei({ titel, p }: { titel: string; p: PartyView }) {
  return (
    <div>
      <h4 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">{titel}</h4>
      <address className="mt-1 not-italic text-slate-900">
        <span className="font-semibold">{p.name ?? leer}</span>
        {p.anschrift.map((z) => (
          <span key={z} className="block">
            {z}
          </span>
        ))}
        {p.ustId && <span className="block text-sm text-slate-700">USt-IdNr.: {p.ustId}</span>}
        {p.steuernummer && (
          <span className="block text-sm text-slate-700">Steuernummer: {p.steuernummer}</span>
        )}
      </address>
    </div>
  );
}

export function RechnungPapier({ r }: { r: PaperInvoice }) {
  return (
    <section aria-labelledby="papier-titel" className="mt-8">
      <h3 id="papier-titel" className="text-xl font-semibold text-lotse-900 print:hidden">
        Rechnung wie auf Papier
      </h3>
      <p className="mt-1 text-sm text-slate-700 print:hidden">
        Alle Angaben stammen aus den Rechnungsdaten (XML). Diese sind rechtlich maßgeblich.
      </p>
      <article className="mt-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <div className="grid gap-6 sm:grid-cols-2">
          <Partei titel="Lieferant" p={r.lieferant} />
          <Partei titel="Empfänger" p={r.empfaenger} />
        </div>

        <h4 className="mt-8 text-2xl font-bold text-slate-900">
          {r.art} {r.nummer ?? ""}
        </h4>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-slate-900 sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-slate-700">Rechnungsnummer</dt>
          <dd className="font-medium">{r.nummer ?? leer}</dd>
          <dt className="text-slate-700">Rechnungsdatum</dt>
          <dd className="font-medium">{r.datum ?? leer}</dd>
          <dt className="text-slate-700">Leistungsdatum</dt>
          <dd className="font-medium">{r.leistungsdatum ?? leer}</dd>
          <dt className="text-slate-700">Fällig am</dt>
          <dd className="font-medium">{r.faellig ?? leer}</dd>
          {r.kaeuferreferenz && (
            <>
              <dt className="text-slate-700">Ihre Referenz</dt>
              <dd className="font-medium break-all">{r.kaeuferreferenz}</dd>
            </>
          )}
        </dl>

        {r.positionen.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Rechnungspositionen</caption>
              <thead>
                <tr className="border-b-2 border-slate-400 text-slate-700">
                  <th
                    scope="col"
                    className="hidden py-2 pr-3 font-semibold sm:table-cell print:table-cell"
                  >
                    Pos.
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Bezeichnung
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Menge
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pr-3 font-semibold sm:table-cell print:table-cell"
                  >
                    Einheit
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pr-3 text-right font-semibold sm:table-cell print:table-cell"
                  >
                    USt.
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Netto
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.positionen.map((p, i) => (
                  <tr key={i} className="border-b border-slate-200 align-top">
                    <td className="hidden py-2 pr-3 sm:table-cell print:table-cell">{p.nr}</td>
                    <td className="py-2 pr-3">{p.bezeichnung ?? leer}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {p.menge}
                      {/* Auf schmalen Bildschirmen Einheit direkt an der Menge zeigen */}
                      {p.einheit && <span className="sm:hidden print:hidden"> {p.einheit}</span>}
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell print:table-cell">{p.einheit}</td>
                    <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell print:table-cell">
                      {p.steuersatz}
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.netto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {r.steuern.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="mb-1 text-left font-semibold text-slate-900">
                  Umsatzsteuer je Steuersatz
                </caption>
                <thead>
                  <tr className="border-b border-slate-400 text-slate-700">
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Satz
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">
                      Netto
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      Steuer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.steuern.map((s, i) => (
                    <tr key={i} className="border-b border-slate-200 align-top">
                      <th scope="row" className="py-1 pr-3 font-normal">
                        {s.satz ?? "–"}{" "}
                        <span className="text-slate-700">({s.kategorie ?? "?"})</span>
                        {s.befreiungsgrund && (
                          <span className="block text-xs text-slate-700">{s.befreiungsgrund}</span>
                        )}
                      </th>
                      <td className="py-1 pr-3 text-right tabular-nums">{s.netto}</td>
                      <td className="py-1 text-right tabular-nums">{s.steuer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 self-start text-slate-900 sm:col-start-2">
            {r.summen.map((s) => (
              <div key={s.label} className={`contents ${s.hervorheben ? "text-lg font-bold" : ""}`}>
                <dt
                  className={s.hervorheben ? "border-t-2 border-slate-900 pt-1" : "text-slate-700"}
                >
                  {s.label}
                </dt>
                <dd
                  className={`text-right tabular-nums ${s.hervorheben ? "border-t-2 border-slate-900 pt-1" : ""}`}
                >
                  {s.betrag}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 print:bg-white print:p-0">
          <h4 className="font-semibold text-slate-900">Zahlung</h4>
          <p className="mt-1 text-slate-900">
            Zahlbetrag: <strong>{r.zahlbetrag ?? "nicht angegeben"}</strong>
            {r.faellig && (
              <>
                {" "}
                · fällig am <strong>{r.faellig}</strong>
              </>
            )}
          </p>
          <p className="mt-1 text-slate-900">
            Bankverbindung (IBAN):{" "}
            {r.iban.length > 0
              ? r.iban.map((i) => (
                  <strong key={i} className="font-mono">
                    {i}
                  </strong>
                ))
              : "nicht angegeben"}
          </p>
        </div>
      </article>
    </section>
  );
}
