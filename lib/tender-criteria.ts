import { parseGermanCount, parseGermanNumber } from "@/lib/german-number";

export const CRITERION_KINDS = [
  "revenue",
  "financial_statements",
  "references",
  "certificate",
  "insurance",
  "team",
  "legal_form",
  "company_age",
  "presence",
  "language",
  "availability",
  "subcontracting",
  "third_party_capacity",
  "consortium",
] as const;

export type CriterionKind = (typeof CRITERION_KINDS)[number];

export type RequirementType = "muss" | "zuschlag" | "beschreibung";

export type CapacityRule = "allowed" | "forbidden" | "limited";

export interface CriteriaSource {
  documentId: number | null;
  filename: string | null;
  origin: "notice" | "document";
  page: number | null;
  text: string;
}

export interface CriterionSourceRef {
  documentId: number | null;
  filename: string | null;
  origin: "notice" | "document";
  page: number | null;
}

export interface CriterionFinding {
  kind: CriterionKind;
  type: RequirementType;
  label: string;
  quote: string;
  source: CriterionSourceRef;
  amountEur: number | null;
  count: number | null;
  years: number | null;
  certificate: string | null;
  rule: CapacityRule | null;
}

export interface CriteriaCoverage {
  kind: CriterionKind;
  found: boolean;
}

export interface CriteriaResult {
  findings: CriterionFinding[];
  coverage: CriteriaCoverage[];
  sourcesSearched: number;
  documentsSearched: number;
  limitations: string[];
}

type FindingFields = Omit<CriterionFinding, "type" | "quote" | "source">;

interface Draft {
  index: number;
  fields: FindingFields;
}

interface Segment {
  start: number;
  text: string;
}

const MAX_QUOTE_LENGTH = 400;

const SENTENCE_END = /[.!?;]{1,3}(?=\s|$)/g;
const PARAGRAPH_BREAK = /\n[ \t\r]*\n/g;
const LIST_MARKER = /(?:^|\n)[ \t]*(?:[-–*]|\d{1,2}\.|[a-z]\))[ \t]+|•[ \t]*/gi;
const NON_SENTENCE_WORDS = new Set([
  "abs", "art", "bspw", "bzw", "ca", "dr", "etc", "evtl", "exkl", "ff", "gem", "ggf", "inkl", "max", "mind", "min", "mio", "mrd", "nr", "prof", "sog", "std", "str", "tel", "tsd", "usw", "vgl", "vs", "zzgl",
]);

