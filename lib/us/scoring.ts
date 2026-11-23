import type { CompanyProfile, UsTender } from "@/lib/schema";
import { formatUsDateTime, parseStringArray } from "@/lib/us/types";

const toLowerStrings = (value: unknown): string[] => parseStringArray(value).map((item) => item.toLowerCase());

type UsTenderForPursuit = Pick<UsTender, "title" | "description" | "naicsCodesJson" | "setAside" | "deadlineAt">;
type CompanyProfileForPursuit = Pick<CompanyProfile, "naicsCodesJson" | "capabilitiesJson" | "socioEconomicJson" | "uei" | "cageCode">;

const REQUIRED_STATUS: Array<{ pattern: RegExp; status: string; label: string }> = [
  { pattern: /8\(a\)/i, status: "8a", label: "8(a)-Förderprogramm" },
  { pattern: /hubzone/i, status: "hubzone", label: "HUBZone" },
  { pattern: /service-disabled|sdvosb/i, status: "sdvosb", label: "Unternehmen im Besitz dienstunfähiger Veteraninnen und Veteranen (SDVOSB)" },
  { pattern: /women-owned|wosb/i, status: "wosb", label: "Frauenunternehmen (WOSB)" },
  { pattern: /small business/i, status: "small_business", label: "Kleinunternehmen (Small Business)" },
];

export interface UsTenderFit {
  score: number;
  naicsMatch: boolean;
  capabilityMatch: boolean;
  eligibleForSetAside: boolean | null;
  requiredSetAside: string | null;
  registrationReady: boolean;
  reasons: string[];
}

export const getRequiredSetAside = (setAside: string | null): { status: string; label: string } | null => {
  if (!setAside) return null;
  return REQUIRED_STATUS.find((item) => item.pattern.test(setAside)) ?? null;
};

export function scoreUsTender(tender: UsTenderForPursuit, company: CompanyProfileForPursuit): UsTenderFit {
  const tenderNaics = new Set(parseStringArray(tender.naicsCodesJson));
  const companyNaics = parseStringArray(company.naicsCodesJson);
  const naicsMatch = companyNaics.some((code) => tenderNaics.has(code));
  const text = `${tender.title} ${tender.description ?? ""}`.toLowerCase();
  const capabilityMatch = toLowerStrings(company.capabilitiesJson).some((capability) => capability.length > 2 && text.includes(capability));
  const required = getRequiredSetAside(tender.setAside);
  const statuses = new Set(toLowerStrings(company.socioEconomicJson));
  const eligibleForSetAside = required ? statuses.has(required.status) : null;
  const registrationReady = Boolean(company.uei?.trim());
  const score = Math.min(100,
    (naicsMatch ? 55 : 0) +
    (capabilityMatch ? 30 : 0) +
    (registrationReady ? 10 : 0) +
    (!required || eligibleForSetAside ? 5 : 0),
  );
  const reasons = [
    ...(naicsMatch ? ["Ihr NAICS-Code passt zu dieser Ausschreibung."] : ["Für Ihr Unternehmen ist kein genau passender NAICS-Code hinterlegt."]),
    ...(capabilityMatch ? ["Ihre angegebenen Leistungen kommen in den Anforderungen vor."] : []),
    ...(required && !eligibleForSetAside ? [`Diese Ausschreibung ist auf ${required.label} beschränkt. Wenn Sie die Voraussetzungen nicht erfüllen, prüfen Sie eine Zusammenarbeit als Unterauftragnehmer mit einem berechtigten Hauptauftragnehmer.`] : []),
    ...(!registrationReady ? ["In Ihrem Profil ist noch keine UEI hinterlegt. Für ein direktes Angebot an eine US-Bundesbehörde benötigen Sie eine Registrierung bei SAM.gov; Gespräche mit Hauptauftragnehmern können Sie bereits vorher beginnen."] : []),
  ];
  return { score, naicsMatch, capabilityMatch, eligibleForSetAside, requiredSetAside: required?.label ?? null, registrationReady, reasons };
}

export interface UsPursuitChecklistItem {
  id: string;
  label: string;
  status: "complete" | "action_required" | "not_applicable";
  detail: string;
}

export const buildUsPursuitChecklist = (tender: UsTenderForPursuit, company: CompanyProfileForPursuit | null): UsPursuitChecklistItem[] => {
  const required = getRequiredSetAside(tender.setAside);
  const hasUei = Boolean(company?.uei?.trim());
  const hasCage = Boolean(company?.cageCode?.trim());
  const hasCapabilities = parseStringArray(company?.capabilitiesJson).length > 0;
  const statuses = new Set(toLowerStrings(company?.socioEconomicJson));
  const setAsideMet = !required || statuses.has(required.status);

  return [
    {
      id: "uei",
      label: "Unique Entity ID (UEI) beantragen und SAM.gov-Registrierung abschließen",
      status: hasUei ? "complete" : "action_required",
      detail: hasUei ? "Die UEI ist in Ihrem Tenderhunter-Profil hinterlegt." : "Für ein direktes Angebot an eine US-Bundesbehörde benötigen Sie die UEI und eine Registrierung bei SAM.gov. Die Registrierung ist kostenlos.",
    },
    {
      id: "cage",
      label: "CAGE-Code bestätigen",
      status: hasCage ? "complete" : "action_required",
      detail: hasCage ? "Der CAGE-Code ist in Ihrem Tenderhunter-Profil hinterlegt." : "Bei US-Unternehmen wird der CAGE-Code in der Regel im Zuge der SAM-Registrierung zugeteilt.",
    },
    {
      id: "set-aside",
      label: required ? `Berechtigung für ${required.label} prüfen` : "Förderberechtigung prüfen",
      status: required ? (setAsideMet ? "complete" : "action_required") : "not_applicable",
      detail: required
        ? (setAsideMet ? "Der in Ihrem Profil hinterlegte Förderstatus erfüllt diese Voraussetzung." : "Geben Sie kein direktes Angebot ab, bevor Sie Ihre Berechtigung geprüft haben. Wenden Sie sich stattdessen an berechtigte Hauptauftragnehmer.")
        : "Die Quelldaten nennen keine einschränkende Förderkategorie.",
    },
    {
      id: "capability-statement",
      label: "Einseitiges Leistungsprofil vorbereiten",
      status: hasCapabilities ? "complete" : "action_required",
      detail: hasCapabilities ? "Stimmen Sie Ihr Leistungsprofil mit den hinterlegten Kompetenzen und NAICS-Codes auf diese Ausschreibung ab." : "Ergänzen Sie Ihre Leistungen und NAICS-Codes im Profil, bevor Sie Kontakt aufnehmen.",
    },
    {
      id: "review-solicitation",
      label: "Originalausschreibung und Anlagen prüfen",
      status: "action_required",
      detail: tender.deadlineAt ? `Prüfen Sie alle Vorgaben vor der Angebotsfrist am ${formatUsDateTime(tender.deadlineAt)}.` : "Die Quelle nennt keine Angebotsfrist. Klären Sie diese mit der zuständigen Vergabestelle.",
    },
    {
      id: "teaming",
      label: "Passende Hauptauftragnehmer für eine Zusammenarbeit ansprechen",
      status: "action_required",
      detail: "Nutzen Sie die folgenden vergleichbaren Zuschläge, um Hauptauftragnehmer zu finden, die in diesem NAICS-Bereich oder für diese Behörde bereits Aufträge erhalten haben.",
    },
  ];
};
