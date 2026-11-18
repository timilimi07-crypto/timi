import { createHash } from "node:crypto";

/**
 * SHA-256 über die unveränderten Original-Bytes einer Rechnung.
 * Wird beim Eingang berechnet und zusammen mit dem Original gespeichert (GoBD, Unveränderbarkeit).
 */
export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}
