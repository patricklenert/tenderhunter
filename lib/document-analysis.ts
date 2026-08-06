import type { DocumentRole } from "./schema";
import type { RoleHint } from "./document-classifier";

export type DocumentCoverageStatus = "complete" | "partial" | "unknown" | "blocked";

export interface DocumentAnalysisEvidence {
  field: "deadline" | "scope" | "requirements" | "award_criteria";
  value: string | null;
  documentId: number;
  role: DocumentRole;
  page: number | null;
  quote: string;
  confidence: number;
  source: "parsed_document";
}

export interface DocumentRoleCoverage {
  discovered: number;
  downloaded: number;
  parsed: number;
  failed: number;
  empty: number;
  byRole: Partial<Record<DocumentRole, { total: number; parsed: number }>>;
  missingRoles: DocumentRole[];
}

export interface DocumentAnalysis {
  coverageStatus: DocumentCoverageStatus;
  coverage: DocumentRoleCoverage;
  evidence: DocumentAnalysisEvidence[];
}

export interface AnalyzedDocument {
  id: number;
  role: string | null;
  roles?: DocumentRole[] | null;
  roleHints?: RoleHint[] | null;
  parseStatus: string | null;
  downloadStatus: string | null;
  errorMessage: string | null;
  extractedText: string | null;
  pageCount: number | null;
  roleConfidence: number | null;
}

export const DOCUMENT_ROLES: DocumentRole[] = [
  "bekanntmachung",
  "leistungsbeschreibung",
  "leistungsverzeichnis",
  "eignung",
  "zuschlagskriterien",
  "vertragsbedingungen",
  "formblatt",
  "anlage",
  "nachtrag",
  "other",
];

/** Roles needed for a reliable first-pass tender analysis. */
export const REQUIRED_DOCUMENT_ROLES: DocumentRole[] = [
  "bekanntmachung",
  "leistungsbeschreibung",
];

const isDocumentRole = (value: unknown): value is DocumentRole =>
  typeof value === "string" && DOCUMENT_ROLES.includes(value as DocumentRole);

const documentRoles = (document: AnalyzedDocument): DocumentRole[] => {
  const explicitRoles = Array.isArray(document.roles) ? document.roles : [];
  const hintedRoles = Array.isArray(document.roleHints)
    ? document.roleHints.map((hint) => hint?.role)
    : [];
  const legacyRoles = [document.role];
  const roles = [...explicitRoles, ...hintedRoles, ...legacyRoles]
    .filter(isDocumentRole)
    .filter((role, index, values) => values.indexOf(role) === index && role !== "other");

  return roles.length > 0 ? roles : ["other"];
};

const roleConfidence = (document: AnalyzedDocument, role: DocumentRole): number => {
  const hintedConfidence = document.roleHints?.find((hint) => hint?.role === role)?.confidence;
  return typeof hintedConfidence === "number"
    ? hintedConfidence
    : document.roleConfidence ?? 0.55;
};

const usableText = (document: AnalyzedDocument): boolean =>
  document.parseStatus === "parsed" &&
  typeof document.extractedText === "string" &&
  document.extractedText.trim().length >= 20;

const quoteFromText = (text: string, patterns: RegExp[]): { quote: string; page: number | null } | null => {
  const pagePattern = /\[Seite\s+(\d+)\]\s*([\s\S]*?)(?=\[Seite\s+\d+\]|$)/gi;
  const pages: Array<{ page: number | null; text: string }> = [];
  let pageMatch: RegExpExecArray | null;
  while ((pageMatch = pagePattern.exec(text)) !== null) {
    pages.push({ page: Number(pageMatch[1]), text: pageMatch[2] });
  }
  if (pages.length === 0) pages.push({ page: null, text });

  for (const page of pages) {
    for (const pattern of patterns) {
      const match = page.text.match(pattern);
      if (!match || match.index === undefined) continue;
      const start = Math.max(0, match.index - 80);
      const end = Math.min(page.text.length, match.index + Math.max(match[0].length, 220));
      const quote = page.text.slice(start, end).replace(/\s+/g, " ").trim();
      if (quote.length >= 20) return { quote: quote.slice(0, 420), page: page.page };
    }
  }
  return null;
};

