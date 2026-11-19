"use client";

import { useActionState, useEffect, useRef, useState, type DragEvent } from "react";
import { pruefenAction, type PruefState } from "./actions";
import { Ergebnis } from "./ergebnis";
import { UploadIcon } from "./icons";

const MAX_BYTES = 10 * 1024 * 1024;
const ERLAUBT = /\.(xml|pdf)$/i;

export function PruefenFormular() {
  const [state, formAction, pending] = useActionState<PruefState, FormData>(pruefenAction, null);
  const [dateiname, setDateiname] = useState<string | null>(null);
  const [clientFehler, setClientFehler] = useState<string | null>(null);
  const [ziehen, setZiehen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ergebnisRef = useRef<HTMLHeadingElement>(null);

  // Nach der Prüfung den Fokus auf das Ergebnis setzen (Tastatur- und Screenreader-Nutzer).
  useEffect(() => {
    if (state?.ok) ergebnisRef.current?.focus();
  }, [state]);

  function pruefeAuswahl(file: File | undefined): boolean {
    if (!file) {
      setDateiname(null);
      return false;
    }
    if (!ERLAUBT.test(file.name)) {
      setClientFehler("Bitte wählen Sie eine XML- oder PDF-Datei.");
      return false;
    }
    if (file.size > MAX_BYTES) {
      setClientFehler("Die Datei ist größer als 10 MB. Bitte wählen Sie eine kleinere Datei.");
      return false;
    }
    setClientFehler(null);
    setDateiname(file.name);
    return true;
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setZiehen(false);
    const files = e.dataTransfer.files;
    if (inputRef.current && files.length > 0 && pruefeAuswahl(files[0])) {
      inputRef.current.files = files;
    }
  }

  const fehler = clientFehler ?? (state && !state.ok ? state.fehler : null);

  return (
    <>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!pruefeAuswahl(inputRef.current?.files?.[0])) {
            e.preventDefault();
            if (!inputRef.current?.files?.length)
              setClientFehler("Bitte wählen Sie zuerst eine Datei aus.");
          }
        }}
        className="mt-6 print:hidden"
        aria-describedby="datenschutz-hinweis"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setZiehen(true);
          }}
          onDragLeave={() => setZiehen(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            ziehen ? "border-lotse-600 bg-lotse-50" : "border-slate-400 bg-white"
          }`}
        >
          <UploadIcon className="mx-auto h-10 w-10 text-lotse-600" />
          <label htmlFor="datei" className="mt-2 block text-lg font-semibold text-slate-900">
            Rechnungsdatei
          </label>
          <p id="datei-hilfe" className="mt-1 text-slate-700">
            XML oder PDF, höchstens 10 MB. Wählen Sie die Datei aus oder ziehen Sie sie hierher.
          </p>
          <input
            ref={inputRef}
            id="datei"
            name="datei"
            type="file"
            accept=".xml,.pdf,application/xml,text/xml,application/pdf"
            aria-describedby="datei-hilfe"
            aria-invalid={fehler ? true : undefined}
            onChange={(e) => pruefeAuswahl(e.target.files?.[0])}
            className="mx-auto mt-4 block w-full max-w-md text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-lotse-600 file:px-4 file:py-3 file:font-semibold file:text-white hover:file:bg-lotse-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lotse-600"
          />
          {dateiname && (
            <p className="mt-2 text-sm text-slate-800">
              Ausgewählt: <strong className="break-all">{dateiname}</strong>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-4 w-full rounded-lg bg-lotse-600 px-6 py-4 text-lg font-semibold text-white hover:bg-lotse-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lotse-600 disabled:cursor-wait disabled:bg-slate-600 sm:w-auto"
        >
          {pending ? "Wird geprüft …" : "Rechnung prüfen"}
        </button>
      </form>

      <div aria-live="polite" className="sr-only">
        {pending
          ? "Die Rechnung wird geprüft."
          : state?.ok
            ? `Prüfung abgeschlossen: ${state.view.ampel.label}.`
            : ""}
      </div>
      {fehler && (
        <p
          role="alert"
          className="mt-4 rounded-lg border-2 border-red-700 bg-red-50 p-4 font-medium text-red-950"
        >
          {fehler}
        </p>
      )}

      {state?.ok && <Ergebnis ref={ergebnisRef} view={state.view} />}
    </>
  );
}
