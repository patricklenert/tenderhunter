import type { StructuredData } from "@/lib/structurer";
import { parseGermanCount, parseGermanNumber } from "@/lib/german-number";

export const SMALL_VENDOR_MODE_EMAILS_DEFAULT = "patricklenert@gmail.com";

const smallVendorModeEmails = (): Set<string> =>
  new Set(
    (process.env.SMALL_VENDOR_MODE_EMAILS ?? SMALL_VENDOR_MODE_EMAILS_DEFAULT)
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export interface SmallVendorUserLike {
  email?: string | null;
}

export const isSmallVendorTenderModeEnabled = (user: SmallVendorUserLike | null | undefined): boolean => {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return smallVendorModeEmails().has(email);
};

export const SMALL_VENDOR_HIGHLIGHT_THRESHOLD = 75;

export interface SmallVendorSignals {
  priceWeightPct: number | null;
  qualityWeightHint: number | null;
  contractValueMaxEur: number | null;
  contractValueMinEur: number | null;
  revenueMinEur: number | null;
  referenceCountMin: number | null;
  minEmployees: number | null;
  minYearsExperience: number | null;
  personDaysHint: number | null;
  certificates: string[];
  securityClearance: boolean;
  insuranceMinEur: number | null;
  requiresGermanOffice: boolean;
  subcontractingAllowed: boolean | null;
  suitabilityLeaseAllowed: boolean;
  personalReferencesOk: boolean;
  remoteFriendly: boolean;
  mandatoryOnSite: boolean;
  aroundTheClockSupport: boolean;
  isAnu: boolean;
  isFrameworkOrGu: boolean;
  isHardwareOrLicenceOnly: boolean;
  isItDomain: "strong" | "weak" | "none";
  isLot: boolean;
  mandatoryDocumentCount: number;
  requirementCount: number;
  durationMonthsHint: number | null;
}

export interface SmallVendorFactors {
  techFit: number;
  priceWeighting: number;
  eligibility: number;
  sizeFit: number;
  remoteFit: number;
  competition: number;
  complexity: number;
}

export interface SmallVendorFit {
  fit: number;
  factors: SmallVendorFactors;
  killReasons: string[];
  barrierNotes: string[];
}

export interface SmallVendorAnalysis {
  fit: number;
  factors: SmallVendorFactors;
  signals: SmallVendorSignals;
  badges: string[];
  why: string[];
  risks: string[];
}

type LooseRecord = Record<string, unknown>;

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as LooseRecord) : {};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : String(item ?? ""))).filter(Boolean);
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseGermanNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const toEur = (value: number, unit: string): number => {
  if (/mio|million/i.test(unit)) return value * 1_000_000;
  if (/tsd|tausend/i.test(unit)) return value * 1_000;
  return value;
};

const matchAmount = (text: string, pattern: RegExp): number | null => {
  const match = text.match(pattern);
  if (!match) return null;
  const value = parseGermanNumber(match[1] ?? "");
  if (value === null) return null;
  return toEur(value, match[2] ?? "");
};

const REVENUE_PATTERNS = [
  /mindest(?:umsatz|einkommen)[^\d%]{0,60}?([\d.,]+)\s*(mio\.?|millionen?|m€|tsd\.?|tausend)?/i,
  /jahres(?:umsatz|einkommen)[^\d%]{0,60}?([\d.,]+)\s*(mio\.?|millionen?|m€|tsd\.?|tausend)?/i,
  /umsatz[^\d%]{0,80}?([\d.,]+)\s*(mio\.?|millionen?|m€)/i,
  /([\d.,]+)\s*(?:mio\.?|millionen?)\s*(?:eur|€)[^\d%]{0,40}umsatz/i,
];

