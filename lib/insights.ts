import type { ScoreResult } from "@/lib/scoring";
import type { StructuredData } from "@/lib/structurer";

const pct = (value: number): string => `${Math.round(value)}%`;

const firstItems = (items: string[], max = 3): string[] => items.filter(Boolean).slice(0, max);

export interface InsightResult {
  explanation: string;
  actions: string[];
  missing_items: string[];
}

export const generateInsight = (score: ScoreResult, structured: StructuredData): InsightResult => {
  const actions: string[] = [];
  const missingItems = firstItems(structured.decision_relevant.mandatory_documents, 6);

  if (score.details.location_status !== "match") {
    return {
      explanation: `Kein regulärer Match: ${score.details.location_reason}`,
      actions: [
        "Nicht als regulären Match verfolgen, sofern kein zusätzlicher Standort oder Partner vorhanden ist.",
        "Einsatzgebiet im Firmenprofil und Ausführungsort der Ausschreibung prüfen.",
      ],
      missing_items: missingItems,
    };
  }

  if (score.details.domain_status !== "match") {
    return {
      explanation: `Kein regulärer Match: ${score.details.domain_reason}`,
      actions: [
        "Nicht als regulären Match verfolgen, sofern keine passende Leistung oder ein geeigneter Partner vorhanden ist.",
        "Leistungsbeschreibung und CPV-Code der Ausschreibung fachlich prüfen.",
      ],
      missing_items: missingItems,
    };
  }

  if (score.kill_switch) {
    actions.push("Sofortige Go/No-Go-Pruefung mit Fachbereich und Vertrieb terminieren.");
  }

  if (score.fit >= 75) {
    actions.push("Kurzangebot vorbereiten und Prioritaet in die naechste Angebotsrunde setzen.");
  } else if (score.fit >= 50) {
    actions.push("Fachliche Luecken pruefen und Partneroption fuer fehlende Kompetenzen klaeren.");
  } else {
    actions.push("Nur verfolgen, wenn strategischer Kunde oder Referenzwert vorliegt.");
  }

  if (structured.hard_facts.deadline) {
    actions.push(`Zeitplan rueckwaerts ab ${structured.hard_facts.deadline} planen und Verantwortliche benennen.`);
  } else {
    actions.push("Abgabefrist manuell verifizieren und intern im Kalender hinterlegen.");
  }

  if (score.requirement_coverage < 0.6) {
    actions.push("Pflichtnachweise mit Checkliste gegen interne Unterlagen abgleichen.");
  }

  const explanation = [
    `Fit ${pct(score.fit)}, Gewinnchance ${pct(score.win_probability)}, Aufwand ${pct(score.effort)}.`,
    score.kill_switch
      ? "Es gibt einen Kill-Switch-Hinweis wegen niedriger Anforderungsabdeckung bei Pflichtunterlagen."
      : "Kein direkter Kill-Switch erkannt.",
    structured.hard_facts.budget
      ? `Budget-Hinweis erkannt: ${structured.hard_facts.budget}.`
      : "Kein klares Budget im Dokument gefunden."
  ].join(" ");

  return {
    explanation,
    actions: firstItems(actions, 5),
    missing_items: missingItems
  };
};
