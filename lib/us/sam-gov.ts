import { normalizeUsDate, type UsContact, type UsExtractedTender } from "@/lib/us/types";
import { settings } from "@/lib/config";

const SAM_SEARCH_URL = "https://api.sam.gov/prod/opportunities/v2/search";
const SAM_PAGE_SIZE = 1_000;

type SamRecord = Record<string, unknown>;

const asString = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

const asLocationPart = (value: unknown, preferCode = false): string | null => {
  const direct = asString(value);
  if (direct) return direct;
  if (!value || typeof value !== "object") return null;
  const row = value as SamRecord;
  const first = preferCode ? asString(row.code) : asString(row.name);
  const fallback = preferCode ? asString(row.name) : asString(row.code);
  return first ?? fallback;
};

const toContacts = (value: unknown): UsContact[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((contact) => {
    if (!contact || typeof contact !== "object") return [];
    const row = contact as SamRecord;
    const name = [asString(row.fullName), asString(row.firstName), asString(row.lastName)].filter(Boolean).join(" ").trim() || null;
    const email = asString(row.email);
    const phone = asString(row.phone);
    return name || email || phone ? [{ ...(name ? { name } : {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}) }] : [];
  });
};

const toLocation = (value: unknown): { location: string | null; state: string | null } => {
  if (!value || typeof value !== "object") return { location: null, state: null };
  const row = value as SamRecord;
  const city = asLocationPart(row.city);
  const state = asLocationPart(row.state, true);
  const zip = asLocationPart(row.zip);
  return { location: [city, state, zip].filter(Boolean).join(", ") || null, state };
};

const toAttachments = (value: unknown): Array<{ name: string; url: string }> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object") return [];
    const row = attachment as SamRecord;
    const url = asString(row.url) ?? asString(row.link);
    if (!url) return [];
    return [{ name: asString(row.name) ?? asString(row.fileName) ?? "Attachment", url }];
  });
};

const mapSamRecord = (record: SamRecord): UsExtractedTender | null => {
  const noticeId = asString(record.noticeId);
  const title = asString(record.title);
  if (!noticeId || !title) return null;

  const description = asString(record.description) ?? asString(record.additionalInfoLink) ?? "";
  const location = toLocation(record.placeOfPerformance);
  const naicsCode = asString(record.naicsCode);
  const classificationCode = asString(record.classificationCode);
  const uiLink = asString(record.uiLink) ?? `https://sam.gov/opp/${noticeId}/view`;

  return {
    source: "sam_gov",
    sourceKey: "sam_gov",
    url: uiLink,
    externalId: noticeId,
    title,
    description,
    buyer: asString(record.fullParentPathName) ?? asString(record.departmentIndAgency),
    location: location.location,
    state: location.state,
    solicitationNumber: asString(record.solicitationNumber),
    naicsCodes: naicsCode ? [naicsCode] : [],
    pscCodes: classificationCode ? [classificationCode] : [],
    setAside: asString(record.typeOfSetAsideDescription) ?? asString(record.typeOfSetAside),
    contractType: asString(record.type) ?? asString(record.baseType),
    deadlineAt: normalizeUsDate(record.responseDeadLine),
    contacts: toContacts(record.pointOfContact),
    attachments: toAttachments(record.resourceLinks),
    metadata: {
      posted_at: asString(record.postedDate),
      archive_date: asString(record.archiveDate),
      notice_type: asString(record.type),
      base_type: asString(record.baseType),
      active: record.active,
      sam_notice_id: noticeId,
    },
  };
};

export async function fetchSamOpportunities(): Promise<UsExtractedTender[]> {
  const apiKey = process.env.SAM_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[us/sam.gov] SAM_API_KEY is not configured; skipping SAM.gov.");
    return [];
  }

  const formatSamDate = (date: Date): string => `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
  const today = new Date();
  const postedFrom = formatSamDate(new Date(today.getTime() - settings.samLookbackDays * 24 * 60 * 60 * 1000));
  const postedTo = formatSamDate(today);
  const pageSize = Math.min(settings.samMaxRecords, SAM_PAGE_SIZE);
  const tenders: UsExtractedTender[] = [];

  for (let offset = 0; offset < settings.samMaxRecords; offset += pageSize) {
    const url = new URL(SAM_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("postedFrom", postedFrom);
    url.searchParams.set("postedTo", postedTo);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("ptype", "o,k,p,r,s");
    if (settings.samSetAside) url.searchParams.set("typeOfSetAside", settings.samSetAside);

    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`SAM.gov search failed with HTTP ${response.status}`);
    const payload = await response.json() as { opportunitiesData?: unknown[]; totalRecords?: number };
    const rows = Array.isArray(payload.opportunitiesData) ? payload.opportunitiesData : [];
    tenders.push(...rows.flatMap((row) => row && typeof row === "object" ? [mapSamRecord(row as SamRecord)].filter((item): item is UsExtractedTender => item !== null) : []));

    if (rows.length < pageSize || (typeof payload.totalRecords === "number" && offset + rows.length >= payload.totalRecords)) break;
  }

  return tenders;
}