const REFERENCE_PATTERNS = [
  /(?:mindestens|min\.|mind\.|vorlage von|nachweis von)?\s*(\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig)\s*(?:vergleichbare|ähnliche|erforderliche|qualifizierte)?\s*referenzen/i,
  /referenzen?[^\d%]{0,40}?(?:mindestens|min\.|mind\.)\s*(\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig)/i,
];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const extractSmallVendorSignals = (title: string, structured: unknown): SmallVendorSignals => {
  const record = asRecord(structured);
  const decisionRelevant = asRecord(record.decision_relevant);
  const procurement = asRecord(record.procurement);

  const requirements = asStringArray(decisionRelevant.requirements);
  const mandatoryDocuments = asStringArray(decisionRelevant.mandatory_documents);
  const scope = asStringArray(decisionRelevant.scope);
  const awardCriteria = asStringArray(decisionRelevant.award_criteria);
  const participationRequirements = asStringArray(procurement.participation_requirements);

  const contractValue = asRecord(procurement.contract_value);
  const contractValueMinEur = asNumber(contractValue.min);
  const contractValueMaxEur = asNumber(contractValue.max);

  const requirementText = [...requirements, ...mandatoryDocuments, ...participationRequirements].join(" \n ");
  const barrierText = [requirementText, ...awardCriteria].join(" \n ");
  const barrierLower = barrierText.toLowerCase();
  const scopeLower = [...scope, title].join(" \n ").toLowerCase();
  const summaryLower = typeof record.summary === "string" ? record.summary.toLowerCase() : "";
  const titleLower = title.toLowerCase();
  const domainText = [titleLower, scopeLower, summaryLower].join(" \n ");

  const priceWeightPct = extractPriceWeightPct(procurement, awardCriteria);
  const qualityWeightHint = extractQualityWeightHint(procurement);

  let revenueMinEur: number | null = null;
  for (const pattern of REVENUE_PATTERNS) {
    revenueMinEur = matchAmount(barrierText, pattern);
    if (revenueMinEur !== null && revenueMinEur >= 10_000) break;
    revenueMinEur = revenueMinEur !== null && revenueMinEur < 10_000 ? null : revenueMinEur;
  }

  let referenceCountMin: number | null = null;
  for (const pattern of REFERENCE_PATTERNS) {
    const match = barrierText.match(pattern);
    if (match?.[1]) {
      const parsed = parseGermanCount(match[1]);
      if (parsed !== null && parsed > 0 && parsed < 50) {
        referenceCountMin = parsed;
        break;
      }
    }
  }

  const minEmployeesMatch = barrierText.match(/(?:mindestens|min\.|mind\.)\s*(\d{1,3})\s*(?:fest\s*angestellte[n]?|festangestellte[n]?|mitarbeiter(?:innen)?|beschäftigten)/i);
  const minEmployees = minEmployeesMatch ? Number.parseInt(minEmployeesMatch[1], 10) : null;

  const yearsMatch = barrierText.match(/(?:mindestens|min\.|mind\.)\s*(\d{1,2})\s*jahre?[sr]?\s*(?:berufs)?erfahrung/i);
  const minYearsExperience = yearsMatch ? Number.parseInt(yearsMatch[1], 10) : null;

  const personDaysMatch = domainText.match(/(\d{2,5})\s*(?:personen-?|arbeits-?)?tage|(\d{2,5})\s*pt\b/i);
  const personDaysHint = personDaysMatch
    ? Number.parseInt(personDaysMatch[1] ?? personDaysMatch[2] ?? "", 10)
    : null;

  const certificates: string[] = [];
  if (/\biso\s*\/?\s*(?:iec\s*)?2700?1\b|iso-27001/i.test(barrierText)) certificates.push("ISO 27001");
  if (/\biso\s*9001\b/i.test(barrierText)) certificates.push("ISO 9001");
  if (/\bbsi\b/i.test(barrierLower)) certificates.push("BSI");
  if (/\bkritis\b/i.test(barrierLower)) certificates.push("KRITIS");
  if (/zertifizi(?:ert|erung)[^\n.]{0,50}(?:din|tüv|iso)/i.test(barrierText)) certificates.push("Zertifizierungspflicht");

  const securityClearance = /ü\s?[23]\b|sicherheits(?:überprüfung|pruefung|ueberprüfung)|geheimschutz|verschuldensunab/i.test(barrierText)
    || /\b\s[23]\b\s*sicherheitsfreigabe/i.test(barrierText);

  const insuranceMinEur = matchAmount(barrierText, /(?:berufs|betriebs|vermögens)?haftpflicht(?:deckung|versicherung)?[^\n.]{0,80}?([\d.,]+)\s*(mio\.?|millionen?|m€|tsd\.?|tausend)?\s*(?:eur|€)/i)
    ?? matchAmount(barrierText, /versicherungssumme[^\n.]{0,80}?([\d.,]+)\s*(mio\.?|millionen?|m€|tsd\.?|tausend)/i);

  const requiresGermanOffice = /niederlassung[^\n.]{0,60}deutschland|betriebsstätte[^\n.]{0,50}deutschland|geschäftsraum[^\n.]{0,40}deutschland/i.test(barrierText);

  const subcontractingForbidden = /nachunternehmer[^\n.]{0,50}(?:nicht|untersagt|ausgeschlossen|nicht gestattet)/i.test(barrierText);
  const subcontractingAllowedText = /(nach|sub)unternehmer[^\n.]{0,60}(?:zulässig|erlaubt|gestattet|möglich)|einsatz von nachunternehmern/i.test(barrierText);
  const subcontractingAllowed = subcontractingForbidden ? false : subcontractingAllowedText ? true : null;

  const suitabilityLeaseAllowed = /eignungsleihe[^\n.]{0,50}(?:zulässig|erlaubt|möglich|gestattet)/i.test(barrierText);

  const personalReferencesOk = /persönliche\s+referenzen|experten(?:referen|verweis)|referenzen\s+(?:von\s+)?(?:einzel)?personen|projektreferenzen\s+(?:von|dritter)\s+personen|erfahrungsnachweise\s+(?:von\s+)?personen/i.test(barrierText);

  const remoteFriendly = /\bremote\b|telearbeit|home-?office|dezentrale\s+arbeitsweise|ortsunabhängig|virtuelle\s+teamarbeit/i.test(domainText + " " + barrierText);
  const mandatoryOnSite = /vor-?ort[^\n.]{0,50}(?:bundesweit|deutschweit|flächendeckend)|bundesweite[^\n.]{0,40}präsenz|präsenz[^\n.]{0,40}beim\s+auftraggeber/i.test(barrierText + " " + scopeLower);
  const aroundTheClockSupport = /24\s*\/\s*7|24\s+stunden|rufbereitschaft|bereitschaftsdienst|betriebsbereitschaft/i.test(barrierText + " " + scopeLower);

  const isAnu = /arbeitnehmerüberlassung|arbeitnehmerueberlassung|\banü\b|\bübe?\b\s* personalüberlassung/i.test(barrierText + " " + scopeLower);
  const isFrameworkOrGu = /rahmenvertrag|rahmenvereinbarung|dynamische\s+beschaffung|general(?:über|ueber)nehmer|total(?:über|ueber)nehmer/i.test(titleLower + " " + barrierLower + " " + scopeLower);

  const hardwareOnly = /(?:liefer(?:ung)?\s+(?:von\s+)?(?:it-?)?hardware|hardwarebeschaffung|gerätebeschaffung|lizenzbeschaffung|reine\s+lizenz|softwarelizenzen\s+zu\s+liefern)/i.test(titleLower + " " + scopeLower);
  const titleTokens = titleLower.split(/[^a-zäöüß0-9]+/).filter(Boolean);
  const procurementTitle = titleTokens.some((token) =>
    ["beschaffung", "lieferung", "liefer", "überlassung", "supply", "anschaffung"].some((word) => token.startsWith(word)));
  const devWorkInTitle = /(entwicklung|programmierung|implementierung|konzeption|integration|anpassung|migration|wartung|pflege|betrieb|schulung|api|schnittstelle)/i.test(titleLower);
  const isHardwareOrLicenceOnly = (hardwareOnly || (procurementTitle && !devWorkInTitle)) && !/softwareentwicklung|software-?entwicklung|webentwicklung|app(?:-|\s)?entwicklung|programmierung/i.test(titleLower);

  const cpvCodes = asStringArray(procurement.cpv_codes);
  const cpvPrefixes = cpvCodes.map((code) => code.replace(/\D/g, ""));
  const cpvIt = cpvPrefixes.some((code) => code.startsWith("72") || code.startsWith("48"));

  const strongDevInTitle = /(software|web(?:-|\s)?(?:anwendung|plattform|portal|auftritt|seite)|webanwendung|webseite|homepage|app(?:-|\s)?entwicklung|künstliche intelligenz|ki-?(?:lösung|system|projekt|modell|anwendung)|\bllm\b|large language model|maschinelles lernen|machine learning|\bai\b|\bapi\b|api-|schnittstelle|programmierung|fullstack|frontend|backend|prototyp|mvp|\bsap\b|\berp\b|implementierung|it-?entwicklung|softwareentwicklung)/i.test(titleLower);
  const itTermInTitle = /(software|web|\bit\b|it-|digital|datenbank|\bapi\b|api-|\bki\b|\bai\b|\bllm\b|\bsap\b|\berp\b)/i.test(titleLower);
  const strongContextTerms = domainText.match(/software|web(?:-|\s)?(?:anwendung|plattform|portal|seite)|\bapi\b|api-|schnittstelle|programmierung|künstliche intelligenz|\bllm\b|maschinelles lernen|machine learning|frontend|backend|fullstack|automatisierung|datenverarbeitung|digitalisierung/gi) ?? [];
  const strongContextCount = new Set(strongContextTerms.map((term) => term.toLowerCase())).size;
  const isItDomain: SmallVendorSignals["isItDomain"] = strongDevInTitle || (cpvIt && (itTermInTitle || strongContextCount >= 1))
    ? "strong"
    : itTermInTitle || (cpvIt && strongContextCount >= 1) || strongContextCount >= 2
      ? "weak"
      : "none";

  const isLot = /(^|\W)los\s*\.?\s*\d+|teillose\s*\d*|fachlose?\s*\d+/i.test(titleLower + " " + scopeLower);

  const durationValue = asRecord(procurement.contract_duration);
  const durationMonthsHint = asNumber(durationValue.months);

  return {
    priceWeightPct,
    qualityWeightHint,
    contractValueMaxEur,
    contractValueMinEur,
    revenueMinEur,
    referenceCountMin,
    minEmployees: minEmployees !== null && Number.isFinite(minEmployees) ? minEmployees : null,
    minYearsExperience,
    personDaysHint: personDaysHint !== null && Number.isFinite(personDaysHint) ? personDaysHint : null,
    certificates,
    securityClearance,
    insuranceMinEur,
    requiresGermanOffice,
    subcontractingAllowed,
    suitabilityLeaseAllowed,
    personalReferencesOk,
    remoteFriendly,
    mandatoryOnSite,
    aroundTheClockSupport,
    isAnu,
    isFrameworkOrGu,
    isHardwareOrLicenceOnly,
    isItDomain,
    isLot,
    mandatoryDocumentCount: mandatoryDocuments.length,
    requirementCount: requirements.length + participationRequirements.length,
    durationMonthsHint: durationMonthsHint !== null && Number.isFinite(durationMonthsHint) ? durationMonthsHint : null,
  };
};