const REVENUE = /umsatz(?![-\s]*steuer)|umsätz/i;
const MINIMUM_REVENUE = /mindest/i;
const MINIMUM_HINT = /mindest|mind\./i;
const STATEMENTS = /jahresabschl(?:uss|üss)|\bbilanz|gewinn-?\s*und\s+verlustrechnung/i;
const REFERENCES = /(?<![-\p{L}])referenz(?:projekte?|liste|schreiben|kunden)?(?!\p{L})(?![-\s]*(?:nr|nummer|zeichen|kennung)(?!\p{L}))|\p{L}{0,30}referenzen(?!\p{L})|(?<!\p{L})(?:vergleichbar|ähnlich)\p{L}{0,20}\s+(?:projekt|leistung|auftr)/iu;
const REFERENCE_COUNT = /(\d{1,3}|\p{L}{1,30})\s+(?:(?:vergleichbare|ähnliche|geeignete|relevante)[nrs]?\s+)?(?:\p{L}{0,30}referenz\p{L}{0,30}|(?:vergleichbare|ähnliche|geeignete|relevante)[nrs]?\s+(?:projekte|projekten|leistungen|aufträge))(?!\p{L})/giu;
const TEAM_COUNT = /(\d{1,4}|\p{L}{1,30})\s+(?:\p{L}{1,30}(?:e|en|er|em|es)\s+)?(?:mitarbeite(?:r|nde|rinnen|nden)|fachkräfte|vollzeitäquivalente)(?!\p{L})/giu;
const LAST_YEARS = /(?:(?:letzten|vergangenen)\s+(\d{1,2}|\p{L}{1,30})|(\d{1,2}|\p{L}{1,30})\s+(?:letzten|vergangenen))\s+(?:abgeschlossenen\s+)?(?:geschäftsjahr|kalenderjahr|jahr)(?:e|en)?(?!\p{L})/giu;
const YEARS = /(\d{1,2}|\p{L}{1,30})\s+jahr(?:e|en)?(?!\p{L})/giu;
const EUR_AMOUNT = /(\d+(?:[.,]\d+)*)\s*(mio\.?|millionen|mrd\.?|milliarden|tsd\.?|tausend)?\s*(teur|t€|eur|euro|€)(?!\p{L})/giu;
const INSURANCE = /haftpflicht|deckungssumme|versicherungssumme|cyber-?versicherung/i;
const ISO_CERTIFICATE = /\bISO[\s/-]*(?:IEC[\s/-]*)?(27001|42001|9001|27701|20000|22301)\b/gi;
const C5 = /\bC5\b|cloud computing compliance criteria catalogue/i;
const C5_TYPE_2 = /(?:typ|type)[\s-]*(?:2|II)\b/i;
const C5_TYPE_1 = /(?:typ|type)[\s-]*(?:1|I)\b/i;
const OTHER_CERTIFICATES: Array<[RegExp, string]> = [
  [/\bGrundschutz/i, "BSI IT-Grundschutz"],
  [/\bTISAX\b/i, "TISAX"],
  [/\bSOC[\s-]*2\b/i, "SOC 2"],
  [/\bKRITIS\b/i, "KRITIS"],
];
const LEGAL_REGISTER = /(?:handels|gewerbe|berufs)register\p{L}*[^.;\n]{0,60}(?:eingetragen|eintragung|auszug|nachweis|registrierung)|(?:eingetragen|eintragung|auszug|nachweis)[^.;\n]{0,60}(?:handels|gewerbe|berufs)register|rechtsform/iu;
const COMPANY_AGE = /seit\s+mindestens|mindestens\s+seit|am\s+markt|unternehmensgründung|gegründet/i;
const PRESENCE = /vor[\s-]ort|präsenz|anwesenheit|am\s+standort|einsatzort|standort\s+in\s+deutschland|in\s+deutschland\s+(?:ansässig|niedergelassen)|\bniederlassung(?:en)?\b/i;
const LANGUAGE = /in\s+deutscher\s+sprache|deutschsprachig|deutschkenntnis|sprache[^.;\n]{0,60}\bdeutsch\b|auf\s+deutsch\b/i;
const AVAILABILITY = /\b24\s*(?:h\s*)?[\/x×]\s*7\b|rund\s+um\s+die\s+uhr|24[\s-]*stündig|24[\s-]*stunden[\s-]*(?:betrieb|support|service|erreichbarkeit|bereitschaft)|rufbereitschaft|bereitschaftsdienst/i;
const SUBCONTRACTING = /unterauftrag|nachunternehmer|subunternehmer|untervergabe|weitervergabe/i;
const THIRD_PARTY = /eignungsleihe|kapazitäten\s+(?:anderer|dritter|eines\s+anderen)|drittunternehm|verpflichtungserklärung[^.;]{0,80}(?:kapazit|dritt|anderen\s+unternehm)/i;
const CONSORTIUM = /bietergemeinschaft|arbeitsgemeinschaft|\barge\b|konsortium/i;
const CAPACITY_FORBIDDEN = /nicht\s+(?:zulässig|gestattet|erlaubt|zugelassen|möglich)|unzulässig|untersagt|ausgeschlossen|verboten/i;
const CAPACITY_LIMITED = /(?:höchstens|maximal|bis\s+zu|nicht\s+mehr\s+als)[^.]{0,40}(?:%|prozent|anteil|umfang)/i;
const CAPACITY_ALLOWED = /zulässig|gestattet|erlaubt|möglich|zugelassen/i;
const RULE_LABELS: Record<CapacityRule, string> = {
  forbidden: "nicht zulässig",
  allowed: "zulässig",
  limited: "begrenzt",
};
const AWARD_TERMS = /zuschlagskriter|zuschlagsbewertung|wertung|gewichtung|bewertungskriter|bewertungsmatrix|punkte\s+(?:werden|erhält|erhalten|vergeben)/i;
const REQUIREMENT_TERMS = /muss|müssen|nachzuweisen|nachweis|vorzulegen|vorlage|einzureichen|erforderlich|voraussetzung|zwingend|mindest|mind\.|verfügen|verfügt/i;

const firstMatch = (text: string, pattern: RegExp): { index: number; term: string } | null => {
  const match = pattern.exec(text);
  return match ? { index: match.index, term: match[0] } : null;
};

