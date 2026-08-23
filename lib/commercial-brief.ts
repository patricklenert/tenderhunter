export const COMMERCIAL_BRIEF_MAX_LIST_ITEMS = 8;
export const COMMERCIAL_BRIEF_MAX_STRING_LENGTH = 280;
export const COMMERCIAL_BRIEF_MAX_RATIONALE_LENGTH = 600;
export const COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH = 140;

export type CommercialBriefAction = "pursue" | "verify" | "do_not_pursue";

export interface CommercialBrief {
  action: CommercialBriefAction;
  headline: string;
  rationale: string;
  whatIsBeingBought: string[];
  documentedWinRequirements: string[];
  deliveryRequirements: string[];
  risks: string[];
  unknowns: string[];
  nextAction: string;
}

/** Facts are the sole authority for the source-controlled lists in a brief. */
export interface CommercialBriefFacts {
  title?: string | null;
  awarded?: boolean | null;
  buyer?: string | null;
  procedure?: string | null;
  deadline?: string | null;
  location?: string | null;
  whatIsBeingBought?: readonly string[] | null;
  documentedWinRequirements?: readonly string[] | null;
  deliveryRequirements?: readonly string[] | null;
  risks?: readonly string[] | null;
  unknowns?: readonly string[] | null;
}

export interface CommercialBriefValidation {
  brief: CommercialBrief;
  valid: boolean;
  issues: string[];
}

interface NormalizedFacts {
  title: string;
  awarded: boolean;
  buyer: string;
  procedure: string;
  deadline: string;
  location: string;
  whatIsBeingBought: string[];
  documentedWinRequirements: string[];
  deliveryRequirements: string[];
  risks: string[];
  unknowns: string[];
}

type SourceControlledListField =
  | "whatIsBeingBought"
  | "documentedWinRequirements"
  | "deliveryRequirements"
  | "risks"
  | "unknowns";

const MAX_INPUT_STRING_LENGTH = 4_096;
const MAX_LIST_SCAN_ITEMS = 64;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const HTML_TAGS = /<[^>]*>/g;
const UNSAFE_CONTENT = /<\s*\/?\s*(?:script|style|iframe|object|embed)\b|(?:java|vb)script\s*:|data\s*:\s*text\/html/i;

const sourceControlledListFields: SourceControlledListField[] = [
  "whatIsBeingBought",
  "documentedWinRequirements",
  "deliveryRequirements",
  "risks",
  "unknowns",
];

