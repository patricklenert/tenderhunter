import { createHash } from "node:crypto";
import type { StructuredData } from "@/lib/structurer";

/** Parse a date string that might be in German format (DD.MM.YYYY) or ISO format. */
const parseGermanDate = (value: string): Date | null => {
  // German format: "DD.MM.YYYY" or "DD.MM.YYYY, HH:MM"
  const germanMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})$/);
  if (germanMatch) {
    const [, day, month, year, hour, minute] = germanMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const germanDateOnly = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanDateOnly) {
    const [, day, month, year] = germanDateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 23, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // ISO or other format
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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
  "online-marktinformation",
  "vorinformation",
  "nicht verbindliche bekanntmachung",
  "informationszwecken",
];

const ERROR_TITLE_PATTERNS = [
  "fehlerseite",
  "nicht gefunden",
  "not found",
  "page not found",
  "ein unerwarteter fehler",
  "fehler",
  "error",
  "404",
  "500",
  "zugriff verweigert",
  "access denied",
];

const NAVIGATION_TITLE_PATTERNS = [
  "legal notice",
  "impressum",
  "vergabelexikon",
  "enotices2",
  "sitemap",
  "hilfeseite",
  "cookie-erklaerung",
  "nutzungsbedingungen",
  "kundenreferenzen",
  "unverbindlich testen",
  "preise und editionen",
  "kostenlos testen",
  "jetzt testen",
  "demo anfordern",
  "beratung anfordern",
  "mehr erfahren",
  "jetzt entdecken",
  "ausschreibungen suchen",
  "infos fuer vergabestellen",
  "infos für vergabestellen",
  "webinare und veranstaltungen",
  "dashboard on contracts",
  "contracts awarded by eu",
  "tenders electronic daily",
  "supplement to the official journal",
  "stellenangebote und ausschreibungen",
  "statistics on ted",
  "sending electronic notices",
  "oeffentliche auftraggeber (vergabestellen)",
  "öffentliche auftraggeber (vergabestellen",
  "dtvp deutsches vergabeportal",
  "suchtipps fuer ausschreibungen",
  "suchtipps für ausschreibungen",
  "informationen zu ausschreibungen",
];

const NAVIGATION_URL_PATTERNS = [
  "dtvp.de/vergabestellen/",
  "ted.europa.eu/en/simap/",
  "ted.europa.eu/de/simap/",
  "dtvp.de/center/common/project/search.do",
  "dtvp.de/ausschreibungen/",
  "service.bund.de/content/de/service/ausschreibungsinfos/",
  "service.bund.de/content/de/service/suchtipps/",
];

// Phrasen die auf bereits vergebene oder nicht mehr verfügbare Aufträge hinweisen
const AWARDED_PHRASES = [
  "bereits vergeben",
  "auftrag wurde bereits vergeben",
  "vergabeunterlagen können nicht mehr abgerufen werden",
  "vergabeunterlagen koennen nicht mehr abgerufen werden",
  "ex-post-bekanntmachung",
  "ex-post bekanntmachung",
  "ex-ante-bekanntmachung",
  "ex-ante bekanntmachung",
  "vergebenen auftrags",
  "vergebenen auftrag",
  "zuschlag erteilt",
  "zuschlag wurde erteilt",
  "auftragserteilung",
  "auftrag vergeben an",
  "bekanntmachung vergebener aufträge",
  "bekanntmachung vergebener auftraege",
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
  // Reject expired tenders — no value for Unternehmer
  if (structured.hard_facts.deadline) {
    const deadline = parseGermanDate(structured.hard_facts.deadline);
    if (deadline && deadline.getTime() < Date.now()) {
      return {
        status: "rejected",
        reason: "Ausschreibung ist abgelaufen.",
        fingerprint: null,
      };
    }
  }

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

  const lowerTitle = title.toLowerCase();

  if (compactText(title).length < 10) {
    return {
      status: "rejected",
      reason: "Titel zu kurz fuer eine echte Ausschreibung.",
      fingerprint,
    };
  }

  if (ERROR_TITLE_PATTERNS.some((p) => lowerTitle.includes(p))) {
    return {
      status: "rejected",
      reason: "Fehler- oder NotFound-Seite, keine Ausschreibung.",
      fingerprint,
    };
  }

  if (NAVIGATION_TITLE_PATTERNS.some((p) => lowerTitle.includes(p))) {
    return {
      status: "rejected",
      reason: "Navigations- oder Meta-Seite, keine Ausschreibung.",
      fingerprint,
    };
  }

  const lowerUrl = (url ?? "").toLowerCase();
  if (NAVIGATION_URL_PATTERNS.some((p) => lowerUrl.includes(p))) {
    return {
      status: "rejected",
      reason: "Navigations- oder Info-Seite (URL-Pattern), keine Ausschreibung.",
      fingerprint,
    };
  }

  if (compactText(`${title} ${rawText}`).length < 120) {
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

  // Reject pre-information notices (Online-Marktinformation, Vorinformation)
  if (lowerTitle.includes("online-marktinformation") || lowerTitle.includes("vorinformation")) {
    return {
      status: "rejected",
      reason: "Vorinformation ohne konkrete Ausschreibung.",
      fingerprint,
    };
  }

  // Reject already-awarded contracts (Ex-post-Bekanntmachung, "bereits vergeben")
  const combinedText = compactText(`${title} ${structured.summary} ${rawText.slice(0, 3_000)}`).toLowerCase();
  for (const phrase of AWARDED_PHRASES) {
    if (combinedText.includes(phrase)) {
      return {
        status: "rejected",
        reason: `Bereits vergebener Auftrag erkannt ("${phrase}").`,
        fingerprint,
      };
    }
  }

  // Reject if a specific contractor/company is named as winner
  if (/auftragnehmer:\s*\w/.test(combinedText) || /auftrag vergeben an\s+\w/.test(combinedText)) {
    return {
      status: "rejected",
      reason: "Auftrag wurde bereits an ein Unternehmen vergeben.",
      fingerprint,
    };
  }

  // Reject tenders without a deadline — not actionable for bidders
  if (!structured.hard_facts.deadline) {
    // Allow only if there's a very rich scope (real tender content)
    if (relevantLineCount < 5 || extractedSignals < 3) {
      return {
        status: "rejected",
        reason: "Keine Frist hinterlegt und unzureichende Detailtiefe.",
        fingerprint,
      };
    }
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