const firstCount = (text: string, pattern: RegExp, max: number): { index: number; value: number } | null => {
  for (const match of text.matchAll(pattern)) {
    const value = parseGermanCount(match[1] ?? match[2] ?? "");
    if (value !== null && value > 0 && value <= max) return { index: match.index, value };
  }
  return null;
};

const lastYears = (text: string): number | null => firstCount(text, LAST_YEARS, 50)?.value ?? null;

const eurMultiplier = (unit: string, currency: string): number => {
  const lower = unit.toLowerCase();
  if (lower.startsWith("mio") || lower.startsWith("million")) return 1_000_000;
  if (lower.startsWith("mrd") || lower.startsWith("milliard")) return 1_000_000_000;
  if (lower.startsWith("tsd") || lower.startsWith("tausend") || ["teur", "t€"].includes(currency.toLowerCase())) return 1_000;
  return 1;
};

const amountNear = (text: string, index: number): number | null => {
  const amounts = [...text.matchAll(EUR_AMOUNT)].flatMap((match) => {
    const number = parseGermanNumber(match[1] ?? "");
    return number === null ? [] : [{ at: match.index, eur: number * eurMultiplier(match[2] ?? "", match[3] ?? "") }];
  });
  return (amounts.find((amount) => amount.at >= index) ?? amounts[0])?.eur ?? null;
};