const fieldLabels: Record<SourceControlledListField, string> = {
  whatIsBeingBought: "Leistungsumfang",
  documentedWinRequirements: "dokumentierte Gewinnanforderungen",
  deliveryRequirements: "Lieferanforderungen",
  risks: "Risiken",
  unknowns: "offene Punkte",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const textKey = (value: string): string => value.toLocaleLowerCase("de-DE");

const safeText = (value: unknown, maxLength = COMMERCIAL_BRIEF_MAX_STRING_LENGTH): string => {
  if (typeof value !== "string") return "";

  const input = value.slice(0, MAX_INPUT_STRING_LENGTH);
  if (UNSAFE_CONTENT.test(input)) return "";

  const normalized = input
    .replace(CONTROL_CHARACTERS, " ")
    .replace(HTML_TAGS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /[<>]/.test(normalized)) return "";
  return normalized.slice(0, maxLength).trim();
};

const safeList = (value: unknown, maxLength = COMMERCIAL_BRIEF_MAX_STRING_LENGTH): string[] => {
  if (!Array.isArray(value)) return [];

  const values: string[] = [];
  const seen = new Set<string>();
  const limit = Math.min(value.length, MAX_LIST_SCAN_ITEMS);

  for (let index = 0; index < limit && values.length < COMMERCIAL_BRIEF_MAX_LIST_ITEMS; index += 1) {
    const item = safeText(value[index], maxLength);
    const key = textKey(item);
    if (!item || seen.has(key)) continue;
    seen.add(key);
    values.push(item);
  }

  return values;
};

const normalizeFacts = (facts: CommercialBriefFacts): NormalizedFacts => {
  const source = asRecord(facts);

  return {
    title: safeText(source.title, COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH),
    awarded: source.awarded === true,
    buyer: safeText(source.buyer),
    procedure: safeText(source.procedure),
    deadline: safeText(source.deadline),
    location: safeText(source.location),
    whatIsBeingBought: safeList(source.whatIsBeingBought),
    documentedWinRequirements: safeList(source.documentedWinRequirements),
    deliveryRequirements: safeList(source.deliveryRequirements),
    risks: safeList(source.risks),
    unknowns: safeList(source.unknowns),
  };
};

const withSuffix = (title: string, suffix: string): string => {
  const base = title || "Ausschreibung";
  return `${base.slice(0, COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH - suffix.length).trim()}${suffix}`;
};

const fallbackFromFacts = (facts: NormalizedFacts): CommercialBrief => {
  const unknowns = safeList([
    ...(facts.whatIsBeingBought.length === 0 ? ["Leistungsumfang ist nicht dokumentiert."] : []),
    ...(facts.documentedWinRequirements.length === 0 ? ["Gewinnanforderungen sind nicht dokumentiert."] : []),
    ...(facts.deliveryRequirements.length === 0 ? ["Lieferanforderungen sind nicht dokumentiert."] : []),
    ...facts.unknowns,
  ]);

  if (facts.awarded) {
    return {
      action: "do_not_pursue",
      headline: withSuffix(facts.title, ": kein Angebot"),
      rationale: "Der Auftrag ist laut vorliegenden Fakten bereits vergeben. Keine Angebotsabgabe verfolgen.",
      whatIsBeingBought: facts.whatIsBeingBought,
      documentedWinRequirements: facts.documentedWinRequirements,
      deliveryRequirements: facts.deliveryRequirements,
      risks: facts.risks,
      unknowns,
      nextAction: "Kein Angebot vorbereiten; Vorgang nur zur Marktbeobachtung abschließen.",
    };
  }

  const hasDocumentedRequirements =
    facts.documentedWinRequirements.length > 0 || facts.deliveryRequirements.length > 0;
  const context = [
    facts.buyer ? `Auftraggeber: ${facts.buyer}` : "",
    facts.procedure ? `Verfahren: ${facts.procedure}` : "",
    facts.location ? `Leistungsort: ${facts.location}` : "",
    facts.deadline ? `Angebotsfrist: ${facts.deadline}` : "",
  ].filter(Boolean).join("; ");
  const contextSentence = context ? ` Dokumentiert sind ${context}.` : "";

  const hasDetailedScope = facts.whatIsBeingBought.some((item) => item !== facts.title && item.length > 10);

  if (hasDocumentedRequirements && hasDetailedScope) {
    return {
      action: "verify",
      headline: withSuffix(facts.title, ": Anforderungen prüfen"),
      rationale: `Für ${facts.title || "diese Ausschreibung"} liegen dokumentierte Anforderungen vor.${contextSentence} Eignung, Kapazität und Frist vor der Angebotsentscheidung prüfen.`,
      whatIsBeingBought: facts.whatIsBeingBought,
      documentedWinRequirements: facts.documentedWinRequirements,
      deliveryRequirements: facts.deliveryRequirements,
      risks: facts.risks,
      unknowns,
      nextAction: "Dokumentierte Anforderungen gegen Nachweise, Kapazität und Frist prüfen.",
    };
  }

  if (hasDocumentedRequirements) {
    return {
      action: "verify",
      headline: withSuffix(facts.title, ": Anforderungen prüfen"),
      rationale: `Für ${facts.title || "diese Ausschreibung"} liegen dokumentierte Anforderungen vor, aber detaillierter Leistungsumfang und Mengen fehlen.${contextSentence} Prüfe ob die dokumentierten Anforderungen zum eigenen Leistungsprofil passen.`,
      whatIsBeingBought: facts.whatIsBeingBought,
      documentedWinRequirements: facts.documentedWinRequirements,
      deliveryRequirements: facts.deliveryRequirements,
      risks: facts.risks,
      unknowns,
      nextAction: "Anforderungen mit eigenem Leistungsprofil abgleichen; Vergabeunterlagen für Mengen und Details anfordern.",
    };
  }

  const deadlineNote = facts.deadline
    ? ` Die Angebotsfrist ist der ${facts.deadline}.`
    : "";

  if (hasDetailedScope) {
    return {
      action: "verify",
      headline: withSuffix(facts.title, ": Details prüfen"),
      rationale: `Für ${facts.title || "diese Ausschreibung"} ist der Leistungsumfang teilweise dokumentiert, aber es fehlen Mengen, Eignungsnachweise und Zuschlagskriterien.${contextSentence}${deadlineNote}`,
      whatIsBeingBought: facts.whatIsBeingBought,
      documentedWinRequirements: facts.documentedWinRequirements,
      deliveryRequirements: facts.deliveryRequirements,
      risks: facts.risks,
      unknowns,
      nextAction: facts.deadline
        ? `Vergabeunterlagen bis ${facts.deadline} anfordern und Leistungsumfang, Mengen sowie Zuschlagskriterien prüfen.`
        : "Vergabeunterlagen anfordern und Leistungsumfang, Mengen sowie Zuschlagskriterien prüfen.",
    };
  }

  const whatWeKnow = [
    facts.buyer ? `Auftraggeber ist ${facts.buyer}` : "",
    facts.procedure ? `Verfahren: ${facts.procedure}` : "",
    facts.deadline ? `Frist: ${facts.deadline}` : "",
  ].filter(Boolean);

  return {
    action: "verify",
    headline: withSuffix(facts.title, ": Vergabeunterlagen anfordern"),
    rationale: whatWeKnow.length > 0
      ? `Zu ${facts.title || "dieser Ausschreibung"} sind nur Basisdaten bekannt: ${whatWeKnow.join(", ")}. Leistungsumfang, Mengen, Eignung und Zuschlagskriterien sind nicht dokumentiert. Eine Bewertung ist erst nach Prüfung der Vergabeunterlagen möglich.${deadlineNote}`
      : `Zu ${facts.title || "dieser Ausschreibung"} liegen keine verwertbaren Leistungsdaten vor. Eine Bewertung von Marge und Zuschlagschance ist erst nach Prüfung der Vergabeunterlagen möglich.`,
    whatIsBeingBought: facts.whatIsBeingBought,
    documentedWinRequirements: facts.documentedWinRequirements,
    deliveryRequirements: facts.deliveryRequirements,
    risks: facts.risks,
    unknowns,
    nextAction: facts.deadline
      ? `Vergabeunterlagen bis ${facts.deadline} anfordern: Was genau soll geliefert werden? Welche Mengen? Welche Eignungsnachweise?`
      : "Vergabeunterlagen anfordern: Was genau soll geliefert werden? Welche Mengen? Welche Eignungsnachweise?",
  };
};

const asAction = (value: unknown): CommercialBriefAction | null => {
  const action = safeText(value, 20);
  return action === "pursue" || action === "verify" || action === "do_not_pursue" ? action : null;
};

const sameList = (left: unknown, right: string[]): boolean => {
  const normalized = safeList(left);
  return normalized.length === right.length && normalized.every((value, index) => textKey(value) === textKey(right[index]));
};

const normalizedNarrative = (value: string): string =>
  value.toLocaleLowerCase("de-DE").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const looksTruncated = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.length >= COMMERCIAL_BRIEF_MAX_STRING_LENGTH && !/[.!?)]$/.test(normalized);
};

