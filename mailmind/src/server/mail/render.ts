import sanitizeHtml from "sanitize-html";

/**
 * Sicheres Rendern von E-Mail-HTML.
 * - Skripte, Formulare, iframes, Event-Handler werden entfernt.
 * - Externe Bilder werden standardmäßig blockiert (Tracking-Pixel, Datenschutz);
 *   sie lassen sich pro E-Mail per Klick nachladen.
 * - Links öffnen in neuem Tab ohne Referrer.
 * Zusätzlich wird das Ergebnis im Client in einem iframe mit `sandbox` (ohne
 * allow-scripts) und einer strengen Content-Security-Policy angezeigt.
 */
export function sanitizeEmailHtml(html: string, opts: { allowRemoteImages: boolean }): { html: string; blockedImages: number } {
  let blockedImages = 0;
  const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "center", "font", "span", "style", "h1", "h2", "u", "s"]),
    disallowedTagsMode: "discard",
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "dir", "class"],
      a: ["href", "name", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "data-blocked-src"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      table: ["cellpadding", "cellspacing", "border"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowVulnerableTags: true, // <style> im Mail-Body erlaubt; durch CSP + sandbox abgesichert
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        if (src.startsWith("cid:")) return { tagName: "span", attribs: {}, text: "" };
        if (/^https?:/i.test(src) && !opts.allowRemoteImages) {
          blockedImages++;
          const { src: _src, ...rest } = attribs;
          void _src;
          return { tagName, attribs: { ...rest, "data-blocked-src": "1", alt: rest.alt ?? "" } };
        }
        return { tagName, attribs };
      },
    },
  });
  return { html: clean, blockedImages };
}

/** Vollständiges Dokument für das iframe (srcdoc) mit strenger CSP. */
export function wrapEmailDocument(body: string, opts: { allowRemoteImages: boolean }): string {
  const img = opts.allowRemoteImages ? "data: https: http:" : "data:";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${img}; style-src 'unsafe-inline'; font-src data:;">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#1f1f23;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
  body{padding:4px 2px}
  img{max-width:100%;height:auto}
  img[data-blocked-src]{display:inline-block;min-width:16px;min-height:16px;background:#f1f1f3;outline:1px dashed #d4d4d8}
  table{max-width:100%}
  a{color:#4f46e5}
  blockquote{margin:0 0 0 .5em;padding-left:.75em;border-left:3px solid #e4e4e7;color:#52525b}
</style></head><body>${body}</body></html>`;
}