const formatEur = (value: number): string => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} EUR`;

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const yearsText = (years: number, text: string): string =>
  `${years} ${/geschäftsjahr/i.test(text) ? "Geschäftsjahr" : "Jahr"}${years === 1 ? "" : "e"}`;

const insuranceTerm = (term: string): string => {
  const lower = term.toLowerCase();
  return lower.startsWith("cyber") ? "Cyber-Versicherung" : capitalize(lower);
};

const c5Name = (text: string): string => {
  if (C5_TYPE_2.test(text)) return "BSI C5 Typ 2";
  if (C5_TYPE_1.test(text)) return "BSI C5 Typ 1";
  return "BSI C5";
};

const certificateHits = (text: string): Array<{ name: string; index: number }> => {
  const hits = new Map<string, number>();
  const note = (name: string, index: number): void => {
    if (!hits.has(name)) hits.set(name, index);
  };
  for (const match of text.matchAll(ISO_CERTIFICATE)) note(`ISO ${match[1]}`, match.index);
  const c5 = firstMatch(text, C5);
  if (c5 !== null) note(c5Name(text), c5.index);
  for (const [pattern, name] of OTHER_CERTIFICATES) {
    const hit = firstMatch(text, pattern);
    if (hit !== null) note(name, hit.index);
  }
  return [...hits].map(([name, index]) => ({ name, index }));
};

const capacityRule = (text: string, index: number): CapacityRule | null => {
  const start = Math.max(text.lastIndexOf(",", index), text.lastIndexOf(";", index)) + 1;
  const ends = [text.indexOf(",", index), text.indexOf(";", index)].filter((at) => at >= 0);
  const clause = text.slice(start, ends.length > 0 ? Math.min(...ends) : text.length);
  if (CAPACITY_FORBIDDEN.test(clause)) return "forbidden";
  if (CAPACITY_LIMITED.test(clause)) return "limited";
  if (CAPACITY_ALLOWED.test(clause)) return "allowed";
  return null;
};


const requirementType = (text: string): RequirementType => {
  if (AWARD_TERMS.test(text)) return "zuschlag";
  if (REQUIREMENT_TERMS.test(text)) return "muss";
  return "beschreibung";
};

const detectDrafts = (segment: string): Draft[] => {
  const drafts: Draft[] = [];
  const add = (index: number, kind: CriterionKind, label: string, values: Partial<FindingFields> = {}): void => {
    drafts.push({
      index,
      fields: { kind, label, amountEur: null, count: null, years: null, certificate: null, rule: null, ...values },
    });
  };

  const revenue = firstMatch(segment, REVENUE);
  const revenueEur = revenue === null ? null : amountNear(segment, revenue.index);
  if (revenue !== null && revenueEur !== null) {
    const years = lastYears(segment);
    const base = MINIMUM_REVENUE.test(segment) ? "Mindestumsatz" : "Umsatz";
    const period = years === null ? "" : `, ${yearsText(years, segment)}`;
    add(revenue.index, "revenue", `${base} ${formatEur(revenueEur)}${period}`, { amountEur: revenueEur, years });
  }

  const statements = firstMatch(segment, STATEMENTS);
  if (statements !== null) {
    const years = lastYears(segment);
    const term = statements.term.toLowerCase();
    const base = term.startsWith("jahresabschl") ? "Jahresabschlüsse" : term.startsWith("bilanz") ? "Bilanz" : "Gewinn- und Verlustrechnung";
    add(statements.index, "financial_statements", years === null ? base : `${base}: ${yearsText(years, segment)}`, { years });
  }

  const reference = firstMatch(segment, REFERENCES);
  if (reference !== null) {
    const count = firstCount(segment, REFERENCE_COUNT, 99);
    const years = lastYears(segment);
    const parts = [
      count === null ? null : `${MINIMUM_HINT.test(segment) ? "mindestens " : ""}${count.value}`,
      years === null ? null : `letzte ${yearsText(years, segment)}`,
    ].filter((part): part is string => part !== null);
    add(reference.index, "references", `Referenzen${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`, { count: count?.value ?? null, years });
  }

  for (const certificate of certificateHits(segment)) {
    add(certificate.index, "certificate", `Zertifikat: ${certificate.name}`, { certificate: certificate.name });
  }

  const insurance = firstMatch(segment, INSURANCE);
  if (insurance !== null) {
    const insuranceEur = amountNear(segment, insurance.index);
    const amount = insuranceEur === null ? "" : ` ${formatEur(insuranceEur)}`;
    add(insurance.index, "insurance", `Versicherung: ${insuranceTerm(insurance.term)}${amount}`, { amountEur: insuranceEur });
  }

  const team = firstCount(segment, TEAM_COUNT, 9999);
  if (team !== null) {
    add(team.index, "team", `Mitarbeitende: ${MINIMUM_HINT.test(segment) ? "mindestens " : ""}${team.value}`, { count: team.value });
  }

  const register = firstMatch(segment, LEGAL_REGISTER);
  if (register !== null) {
    const term = register.term.toLowerCase();
    const label = term.includes("rechtsform")
      ? "Rechtsform"
      : `Eintragung im ${term.includes("gewerberegister") ? "Gewerberegister" : term.includes("berufsregister") ? "Berufsregister" : "Handelsregister"}`;
    add(register.index, "legal_form", label, {});
  }

  const age = firstMatch(segment, COMPANY_AGE);
  const ageYears = firstCount(segment, YEARS, 50);
  if (age !== null && (ageYears !== null || requirementType(segment) === "muss")) {
    const label = ageYears === null
      ? "Unternehmensalter: Marktpräsenz"
      : `Unternehmensalter: seit mindestens ${ageYears.value} ${ageYears.value === 1 ? "Jahr" : "Jahren"}`;
    add(age.index, "company_age", label, { years: ageYears?.value ?? null });
  }

  const presence = firstMatch(segment, PRESENCE);
  if (presence !== null) {
    const inGermany = /deutschland/i.test(segment) && /niederlassung|ansässig|niedergelassen|standort/i.test(presence.term);
    add(presence.index, "presence", inGermany ? "Standort in Deutschland" : "Vor-Ort-Präsenz", {});
  }

  const language = firstMatch(segment, LANGUAGE);
  if (language !== null) add(language.index, "language", "Sprache: Deutsch", {});

  const availability = firstMatch(segment, AVAILABILITY);
  if (availability !== null) {
    const term = availability.term.toLowerCase();
    const label = /^(rufbereitschaft|bereitschaftsdienst)$/.test(term) ? `Verfügbarkeit: ${capitalize(term)}` : "Verfügbarkeit: 24/7";
    add(availability.index, "availability", label, {});
  }

  const subcontracting = firstMatch(segment, SUBCONTRACTING);
  const subcontractingRule = subcontracting === null ? null : capacityRule(segment, subcontracting.index);
  if (subcontracting !== null && subcontractingRule !== null) {
    add(subcontracting.index, "subcontracting", `Subunternehmer: ${RULE_LABELS[subcontractingRule]}`, { rule: subcontractingRule });
  }

  const thirdParty = firstMatch(segment, THIRD_PARTY);
  const thirdPartyRule = thirdParty === null ? null : capacityRule(segment, thirdParty.index);
  if (thirdParty !== null && thirdPartyRule !== null) {
    const term = /eignungsleihe/i.test(thirdParty.term) ? "Eignungsleihe" : "Drittkapazitäten";
    add(thirdParty.index, "third_party_capacity", `${term}: ${RULE_LABELS[thirdPartyRule]}`, { rule: thirdPartyRule });
  }

  const consortium = firstMatch(segment, CONSORTIUM);
  const consortiumRule = consortium === null ? null : capacityRule(segment, consortium.index);
  if (consortium !== null && consortiumRule !== null) {
    add(consortium.index, "consortium", `Bietergemeinschaft: ${RULE_LABELS[consortiumRule]}`, { rule: consortiumRule });
  }

  return drafts;
};

const endsSentence = (text: string, at: number, punctuation: string): boolean => {
  if (!punctuation.endsWith(".")) return true;
  const word = (text.slice(Math.max(0, at - 30), at).match(/\p{L}+$/u)?.[0] ?? "").toLowerCase();
  return word.length !== 1 && !NON_SENTENCE_WORDS.has(word);
};

const pushSegment = (segments: Segment[], text: string, from: number, to: number): void => {
  const raw = text.slice(from, to);
  const trimmed = raw.trim();
  if (trimmed) segments.push({ start: from + raw.indexOf(trimmed), text: trimmed });
};

const splitSegments = (text: string): Segment[] => {
  const cuts: Array<{ from: number; to: number }> = [];
  for (const match of text.matchAll(SENTENCE_END)) {
    if (!endsSentence(text, match.index, match[0])) continue;
    const end = match.index + match[0].length;
    cuts.push({ from: end, to: end });
  }
  for (const pattern of [PARAGRAPH_BREAK, LIST_MARKER]) {
    for (const match of text.matchAll(pattern)) {
      cuts.push({ from: match.index, to: match.index + match[0].length });
    }
  }
  cuts.sort((a, b) => a.from - b.from);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    pushSegment(segments, text, cursor, cut.from);
    cursor = Math.max(cursor, cut.to);
  }
  pushSegment(segments, text, cursor, text.length);
  return segments;
};

const quoteAt = (segment: string, index: number): { text: string; offset: number } => {
  if (segment.length <= MAX_QUOTE_LENGTH) return { text: segment, offset: 0 };
  const start = Math.min(Math.max(0, index - MAX_QUOTE_LENGTH / 2), segment.length - MAX_QUOTE_LENGTH);
  const raw = segment.slice(start, start + MAX_QUOTE_LENGTH);
  const text = raw.trim();
  return { text, offset: start + raw.indexOf(text) };
};

const sourceRef = (source: CriteriaSource): CriterionSourceRef => ({
  documentId: source.documentId,
  filename: source.filename,
  origin: source.origin,
  page: source.page,
});

export const extractTenderCriteria = (sources: CriteriaSource[]): CriteriaResult => {
  const entries: Array<{ finding: CriterionFinding; originRank: number; sourceIndex: number; position: number }> = [];
  sources.forEach((source, sourceIndex) => {
    const originRank = source.origin === "notice" ? 0 : 1;
    for (const segment of splitSegments(source.text)) {
      const type = requirementType(segment.text);
      for (const draft of detectDrafts(segment.text)) {
        const quote = quoteAt(segment.text, draft.index);
        entries.push({
          finding: { ...draft.fields, type, quote: quote.text, source: sourceRef(source) },
          originRank,
          sourceIndex,
          position: segment.start + quote.offset,
        });
      }
    }
  });
  entries.sort((a, b) => a.originRank - b.originRank || a.sourceIndex - b.sourceIndex || a.position - b.position);

  const seen = new Set<string>();
  const findings: CriterionFinding[] = [];
  for (const { finding } of entries) {
    const key = JSON.stringify([finding.kind, finding.type, finding.certificate, finding.quote]);
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(finding);
  }

  const searchable = sources.filter((source) => source.text.trim() !== "");
  const limitations: string[] = [];
  if (searchable.length === 0) {
    limitations.push("Keine Textquellen vorhanden (weder Bekanntmachung noch geparste Dokumente).");
  } else {
    if (searchable.every((source) => source.origin === "notice")) {
      limitations.push("Nur Bekanntmachungstext ausgewertet; Vergabeunterlagen fehlen oder sind nicht geparst.");
    }
    if (searchable.some((source) => source.origin === "document" && source.page === null)) {
      limitations.push("Dokumente ohne Seitenmarker: Seitenangabe nicht verfügbar.");
    }
  }

  return {
    findings,
    coverage: CRITERION_KINDS.map((kind) => ({ kind, found: findings.some((finding) => finding.kind === kind) })),
    sourcesSearched: sources.length,
    documentsSearched: new Set(searchable.map((source) => source.documentId).filter((id): id is number => id !== null)).size,
    limitations,
  };
};
