"use client";

import type { SupplierInquiry } from "@erl/core";
import { useId, useRef, useState } from "react";

export function Rueckfrage({ r }: { r: SupplierInquiry }) {
  const [offen, setOffen] = useState(false);
  const [meldung, setMeldung] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const volltext = `Betreff: ${r.betreff}\n\n${r.text}`;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(volltext);
      setMeldung("Der Text wurde kopiert. Sie können ihn jetzt in Ihre E-Mail einfügen.");
    } catch {
      // Ohne Zugriff auf die Zwischenablage: Text markieren, damit Strg+C reicht.
      textRef.current?.select();
      setMeldung("Der Text ist markiert. Kopieren Sie ihn mit Strg+C (Mac: Cmd+C).");
    }
  }

  return (
    <section aria-labelledby={`${id}-titel`} className="mt-8 print:hidden">
      <h3 id={`${id}-titel`} className="text-xl font-semibold text-lotse-900">
        Rückfrage an den Lieferanten
      </h3>
      <p className="mt-1 text-slate-800">
        Wir schreiben Ihnen einen höflichen E-Mail-Text mit allen Punkten. Sie entscheiden selbst,
        ob und wie Sie ihn verschicken – es wird nichts automatisch versendet.
      </p>
      {!offen ? (
        <button
          type="button"
          onClick={() => setOffen(true)}
          aria-expanded={false}
          aria-controls={`${id}-text`}
          className="mt-3 rounded-lg bg-lotse-600 px-4 py-3 font-semibold text-white hover:bg-lotse-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lotse-600"
        >
          Rückfrage an Lieferant
        </button>
      ) : (
        <div className="mt-3">
          <label htmlFor={`${id}-text`} className="block font-medium text-slate-900">
            E-Mail-Text (Sie können ihn vor dem Kopieren anpassen)
          </label>
          <textarea
            id={`${id}-text`}
            ref={textRef}
            defaultValue={volltext}
            rows={Math.min(18, volltext.split("\n").length + 2)}
            className="mt-1 w-full rounded-lg border border-slate-400 p-3 font-mono text-sm text-slate-900 focus-visible:outline-3 focus-visible:outline-lotse-600"
          />
          <button
            type="button"
            onClick={kopieren}
            className="mt-2 rounded-lg bg-lotse-600 px-4 py-3 font-semibold text-white hover:bg-lotse-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lotse-600"
          >
            Text kopieren
          </button>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-800">
            {meldung}
          </p>
        </div>
      )}
    </section>
  );
}
