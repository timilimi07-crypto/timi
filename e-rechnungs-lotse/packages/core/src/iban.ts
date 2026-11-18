/** Prüft eine IBAN formal (Länge, Zeichen, Prüfsumme mod 97). Verändert die IBAN nicht. */
export function isValidIban(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** Für die Anzeige: IBAN in Vierergruppen. */
export function formatIban(input: string): string {
  return input
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