const isGroundedNarrative = (value: unknown, facts: NormalizedFacts): boolean => {
  const text = normalizedNarrative(safeText(value));
  if (!text) return false;
  const sources = [facts.title, ...facts.whatIsBeingBought, ...facts.documentedWinRequirements]
    .map(normalizedNarrative)
    .filter((source) => source.length >= 12);
  return sources.some((source) => text.includes(source));
};

export const createCommercialBriefFallback = (facts: CommercialBriefFacts): CommercialBrief =>
  fallbackFromFacts(normalizeFacts(facts));

/**
 * Keeps procurement facts source-controlled: LLM list values can never add,
 * rewrite, or fill in requirements that are absent from the supplied facts.
 */
export const normalizeCommercialBrief = (raw: unknown, facts: CommercialBriefFacts): CommercialBrief => {
  const normalizedFacts = normalizeFacts(facts);
  const fallback = fallbackFromFacts(normalizedFacts);
  if (normalizedFacts.awarded) return fallback;

  const candidate = asRecord(raw);
  return {
    action: fallback.action,
    headline: isGroundedNarrative(candidate.headline, normalizedFacts)
      ? safeText(candidate.headline, COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH)
      : fallback.headline,
    rationale: isGroundedNarrative(candidate.rationale, normalizedFacts) && !looksTruncated(candidate.rationale)
      ? safeText(candidate.rationale, COMMERCIAL_BRIEF_MAX_RATIONALE_LENGTH)
      : fallback.rationale,
    whatIsBeingBought: fallback.whatIsBeingBought,
    documentedWinRequirements: fallback.documentedWinRequirements,
    deliveryRequirements: fallback.deliveryRequirements,
    risks: fallback.risks,
    unknowns: fallback.unknowns,
    nextAction: fallback.nextAction,
  };
};

export const validateCommercialBrief = (raw: unknown, facts: CommercialBriefFacts): CommercialBriefValidation => {
  const brief = normalizeCommercialBrief(raw, facts);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { brief, valid: false, issues: ["Die LLM-Antwort ist kein Objekt."] };
  }

  const candidate = raw as Record<string, unknown>;
  const issues: string[] = [];
  const normalizedFacts = normalizeFacts(facts);
  const action = asAction(candidate.action);

  if (action !== fallbackFromFacts(normalizedFacts).action) {
    issues.push("Die Aktion muss aus dem deterministischen Entscheidungsstatus stammen.");
  }

  for (const field of ["headline", "rationale"] as const) {
    if (!isGroundedNarrative(candidate[field], normalizedFacts)) {
      issues.push(`${field} fehlt, ist unsicher oder nicht auf dokumentierte Fakten zurückführbar.`);
    }
  }

  for (const field of sourceControlledListFields) {
    if (field in candidate && !sameList(candidate[field], brief[field])) {
      issues.push(`${fieldLabels[field]} weicht von den dokumentierten Fakten ab.`);
    }
  }

  return { brief, valid: issues.length === 0, issues };
};
