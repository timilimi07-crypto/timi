"use server";

import { pruefeDatei, type PruefErgebnis } from "@/lib/pruefen";

export type PruefState = PruefErgebnis | null;

export async function pruefenAction(_prev: PruefState, formData: FormData): Promise<PruefState> {
  const datei = formData.get("datei");
  return pruefeDatei(datei instanceof File ? datei : null);
}
