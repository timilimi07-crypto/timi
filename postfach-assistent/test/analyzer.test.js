import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, parseDeadline, sentences, extractTasks, analyzeLocal, relevantKnowledge, cleanBody } from "../src/ai/local.js";

test("Kategorien werden erkannt", () => {
  assert.equal(classify("Sie haben gewonnen!!!", "Klicken Sie hier, 100% gratis"), "spam");
  assert.equal(classify("Vase kaputt angekommen", "Die Vase ist zerbrochen, bitte Ersatz."), "reklamation");
  assert.equal(classify("Letzte Mahnung", "Die Rechnung 7781 ist offen."), "rechnung");
  assert.equal(classify("Termin verschieben", "Können wir den Termin verschieben?"), "termin");
  assert.equal(classify("Bewerbung als Lagermitarbeiter", "Lebenslauf anbei"), "bewerbung");
  assert.equal(classify("Newsletter November", "Zum Abmelden hier klicken"), "info");
  assert.equal(classify("Angebot gewünscht", "Was kostet die Betreuung?"), "anfrage");
});

test("Fristen werden in Daten umgerechnet", () => {
  const base = "2026-11-17T09:00:00"; // Dienstag
  assert.equal(parseDeadline("Bitte bis zum 28.11. überweisen", base), "2026-11-28");
  assert.equal(parseDeadline("bis 05.12.2026 einreichen", base), "2026-12-05");
  assert.equal(parseDeadline("Bitte bis Freitag schicken", base), "2026-11-20");
  assert.equal(parseDeadline("bis morgen beheben", base), "2026-11-18");
  assert.equal(parseDeadline("heute noch Bescheid geben", base), "2026-11-17");
  assert.equal(parseDeadline("innerhalb von 3 Tagen", base), "2026-11-20");
  assert.equal(parseDeadline("bis Ende der Woche", base), "2026-11-20");
  assert.equal(parseDeadline("bis Ende des Monats", base), "2026-11-30");
  assert.equal(parseDeadline("bis zum 10.01.", base), "2027-01-10", "Datum ohne Jahr in der Vergangenheit → nächstes Jahr");
  assert.equal(parseDeadline("Wir freuen uns auf Sie", base), null);
});

test("Satztrennung zerschneidet keine Daten, Beträge oder Abkürzungen", () => {
  const s = sentences("Die Rechnung über 1.284,50 EUR ist offen. Bitte bis zum 28.11. zahlen. Dr. Fischer wohnt im 2. OG rechts. Danke!");
  assert.deepEqual(s, ["Die Rechnung über 1.284,50 EUR ist offen.", "Bitte bis zum 28.11. zahlen.", "Dr. Fischer wohnt im 2. OG rechts.", "Danke!"]);
});

test("Anrede, Grußformel und Zitate werden entfernt", () => {
  const t = cleanBody("Hallo Frau Meier,\n\nbitte rufen Sie zurück.\n\nViele Grüße\nTom\n> alte Nachricht");
  assert.equal(t, "bitte rufen Sie zurück.");
});

test("Aufgaben mit Frist werden aus Bitten erkannt", () => {
  const tasks = extractTasks("Unterlagen", "Guten Tag,\nbitte senden Sie uns die Belege bis Freitag. Wir freuen uns.\nGruß", "2026-11-17T09:00:00", "anfrage");
  assert.equal(tasks.length, 1);
  assert.match(tasks[0].title, /Belege/);
  assert.equal(tasks[0].due_date, "2026-11-20");
  assert.deepEqual(extractTasks("Gewinn", "Bitte klicken", "2026-11-17", "spam"), []);
});

test("Firmenwissen wird passend zur Mail ausgewählt", () => {
  const k = "Lieferzeit: 2–4 Werktage.\nRücksendung: 30 Tage Rückgaberecht.\nGutscheincode NORD10: 10 % Rabatt.";
  assert.deepEqual(relevantKnowledge(k, "Wie lange ist die Lieferzeit nach Wien?"), ["Lieferzeit: 2–4 Werktage."]);
  assert.deepEqual(relevantKnowledge(k, "Hallo, alles gut"), []);
});

test("Gesamtauswertung: dringend, verärgert, Entwurf mit Signatur", () => {
  const company = { name: "Testfirma", signature: "Team Testfirma", knowledge: "" };
  const a = analyzeLocal({
    from_name: "Herbert Lang", from_addr: "h@x.example", subject: "Heizung ausgefallen – schon wieder!",
    body: "Zum wiederholten Mal ist die Heizung ausgefallen. Das ist unzumutbar! Bitte beheben Sie das bis morgen.",
    received_at: new Date().toISOString().slice(0, 19),
  }, company);
  assert.equal(a.category, "reklamation");
  assert.equal(a.priority, "hoch");
  assert.equal(a.sentiment, "negativ");
  assert.match(a.summary, /^Herbert Lang:/);
  assert.match(a.draft, /Guten Tag Herbert Lang/);
  assert.match(a.draft, /Team Testfirma$/);
  assert.equal(a.tasks.length, 1);
});

test("Spam und Newsletter bekommen keinen Antwortentwurf", () => {
  const a = analyzeLocal({ from_addr: "x@y.example", subject: "Sie haben gewonnen", body: "Klicken Sie hier", received_at: "2026-11-17T00:00:00" }, { name: "F" });
  assert.equal(a.category, "spam");
  assert.equal(a.draft, null);
});

test("Anrede ohne Komma verschluckt den Text nicht", () => {
  assert.equal(cleanBody("Hallo <b>wann</b> kommt meine Bestellung?"), "<b>wann</b> kommt meine Bestellung?");
  assert.equal(cleanBody("Sehr geehrte Frau Dr. Berger,\nbitte prüfen Sie den Bescheid."), "bitte prüfen Sie den Bescheid.");
});

test("Du-Form im Entwurf, wenn der Tonfall es verlangt", () => {
  const a = analyzeLocal({ from_name: "Lena Vogel", from_addr: "l@x.example", subject: "Lieferzeit", body: "Wie lange dauert die Lieferung?", received_at: "2026-11-17T09:00:00" },
    { name: "Shop", tone: "locker, Du-Form", signature: "Dein Team", knowledge: "" });
  assert.match(a.draft, /^Hallo Lena,/);
  assert.doesNotMatch(a.draft, /\b(Ihnen|Ihre|Sie)\b/);
  assert.match(a.draft, /Viele Grüße\nDein Team$/);
});