const EVIDENCE_PATTERNS: Array<{
  field: DocumentAnalysisEvidence["field"];
  roles: DocumentRole[];
  patterns: RegExp[];
}> = [
  {
    field: "deadline",
    roles: ["bekanntmachung", "other"],
    patterns: [
      /abgabe(?:frist|termin)/i,
      /angebotsfrist/i,
      /einreichungsfrist/i,
      /deadline/i,
      /frist[^\n]{0,100}\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/i,
    ],
  },
  {
    field: "scope",
    roles: ["leistungsbeschreibung", "leistungsverzeichnis"],
    patterns: [
      /leistungsbeschreibung/i,
      /leistungsumfang/i,
      /gegenstand\s+(?:der|des)\s+(?:ausschreibung|auftrags)/i,
      /art\s+und\s+umfang/i,
      /auftragsgegenstand/i,
    ],
  },
  {
    field: "requirements",
    roles: ["eignung", "formblatt", "bekanntmachung"],
    patterns: [
      /eignungsnachweis/i,
      /teilnahmebeding/i,
      /mindestanforder/i,
      /fachkunde/i,
      /referenz/i,
    ],
  },
  {
    field: "award_criteria",
    roles: ["zuschlagskriterien", "bekanntmachung"],
    patterns: [
      /zuschlagskriter/i,
      /gewichtung/i,
      /bewertung(?:skriterium|smethode)?/i,
      /preis\s*[:\-]?\s*\d{1,3}\s*%/i,
    ],
  },
];

export const buildDocumentAnalysis = (documents: AnalyzedDocument[]): DocumentAnalysis => {
  const coverage: DocumentRoleCoverage = {
    discovered: documents.length,
    downloaded: documents.filter((document) => document.downloadStatus === "downloaded").length,
    parsed: documents.filter(usableText).length,
    failed: documents.filter((document) => document.downloadStatus === "failed" || document.parseStatus === "failed").length,
    empty: documents.filter((document) => document.parseStatus === "empty").length,
    byRole: {},
    missingRoles: [],
  };

  for (const document of documents) {
    for (const role of documentRoles(document)) {
      const bucket = coverage.byRole[role] ?? { total: 0, parsed: 0 };
      bucket.total += 1;
      if (usableText(document)) bucket.parsed += 1;
      coverage.byRole[role] = bucket;
    }
  }

  coverage.missingRoles = REQUIRED_DOCUMENT_ROLES.filter(
    (role) => (coverage.byRole[role]?.parsed ?? 0) === 0,
  );

  const evidence: DocumentAnalysisEvidence[] = [];
  for (const definition of EVIDENCE_PATTERNS) {
    for (const document of documents) {
      if (!usableText(document)) continue;
      const role = definition.roles.find((candidate) => documentRoles(document).includes(candidate));
      if (!role) continue;
      const match = quoteFromText(document.extractedText ?? "", definition.patterns);
      if (!match) continue;
      evidence.push({
        field: definition.field,
        value: null,
        documentId: document.id,
        role,
        page: match.page,
        quote: match.quote,
        confidence: Math.min(0.95, Math.max(0.45, roleConfidence(document, role))),
        source: "parsed_document",
      });
      break;
    }
  }

  const allFailed = documents.length > 0 && coverage.parsed === 0 && coverage.failed === documents.length;
  const blocked = allFailed && documents.some((document) => /zugriff|teilnahme|login|access|gesperrt/i.test(document.errorMessage ?? ""));
  const coverageStatus: DocumentCoverageStatus = documents.length === 0
    ? "unknown"
    : blocked
      ? "blocked"
      : coverage.missingRoles.length === 0
        ? "complete"
        : "partial";

  return { coverageStatus, coverage, evidence };
};

export const withEvidenceValues = (
  analysis: DocumentAnalysis,
  values: Partial<Record<DocumentAnalysisEvidence["field"], string | null>>,
): DocumentAnalysis => ({
  ...analysis,
  evidence: analysis.evidence.map((evidence) => ({
    ...evidence,
    value: values[evidence.field] ?? evidence.value,
  })),
});