const extractPriceWeightPct = (procurement: LooseRecord, awardCriteria: string[]): number | null => {
  const detailed = Array.isArray(procurement.award_criteria_detailed) ? procurement.award_criteria_detailed : [];
  const entries = detailed
    .map((item) => {
      const record = asRecord(item);
      return {
        criterion: typeof record.criterion === "string" ? record.criterion : "",
        weight: typeof record.weight === "number" && Number.isFinite(record.weight) ? record.weight : null,
      };
    })
    .filter((entry) => entry.criterion);

  const priceEntry = entries.find((entry) => /preis|kosten|money|price/i.test(entry.criterion) && entry.weight !== null);
  if (priceEntry && priceEntry.weight !== null) {
    return normalizeWeight(priceEntry.weight, entries);
  }

  for (const criterion of awardCriteria) {
    const match = criterion.match(/preis[^0-9%]{0,40}?(\d{1,3})\s*%/i);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (value >= 0 && value <= 100) return value;
    }
  }
  return null;
};

const extractQualityWeightHint = (procurement: LooseRecord): number | null => {
  const detailed = Array.isArray(procurement.award_criteria_detailed) ? procurement.award_criteria_detailed : [];
  const entries = detailed
    .map((item) => {
      const record = asRecord(item);
      return {
        criterion: typeof record.criterion === "string" ? record.criterion : "",
        weight: typeof record.weight === "number" && Number.isFinite(record.weight) ? record.weight : null,
      };
    })
    .filter((entry) => entry.criterion);

  const qualityEntry = entries.find((entry) => /qualität|qualitaet|konzept|leistung|qualität des angebots/i.test(entry.criterion) && entry.weight !== null);
  if (qualityEntry && qualityEntry.weight !== null) {
    return normalizeWeight(qualityEntry.weight, entries);
  }
  return null;
};

