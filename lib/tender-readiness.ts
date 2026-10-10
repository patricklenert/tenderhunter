import type { DocumentAnalysis } from "@/lib/document-analysis";
import type { TenderReadinessStatus } from "@/lib/schema";

export interface TenderReadinessInput {
  qualityStatus: string | null;
  rawText: string | null;
  structuredExists: boolean;
  structuredConfidence: number | null;
  documentAnalysis: DocumentAnalysis | null;
  accessBlocked?: boolean;
}

export interface TenderReadinessResult {
  status: TenderReadinessStatus;
  reason: string;
}

const MIN_STRUCTURED_CONFIDENCE_FOR_READY = 0.35;

export const SCORABLE_READINESS_STATUSES: readonly TenderReadinessStatus[] = ["ready", "partial"];

export const isScorableReadiness = (status: string): boolean =>
  (SCORABLE_READINESS_STATUSES as readonly string[]).includes(status);

export const evaluateTenderReadiness = (input: TenderReadinessInput): TenderReadinessResult => {
  if (input.accessBlocked || input.documentAnalysis?.coverageStatus === "blocked") {
    return { status: "blocked", reason: "Dokument- oder Quellzugriff ist blockiert." };
  }
  if (input.qualityStatus === "rejected" || input.qualityStatus === "duplicate") {
    return { status: "manual_review", reason: "Ausschreibung ist nicht für die normale Analyse freigegeben." };
  }
  if (input.qualityStatus !== "qualified") {
    return { status: "pending", reason: "Qualitätsprüfung der Ausschreibung steht noch aus." };
  }
  if (!input.rawText?.trim() || !input.structuredExists) {
    return { status: "pending", reason: "Strukturierte Ausschreibungsdaten stehen noch aus." };
  }
  if ((input.structuredConfidence ?? 0) < MIN_STRUCTURED_CONFIDENCE_FOR_READY) {
    return { status: "partial", reason: "Strukturierte Daten haben noch zu geringe Konfidenz." };
  }
  if (!input.documentAnalysis || input.documentAnalysis.coverageStatus !== "complete") {
    return {
      status: "ready",
      reason: "Qualifizierte strukturierte Ausschreibungsdaten sind für das Matching verfügbar; vollständige Vergabeunterlagen werden nachgeladen.",
    };
  }
  return { status: "ready", reason: "Erforderliche Dokumentrollen und strukturierte Daten sind verfügbar." };
};
