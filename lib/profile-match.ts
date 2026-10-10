import { CRITERION_KINDS, type CriteriaResult, type CriterionFinding, type CriterionKind } from "@/lib/tender-criteria";

export interface BidderProfile {
  legalForm?: string | null;
  foundedOn?: string | null;
  registeredInGermany?: boolean | null;
  revenueByYearEur?: Record<string, number> | null;
  financialStatementsYears?: number | null;
  referenceCount?: number | null;
  certificates?: string[] | null;
  liabilityInsuranceEur?: number | null;
  employees?: number | null;
  inGermany?: boolean | null;
  germanLanguage?: boolean | null;
  available24x7?: boolean | null;
}

export interface PartnerProfile extends BidderProfile {
  name: string;
}

export interface MatchProfile {
  bidder: BidderProfile;
  partner?: PartnerProfile | null;
  asOf?: string | null;
}

export type BarrierStatus = "met" | "via_partner" | "barrier" | "unclear" | "not_found";

export interface BarrierCheck {
  kind: CriterionKind;
  status: BarrierStatus;
  reason: string;
  evidence: CriterionFinding[];
}

export type TenderFitVerdict = "barrier" | "unclear" | "no_barrier_found";

export type CapacityKind = "third_party_capacity" | "subcontracting" | "consortium";

export interface CapacityRuleSummary {
  kind: CapacityKind;
  rule: "allowed" | "forbidden" | "limited" | "unklar" | "nicht_gefunden";
  evidence: CriterionFinding[];
}

export interface TenderMatchResult {
  verdict: TenderFitVerdict;
  checks: BarrierCheck[];
  capacityRules: CapacityRuleSummary[];
  barrierCount: number;
  unclearCount: number;
  notFoundCount: number;
  documentsSearched: number;
  limitations: string[];
}

type Outcome = Pick<BarrierCheck, "status" | "reason">;

interface Side {
  label: "bidder" | "partner";
  profile: BidderProfile;
}

interface Context {
  asOf: Date;
  missing: Set<string>;
}

const CAPACITY_NOUNS: Record<CapacityKind, string> = {
  third_party_capacity: "Eignungsleihe",
  subcontracting: "Nachunternehmer",
  consortium: "Bietergemeinschaft",
};

const ROUTE_SOURCES: Partial<Record<CriterionKind, CapacityKind[]>> = {
  revenue: ["third_party_capacity"],
  references: ["third_party_capacity"],
  certificate: ["subcontracting", "third_party_capacity"],
  team: ["subcontracting", "third_party_capacity"],
};

const isCapacity = (kind: CriterionKind): kind is CapacityKind => kind in CAPACITY_NOUNS;

const outcome = (status: BarrierStatus, reason: string): Outcome => ({ status, reason });

const dayOf = (value: string | null | undefined): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
};

const fullYearsBetween = (from: Date, to: Date): number => {
  const monthDay = (date: Date): number => date.getUTCMonth() * 100 + date.getUTCDate();
  return to.getUTCFullYear() - from.getUTCFullYear() - (monthDay(to) >= monthDay(from) ? 0 : 1);
};