const normalizeWeight = (weight: number, entries: Array<{ weight: number | null }>): number => {
  const allWeights = entries.map((entry) => entry.weight).filter((value): value is number => value !== null);
  const total = allWeights.reduce((sum, value) => sum + value, 0);
  if (total > 0 && total <= 1.5) {
    return Math.round(weight * 100);
  }
  return Math.round(weight);
};

const scorePriceWeighting = (priceWeightPct: number | null): number => {
  if (priceWeightPct === null) return 0.35;
  if (priceWeightPct >= 90) return 1;
  if (priceWeightPct >= 70) return 0.9;
  if (priceWeightPct >= 50) return 0.6;
  if (priceWeightPct >= 40) return 0.4;
  return 0.15;
};

const scoreSizeFit = (signals: SmallVendorSignals): number => {
  const value = signals.contractValueMaxEur;
  let base: number;
  if (value === null) {
    base = 0.55;
  } else if (value <= 50_000) {
    base = 0.8;
  } else if (value <= 150_000) {
    base = 1;
  } else if (value <= 300_000) {
    base = 0.95;
  } else if (value <= 600_000) {
    base = 0.8;
  } else if (value <= 1_000_000) {
    base = 0.6;
  } else if (value <= 2_000_000) {
    base = 0.4;
  } else {
    base = 0.2;
  }
  if (signals.isLot && value !== null && value > 1_000_000) {
    base = Math.max(base, 0.6);
  }
  if (signals.isFrameworkOrGu) {
    base *= 0.8;
  }
  return clamp01(base);
};

