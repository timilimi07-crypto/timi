const schritte = [
  {
    titel: "Empfangen",
    text: "Sie laden E-Rechnungen hoch oder leiten sie per E-Mail weiter. XRechnung und ZUGFeRD werden erkannt.",
  },
  {
    titel: "Prüfen",
    text: "Jede Rechnung wird mit dem offiziellen Prüfprogramm (KoSIT) geprüft. Sie sehen sofort, ob alles stimmt.",
  },
  {
    titel: "Verstehen",
    text: "Statt XML sehen Sie eine klare Übersicht: Absender, Beträge, Steuer, Fälligkeit und Bankverbindung.",
  },
  {
    titel: "Archivieren und weitergeben",
    text: "Das Original wird unverändert und GoBD-gerecht aufbewahrt. Den Export für Ihr Steuerbüro erstellen Sie mit einem Klick.",
  },
];

export default function Startseite() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold tracking-wide text-lotse-600 uppercase">
        Für Handwerk und kleine Betriebe
      </p>
      <h1 className="mt-2 text-4xl font-bold text-lotse-900 sm:text-5xl">E-Rechnungs-Lotse</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-700">
        Seit 2025 müssen Sie E-Rechnungen empfangen können. Der E-Rechnungs-Lotse nimmt Ihnen die
        Arbeit ab: Er prüft jede Rechnung, zeigt sie verständlich an und bewahrt sie sicher auf.
      </p>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {schritte.map((s, i) => (
          <li key={s.titel} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-sm font-semibold text-lotse-600">Schritt {i + 1}</span>
            <h2 className="mt-1 text-lg font-semibold text-lotse-800">{s.titel}</h2>
            <p className="mt-2 text-slate-600">{s.text}</p>
          </li>
        ))}
      </ol>

      <p className="mt-12 rounded-lg bg-lotse-50 p-4 text-sm text-lotse-800">
        Hinweis: Diese Anwendung ist in Entwicklung. Alle Daten werden ausschließlich in der EU
        verarbeitet.
      </p>
    </main>
  );
}
