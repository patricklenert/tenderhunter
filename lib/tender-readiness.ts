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

export const evaluateTenderReadiness = (input: TenderReadinessInput): TenderReadinessResult => {
  if (input.accessBlocked || input.documentAnalysis?.coverageStatus === "blocked") {
    return { status: "blocked", reason: "Dokument- oder Quellzugriff ist blockiert." };
  }
  if (input.qualityStatus === "rejected" || input.qualityStatus === "duplicate") {
    return { status: "manual_review", reason: "Ausschreibung ist nicht für die normale Analyse freigegeben." };
  }
  if (!input.rawText?.trim() || !input.structuredExists) {
    return { status: "pending", reason: "Strukturierte Ausschreibungsdaten stehen noch aus." };
  }
  if (input.documentAnalysis?.coverageStatus === "partial") {
    const missing = input.documentAnalysis.coverage.missingRoles
      .filter((role) => role !== "other")
      .join(", ");
    return {
      status: "partial",
      reason: missing
        ? `Dokumentabdeckung unvollständig; fehlende Rollen: ${missing}.`
        : "Dokumentabdeckung oder Textextraktion ist unvollständig.",
    };
  }
  if ((input.structuredConfidence ?? 0) < 0.45) {
    return { status: "partial", reason: "Strukturierte Daten haben noch zu geringe Konfidenz." };
  }
  if (!input.documentAnalysis || input.documentAnalysis.coverageStatus === "unknown") {
    return { status: "partial", reason: "Dokumentabdeckung ist noch nicht bekannt." };
  }
  return { status: "ready", reason: "Erforderliche Dokumentrollen und strukturierte Daten sind verfügbar." };
};