export const computeSmallVendorFit = (signals: SmallVendorSignals): SmallVendorFit => {
  const techFit = signals.isItDomain === "strong" ? 1 : signals.isItDomain === "weak" ? 0.55 : 0.05;
  const priceWeighting = scorePriceWeighting(signals.priceWeightPct);
  const sizeFit = scoreSizeFit(signals);
  const remoteFit = signals.mandatoryOnSite ? 0.25 : signals.remoteFriendly ? 1 : 0.65;

  let eligibility = 1;
  const barrierNotes: string[] = [];
  const killReasons: string[] = [];

  if (signals.securityClearance) {
    killReasons.push("Sicherheitsüberprüfung (Ü2/Ü3) oder Geheimschutz erforderlich");
  }
  if (signals.isAnu) {
    killReasons.push("Reine Arbeitnehmerüberlassung");
  }
  if (signals.isHardwareOrLicenceOnly) {
    killReasons.push("Hardware- oder reine Lizenzbeschaffung ohne Entwicklungsanteil");
  }
  if (signals.revenueMinEur !== null && signals.revenueMinEur >= 1_000_000) {
    killReasons.push(`Mindestumsatz ${formatEur(signals.revenueMinEur)} erforderlich`);
  } else if (signals.revenueMinEur !== null && signals.revenueMinEur >= 100_000) {
    eligibility -= 0.2;
    barrierNotes.push(`Mindestumsatz ${formatEur(signals.revenueMinEur)}`);
  }
  if (signals.personDaysHint !== null && signals.personDaysHint >= 300) {
    killReasons.push(`Sehr großes Projektvolumen (≥ ${signals.personDaysHint} Personentage)`);
  } else if (signals.personDaysHint !== null && signals.personDaysHint >= 100) {
    eligibility -= 0.15;
    barrierNotes.push(`Hohes Projektvolumen (${signals.personDaysHint} Personentage)`);
  }
  if (signals.minEmployees !== null && signals.minEmployees >= 5) {
    eligibility -= 0.2;
    barrierNotes.push(`Mindestens ${signals.minEmployees} Mitarbeitende gefordert`);
  } else if (signals.minEmployees !== null && signals.minEmployees > 0) {
    barrierNotes.push(`Mindestens ${signals.minEmployees} Mitarbeitende gefordert`);
  }
  if (signals.referenceCountMin !== null && signals.referenceCountMin >= 3) {
    eligibility -= 0.25;
    barrierNotes.push(`${signals.referenceCountMin} Referenzen erforderlich`);
  } else if (signals.referenceCountMin !== null) {
    eligibility -= 0.1;
    barrierNotes.push(`${signals.referenceCountMin} Referenz(en) erforderlich`);
  }
  if (signals.certificates.includes("ISO 27001") || signals.certificates.includes("BSI") || signals.certificates.includes("KRITIS")) {
    eligibility -= 0.25;
    barrierNotes.push(`Zertifizierungsanforderungen: ${signals.certificates.join(", ")}`);
  } else if (signals.certificates.length > 0) {
    eligibility -= 0.1;
    barrierNotes.push(`Zertifikate genannt: ${signals.certificates.join(", ")}`);
  }
  if (signals.insuranceMinEur !== null && signals.insuranceMinEur >= 1_000_000) {
    eligibility -= 0.15;
    barrierNotes.push(`Haftpflicht ${formatEur(signals.insuranceMinEur)}`);
  }
  if (signals.requiresGermanOffice) {
    eligibility -= 0.25;
    barrierNotes.push("Niederlassung/Betriebsstätte in Deutschland gefordert");
  }
  if (signals.minYearsExperience !== null && signals.minYearsExperience >= 5) {
    eligibility -= 0.15;
    barrierNotes.push(`${signals.minYearsExperience} Jahre Berufserfahrung gefordert`);
  }
  if (signals.aroundTheClockSupport) {
    eligibility -= 0.1;
    barrierNotes.push("24/7-Betrieb/Rufbereitschaft gefordert");
  }
  if (signals.mandatoryOnSite) {
    barrierNotes.push("Bundesweite/kundenseitige Vor-Ort-Präsenz gefordert");
  }
  eligibility = clamp01(eligibility);

  let competition = 0.7;
  if (signals.isFrameworkOrGu) {
    competition -= 0.2;
  }
  if (signals.subcontractingAllowed === true || signals.suitabilityLeaseAllowed) {
    competition += 0.1;
  }
  competition = clamp01(competition);

  let complexity = 0.8;
  if (signals.mandatoryDocumentCount >= 6) complexity -= 0.15;
  else if (signals.mandatoryDocumentCount >= 3) complexity -= 0.05;
  if (signals.requirementCount >= 10) complexity -= 0.1;
  if (signals.durationMonthsHint !== null && signals.durationMonthsHint >= 36) complexity -= 0.1;
  complexity = clamp01(complexity);

  const factors: SmallVendorFactors = {
    techFit: Math.round(techFit * 100),
    priceWeighting: Math.round(priceWeighting * 100),
    eligibility: Math.round(eligibility * 100),
    sizeFit: Math.round(sizeFit * 100),
    remoteFit: Math.round(remoteFit * 100),
    competition: Math.round(competition * 100),
    complexity: Math.round(complexity * 100),
  };

  let fit = 100 * (
    techFit * 0.3 +
    priceWeighting * 0.18 +
    eligibility * 0.22 +
    sizeFit * 0.14 +
    remoteFit * 0.06 +
    competition * 0.1
  );

  if (killReasons.length > 0) {
    fit = Math.min(fit, 20);
  }

  return {
    fit: Math.round(Math.max(0, Math.min(100, fit))),
    factors,
    killReasons,
    barrierNotes,
  };
};

