"use client";

import { useCallback, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Original-E-Mail. HTML läuft in einem iframe mit `sandbox` OHNE allow-scripts
 * (kein JavaScript) und strenger CSP (siehe server/mail/render.ts).
 * Die Höhe passt sich dem Inhalt an.
 */
export function BodyFrame({
  body,
  onLoadImages,
}: {
  body: { kind: "html"; doc: string; blockedImages: number } | { kind: "text"; text: string };
  onLoadImages?: () => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const resize = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (doc) setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, 80), 20_000));
  }, []);

  if (body.kind === "text") {
    return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{body.text}</div>;
  }
  return (
    <div className="space-y-2">
      {body.blockedImages > 0 && onLoadImages && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <ImageOff className="size-3.5" />
          {body.blockedImages} externe {body.blockedImages === 1 ? "Bild wurde" : "Bilder wurden"} zum Schutz vor Tracking blockiert.
          <button type="button" onClick={onLoadImages} className="ml-auto font-medium text-foreground underline-offset-2 hover:underline">
            Bilder anzeigen
          </button>
        </div>
      )}
      <iframe
        ref={ref}
        title="E-Mail-Inhalt"
        srcDoc={body.doc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={resize}
        style={{ height }}
        className="w-full rounded-md border-0 bg-white"
      />
    </div>
  );
}
