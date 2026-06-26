import { createHash } from "node:crypto";
import type { StructuredData } from "@/lib/structurer";

const POSITIVE_KEYWORDS = [
  "ausschreibung",
  "bekanntmachung",
  "vergabe",
  "vergabeunterlagen",
  "teilnahmewettbewerb",
  "leistungsbeschreibung",
  "zuschlagskriterien",
  "angebotsfrist",
  "beschaffung",
  "contract notice",
  "procurement",
  "tender",
];

const NEGATIVE_KEYWORDS = [
  "impressum",
  "datenschutz",
  "cookie",
  "kontakt",
  "login",
  "registrierung",
  "newsletter",
  "sitemap",
  "karriere",
  "hilfe",
  "faq",
];

const compactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const countKeywordMatches = (haystack: string, keywords: readonly string[]): number => {
  const normalized = haystack.toLowerCase();
  return keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
};

const buildFingerprintSeed = (structured: StructuredData): string => {
  const parts = [
    structured.title,
    structured.hard_facts.buyer ?? "",
    structured.hard_facts.location ?? "",
    structured.hard_facts.deadline ?? "",
    structured.hard_facts.contract_type ?? "",
    structured.hard_facts.budget ?? "",
    structured.decision_relevant.scope.slice(0, 5).join(" | "),
    structured.decision_relevant.requirements.slice(0, 5).join(" | "),
    structured.decision_relevant.mandatory_documents.slice(0, 5).join(" | "),
  ];

  return compactText(parts.join("\n")).toLowerCase();
};

export interface TenderQualityAssessment {
  status: "qualified" | "rejected";
  reason: string;
  fingerprint: string | null;
}

export const buildTenderFingerprint = (structured: StructuredData): string | null => {
  const seed = buildFingerprintSeed(structured);
  if (seed.length < 80) {
    return null;
  }

  return createHash("sha1").update(seed).digest("hex");
};

export const assessTenderQuality = (title: string, url: string, rawText: string, structured: StructuredData): TenderQualityAssessment => {
  const summaryText = compactText(`${title} ${url} ${structured.summary} ${rawText.slice(0, 2_000)}`);
  const positiveMatches = countKeywordMatches(summaryText, POSITIVE_KEYWORDS);
  const negativeMatches = countKeywordMatches(summaryText, NEGATIVE_KEYWORDS);
  const extractedSignals = [
    structured.hard_facts.deadline,
    structured.hard_facts.location,
    structured.hard_facts.buyer,
    structured.hard_facts.contract_type,
    structured.hard_facts.budget,
  ].filter(Boolean).length;
  const relevantLineCount =
    structured.decision_relevant.scope.length +
    structured.decision_relevant.requirements.length +
    structured.decision_relevant.award_criteria.length +
    structured.decision_relevant.mandatory_documents.length;

  const fingerprint = buildTenderFingerprint(structured);

  if (compactText(rawText).length < 250) {
    return {
      status: "rejected",
      reason: "Zu wenig Inhalt fuer eine belastbare Ausschreibungsbewertung.",
      fingerprint,
    };
  }

  if (structured.confidence < 0.35 && relevantLineCount < 3 && positiveMatches < 2) {
    return {
      status: "rejected",
      reason: "Zu wenig ausschreibungsrelevante Signale nach der Strukturierung.",
      fingerprint,
    };
  }

  if (negativeMatches >= 3 && positiveMatches <= 1 && extractedSignals < 2) {
    return {
      status: "rejected",
      reason: "Die Seite wirkt eher wie Navigation oder Information als wie eine Ausschreibung.",
      fingerprint,
    };
  }

  if (positiveMatches === 0 && extractedSignals < 2 && relevantLineCount < 3) {
    return {
      status: "rejected",
      reason: "Die Quelle enthaelt keine ausreichenden Vergabehinweise.",
      fingerprint,
    };
  }

  return {
    status: "qualified",
    reason: "Ausschreibungssignale erkannt und fuer das Scoring freigegeben.",
    fingerprint,
  };
};