const formatEur = (value: number): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)} Mio. €`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} Tsd. €`;
  }
  return `${Math.round(value)} €`;
};

export const deriveBadges = (signals: SmallVendorSignals, fit: number): string[] => {
  const badges: string[] = [];
  if (signals.isItDomain !== "none") badges.push("IT / Software");
  if (signals.priceWeightPct !== null && signals.priceWeightPct >= 90) badges.push(`Preis ${signals.priceWeightPct} %`);
  else if (signals.priceWeightPct !== null && signals.priceWeightPct >= 70) badges.push(`Preis hoch (${signals.priceWeightPct} %)`);
  if (signals.revenueMinEur === null) badges.push("No Revenue Requirement");
  if (signals.minEmployees === null) badges.push("Small Team");
  if (signals.referenceCountMin === null && signals.personalReferencesOk) badges.push("Personal References OK");
  if (signals.subcontractingAllowed === true || signals.suitabilityLeaseAllowed) badges.push("Subcontracting Allowed");
  if (signals.remoteFriendly && !signals.mandatoryOnSite) badges.push("Remote");
  if (signals.isLot) badges.push("Small Lot");
  const barriers = countBarriers(signals);
  if (barriers === 0) badges.push("Low Entry Barrier");
  if (fit >= SMALL_VENDOR_HIGHLIGHT_THRESHOLD) badges.push("High Winability");
  return badges;
};