const formatEur = (value: number): string => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} EUR`;

const normalizeCertificate = (name: string): string => name.toLowerCase().replace(/[\s/]/g, "");

const profileValue = <T>(value: T | null | undefined, side: Side, field: keyof BidderProfile, ctx: Context): T | null => {
  if (value !== null && value !== undefined) return value;
  ctx.missing.add(`${side.label}.${field}`);
  return null;
};

const countStatus = (checks: BarrierCheck[], status: BarrierStatus): number =>
  checks.filter((check) => check.status === status).length;

const assessRevenue = (finding: CriterionFinding, side: Side, ctx: Context): Outcome => {
  const amount = finding.amountEur;
  const years = finding.years;
  if (amount === null || years === null) return outcome("unclear", "Umsatzanforderung ohne Betrag oder Zeitraum");
  const foundedOn = profileValue(side.profile.foundedOn, side, "foundedOn", ctx);
  const founded = dayOf(foundedOn);
  if (founded !== null && fullYearsBetween(founded, ctx.asOf) < years) {
    return outcome("barrier", `Gründung ${foundedOn}: weniger als ${years} abgeschlossene Geschäftsjahre`);
  }
  const revenue: Record<string, number> = profileValue(side.profile.revenueByYearEur, side, "revenueByYearEur", ctx) ?? {};
  const period = Array.from({ length: years }, (_, index) => String(ctx.asOf.getUTCFullYear() - 1 - index));
  const missingYears = period.filter((year) => typeof revenue[year] !== "number");
  if (missingYears.length > 0) return outcome("unclear", `Umsatz fehlt für ${missingYears.join(", ")}`);
  if (/jedem|jeweils|je Geschäftsjahr/i.test(finding.quote)) {
    const below = period.filter((year) => revenue[year] < amount);
    return below.length === 0
      ? outcome("met", `Umsatz je Jahr erfüllt ${formatEur(amount)}`)
      : outcome("barrier", `Umsatz je Jahr unter ${formatEur(amount)} in ${below.join(", ")}`);
  }
  const total = period.reduce((sum, year) => sum + revenue[year], 0);
  return total >= amount
    ? outcome("met", `Umsatzsumme erfüllt ${formatEur(amount)}`)
    : outcome("barrier", `Umsatzsumme ${formatEur(total)} unter ${formatEur(amount)}`);
};

const assessRequirement = (finding: CriterionFinding, side: Side, ctx: Context): Outcome => {
  const { profile } = side;
  switch (finding.kind) {
    case "revenue":
      return assessRevenue(finding, side, ctx);
    case "references": {
      const count = finding.count;
      if (count === null) return outcome("unclear", "Anzahl der Referenzen nicht erkannt");
      const held = profileValue(profile.referenceCount, side, "referenceCount", ctx);
      if (held === null) return outcome("unclear", "Referenzanzahl nicht angegeben");
      return outcome(held >= count ? "met" : "barrier", `Referenzen: ${held} von ${count}`);
    }
    case "certificate": {
      const name = finding.certificate;
      if (name === null) return outcome("unclear", "Zertifikat nicht erkannt");
      const held = profileValue(profile.certificates, side, "certificates", ctx);
      if (held === null) return outcome("unclear", "Zertifikate nicht angegeben");
      const wanted = normalizeCertificate(name);
      return held.some((certificate) => normalizeCertificate(certificate) === wanted)
        ? outcome("met", `Zertifikat ${name} vorhanden`)
        : outcome("barrier", `Zertifikat ${name} fehlt`);
    }
    case "insurance": {
      const amount = finding.amountEur;
      if (amount === null) return outcome("unclear", "Deckungssumme nicht erkannt");
      const held = profileValue(profile.liabilityInsuranceEur, side, "liabilityInsuranceEur", ctx);
      if (held === null) return outcome("unclear", "Deckung nicht angegeben, beschaffbar?");
      return held >= amount
        ? outcome("met", `Deckung ${formatEur(held)} ausreichend`)
        : outcome("barrier", `Deckung ${formatEur(held)} unter ${formatEur(amount)}, beschaffbar`);
    }
    case "financial_statements": {
      const years = finding.years;
      if (years === null) return outcome("unclear", "Zeitraum der Jahresabschlüsse nicht erkannt");
      const held = profileValue(profile.financialStatementsYears, side, "financialStatementsYears", ctx);
      if (held === null) return outcome("unclear", "Jahresabschlüsse nicht angegeben");
      return outcome(held >= years ? "met" : "barrier", `Jahresabschlüsse: ${held} von ${years} Jahren`);
    }
    case "team": {
      const count = finding.count;
      if (count === null) return outcome("unclear", "Mitarbeitendenzahl nicht erkannt");
      const held = profileValue(profile.employees, side, "employees", ctx);
      if (held === null) return outcome("unclear", "Mitarbeitendenzahl nicht angegeben");
      return outcome(held >= count ? "met" : "barrier", `Mitarbeitende: ${held} von ${count}`);
    }
    case "legal_form": {
      const held = profileValue(profile.registeredInGermany, side, "registeredInGermany", ctx);
      if (held === null) return outcome("unclear", "Eintragung in Deutschland nicht angegeben");
      return held ? outcome("met", "in Deutschland registriert") : outcome("barrier", "nicht in Deutschland registriert");
    }
    case "company_age": {
      const years = finding.years;
      if (years === null) return outcome("unclear", "Mindestalter nicht erkannt");
      const founded = dayOf(profileValue(profile.foundedOn, side, "foundedOn", ctx));
      if (founded === null) return outcome("unclear", "Gründungsdatum fehlt oder ist ungültig");
      const age = fullYearsBetween(founded, ctx.asOf);
      return outcome(age >= years ? "met" : "barrier", `${age} Jahre am Markt, benötigt ${years}`);
    }
    case "presence": {
      const held = profileValue(profile.inGermany, side, "inGermany", ctx);
      if (held === null) return outcome("unclear", "Standort nicht angegeben");
      return held ? outcome("met", "in Deutschland ansässig") : outcome("barrier", "nicht in Deutschland ansässig");
    }
    case "language": {
      const held = profileValue(profile.germanLanguage, side, "germanLanguage", ctx);
      if (held === null) return outcome("unclear", "Deutschkenntnisse nicht angegeben");
      return held ? outcome("met", "Deutschkenntnisse vorhanden") : outcome("barrier", "Deutschkenntnisse fehlen");
    }
    case "availability": {
      const held = profileValue(profile.available24x7, side, "available24x7", ctx);
      if (held === null) return outcome("unclear", "Verfügbarkeit nicht angegeben");
      return held ? outcome("met", "24/7 verfügbar") : outcome("barrier", "nicht 24/7 verfügbar");
    }
    default:
      return outcome("unclear", "Anforderung nicht auswertbar");
  }
};

const capacityOutcome = (findings: CriterionFinding[], noun: string): Outcome => {
  if (findings.some((finding) => finding.rule === "forbidden")) return outcome("barrier", `${noun} nicht zulässig`);
  if (findings.some((finding) => finding.rule === "limited")) return outcome("unclear", "Anteil begrenzt");
  if (findings.some((finding) => finding.rule === null)) return outcome("unclear", "Regelung unklar");
  return outcome("met", `${noun} zulässig`);
};

const capacityRuleSummary = (kind: CapacityKind, criteria: CriteriaResult): CapacityRuleSummary => {
  const evidence = criteria.findings.filter((finding) => finding.kind === kind);
  if (evidence.length === 0) return { kind, rule: "nicht_gefunden", evidence };
  const rules = new Set(evidence.map((finding) => finding.rule));
  const rule = rules.has("forbidden") ? "forbidden" : rules.has("limited") ? "limited" : rules.has("allowed") ? "allowed" : "unklar";
  return { kind, rule, evidence };
};

const partnerRoute = (kind: CriterionKind, partner: PartnerProfile, criteria: CriteriaResult): Outcome => {
  const source = (ROUTE_SOURCES[kind] ?? []).find((candidate) => criteria.findings.some((finding) => finding.kind === candidate));
  if (source === undefined) {
    return outcome("unclear", `Regel zu Eignungsleihe bzw. Nachunternehmern nicht gefunden; Partner ${partner.name} erfüllt das Kriterium`);
  }
  const rule = capacityOutcome(criteria.findings.filter((finding) => finding.kind === source), CAPACITY_NOUNS[source]);
  if (rule.status === "barrier") return rule;
  return outcome(rule.status === "met" ? "via_partner" : "unclear", `Partner ${partner.name}: ${rule.reason}`);
};

const requirementCheck = (finding: CriterionFinding, criteria: CriteriaResult, profile: MatchProfile, ctx: Context): BarrierCheck => {
  let result = assessRequirement(finding, { label: "bidder", profile: profile.bidder }, ctx);
  const partner = profile.partner;
  if (partner && result.status === "barrier" && ROUTE_SOURCES[finding.kind]) {
    const partnerResult = assessRequirement(finding, { label: "partner", profile: partner }, ctx);
    if (partnerResult.status === "met") result = partnerRoute(finding.kind, partner, criteria);
    else if (partnerResult.status === "unclear") result = outcome("unclear", `Partner ${partner.name}: ${partnerResult.reason}`);
  }
  return { kind: finding.kind, status: result.status, reason: result.reason, evidence: [finding] };
};

const notFoundCheck = (kind: CriterionKind, findings: CriterionFinding[], documentsSearched: number): BarrierCheck => {
  let reason = `in ${documentsSearched} Dokumenten nicht gefunden`;
  if (findings.length > 0) {
    reason = findings.some((finding) => finding.type === "zuschlag")
      ? "nur als Zuschlagskriterium gefunden"
      : "nur als Beschreibung gefunden";
  }
  return { kind, status: "not_found", reason, evidence: findings };
};

const checksFor = (kind: CriterionKind, criteria: CriteriaResult, profile: MatchProfile, ctx: Context): BarrierCheck[] => {
  if (isCapacity(kind)) return [];
  const findings = criteria.findings.filter((finding) => finding.kind === kind);
  const musts = findings.filter((finding) => finding.type === "muss");
  if (musts.length === 0) return [notFoundCheck(kind, findings, criteria.documentsSearched)];
  return musts.map((finding) => requirementCheck(finding, criteria, profile, ctx));
};

const verdictOf = (checks: BarrierCheck[], documentsSearched: number): TenderFitVerdict => {
  if (countStatus(checks, "barrier") > 0) return "barrier";
  if (countStatus(checks, "unclear") > 0 || documentsSearched === 0) return "unclear";
  if (countStatus(checks, "met") + countStatus(checks, "via_partner") === 0) return "unclear";
  return "no_barrier_found";
};

export const evaluateTenderFit = (criteria: CriteriaResult, profile: MatchProfile, now: Date = new Date()): TenderMatchResult => {
  const ctx: Context = { asOf: dayOf(profile.asOf) ?? now, missing: new Set<string>() };
  const checks = CRITERION_KINDS.flatMap((kind) => checksFor(kind, criteria, profile, ctx));
  const capacityRules = (Object.keys(CAPACITY_NOUNS) as CapacityKind[]).map((kind) => capacityRuleSummary(kind, criteria));
  const limitations = [
    ...criteria.limitations,
    "Kriterien nicht gefunden bedeutet: in den geprüften Dokumenten nicht gefunden, nicht: nicht erforderlich.",
  ];
  if (checks.some((check) => check.status === "via_partner")) {
    limitations.push("Partnerroute setzt eine ausdrücklich zulässige Eignungsleihe bzw. Nachunternehmerregelung voraus.");
  }
  limitations.push(...Array.from(ctx.missing, (field) => `Profilwert fehlt: ${field}`));
  return {
    verdict: verdictOf(checks, criteria.documentsSearched),
    checks,
    capacityRules,
    barrierCount: countStatus(checks, "barrier"),
    unclearCount: countStatus(checks, "unclear"),
    notFoundCount: countStatus(checks, "not_found"),
    documentsSearched: criteria.documentsSearched,
    limitations,
  };
};