const countBarriers = (signals: SmallVendorSignals): number => {
  let count = 0;
  if (signals.revenueMinEur !== null) count += 1;
  if (signals.referenceCountMin !== null) count += 1;
  if (signals.minEmployees !== null) count += 1;
  if (signals.certificates.length > 0) count += 1;
  if (signals.securityClearance) count += 1;
  if (signals.insuranceMinEur !== null && signals.insuranceMinEur >= 1_000_000) count += 1;
  if (signals.requiresGermanOffice) count += 1;
  if (signals.minYearsExperience !== null) count += 1;
  return count;
};

export const buildSmallVendorExplanation = (
  signals: SmallVendorSignals,
  fitResult: SmallVendorFit,
): { why: string[]; risks: string[] } => {
  const why: string[] = [];

  if (signals.priceWeightPct !== null) {
    why.push(`Zuschlagskriterium Preis ist mit ${signals.priceWeightPct} % gewichtet — gute Chance für ein preislich attraktives Angebot.`);
  } else {
    why.push("Die Preisgewichtung ist nicht explizit dokumentiert — Details vorab prüfen.");
  }
  if (signals.isItDomain === "strong") {
    why.push("Klare Software-/IT-Leistung — passt zum Leistungsspektrum eines spezialisierten Entwicklungsunternehmens.");
  } else if (signals.isItDomain === "weak") {
    why.push("IT-Bezug erkennbar, der fachliche Kern sollte jedoch im Detail geprüft werden.");
  }
  if (signals.contractValueMaxEur !== null) {
    why.push(`Geschätztes Auftragsvolumen bis ${formatEur(signals.contractValueMaxEur)}${signals.isLot ? " (Los innerhalb einer größeren Vergabe)" : ""}.`);
  }
  if (signals.revenueMinEur === null && signals.referenceCountMin === null && signals.minEmployees === null) {
    why.push("Keine Mindestumsatz-, Referenz- oder Mitarbeiterzahl-Anforderungen erkennbar.");
  }
  if (signals.subcontractingAllowed === true || signals.suitabilityLeaseAllowed) {
    why.push("Nachunternehmer-/Eignungsleihelösungen sind zulässig — Kapazitäten flexibel skallierbar.");
  }
  if (signals.personalReferencesOk) {
    why.push("Persönliche Expertenreferenzen sind zulässig.");
  }
  if (signals.remoteFriendly && !signals.mandatoryOnSite) {
    why.push("Remote-Ausführung ist erkennbar möglich.");
  }
  if (fitResult.barrierNotes.length === 0 && fitResult.killReasons.length === 0) {
    why.push("Insgesamt geringe formale Eignungshürden — Fokus liegt auf Preis und fachlicher Passung.");
  }

  const risks: string[] = [...fitResult.killReasons, ...fitResult.barrierNotes];
  if (signals.isFrameworkOrGu) {
    risks.push("Rahmenvertrag/Generalunternehmer-Struktur — hohen Koordinationsaufwand prüfen.");
  }
  if (signals.mandatoryDocumentCount >= 4) {
    risks.push(`${signals.mandatoryDocumentCount} Pflichtunterlagen — Angebotsaufwand einplanen.`);
  }
  if (risks.length === 0) {
    risks.push("Keine Ausschlusskriterien erkennbar — Angebotsqualität und Preis entscheiden.");
  }

  return { why, risks };
};

export const analyzeTenderForSmallVendor = (title: string, structured: unknown): SmallVendorAnalysis => {
  const signals = extractSmallVendorSignals(title, structured);
  const fitResult = computeSmallVendorFit(signals);
  const { why, risks } = buildSmallVendorExplanation(signals, fitResult);
  return {
    fit: fitResult.fit,
    factors: fitResult.factors,
    signals,
    badges: deriveBadges(signals, fitResult.fit),
    why,
    risks,
  };
};

export interface SmallVendorCompact {
  fit: number;
  priceWeightPct: number | null;
  lowEntryBarrier: boolean;
  remoteFriendly: boolean;
  isItDomain: boolean;
  isLot: boolean;
}

export const toCompact = (analysis: SmallVendorAnalysis): SmallVendorCompact => ({
  fit: analysis.fit,
  priceWeightPct: analysis.signals.priceWeightPct,
  lowEntryBarrier: !analysis.signals.securityClearance
    && analysis.signals.revenueMinEur === null
    && analysis.signals.referenceCountMin === null
    && analysis.signals.minEmployees === null
    && analysis.signals.certificates.length === 0,
  remoteFriendly: analysis.signals.remoteFriendly && !analysis.signals.mandatoryOnSite,
  isItDomain: analysis.signals.isItDomain !== "none",
  isLot: analysis.signals.isLot,
});

export const deriveCompactBadges = (compact: SmallVendorCompact): string[] => {
  const badges: string[] = [];
  if (compact.isItDomain) badges.push("IT / Software");
  if (compact.priceWeightPct !== null && compact.priceWeightPct >= 90) badges.push(`Preis ${compact.priceWeightPct} %`);
  else if (compact.priceWeightPct !== null && compact.priceWeightPct >= 70) badges.push(`Preis hoch (${compact.priceWeightPct} %)`);
  if (compact.lowEntryBarrier) badges.push("Low Entry Barrier");
  if (compact.remoteFriendly) badges.push("Remote");
  if (compact.isLot) badges.push("Small Lot");
  if (compact.fit >= SMALL_VENDOR_HIGHLIGHT_THRESHOLD) badges.push("High Winability");
  return badges;
};

export type { StructuredData };
