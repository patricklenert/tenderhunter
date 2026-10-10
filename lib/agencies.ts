import { normalizePublicClient } from "@/lib/public-content-quality";

// SEO: Agency/Auftraggeber slug normalization for /auftraggeber/[slug] landing pages.
// Normalizes free-text client names into URL-safe slugs for consistent matching.

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};

function replaceUmlauts(str: string): string {
  return str.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch] ?? ch);
}

/**
 * Normalize a client/agency name into a URL-safe slug.
 * Examples:
 *   "Stadt München" → "stadt-muenchen"
 *   "Bundesministerium für Verkehr" → "bundesministerium-fuer-verkehr"
 *   "Landeshauptstadt München" → "landeshauptstadt-muenchen"
 */
export function normalizeAgencySlug(client: string): string {
  return replaceUmlauts(client)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/**
 * Check if a client string normalizes to a given slug.
 * Used for matching tenders to agency pages without a DB column.
 */
export function clientMatchesSlug(client: string, slug: string): boolean {
  return normalizeAgencySlug(client) === slug;
}

const AGENCY_ARTIFACT_MARKERS = [
  "nicht ermittelbar",
  "nicht verfuegbar",
  "nicht verfügbar",
  "nicht einsehbar",
  "nicht erkennbar",
  "cookie",
  "zugriff",
  "freischalten",
  "paywall",
  "e vergabe",
  "evergabe",
  "vergabeportal",
  "vergabeplattform",
  "postanschrift",
  "bekanntmachung",
  "bezeichnung",
  "angaben zum auftraggeber",
  "name und adresse",
];

/** Exclude scraped field labels and placeholders from public agency pages. */
export function isIndexableAgencyName(value: string | null | undefined): value is string {
  const name = value?.trim() ?? "";
  if (name.length < 5 || !/[\p{L}]/u.test(name)) return false;
  const normalized = name.toLocaleLowerCase("de-DE").replace(/[-–—]/g, " ");
  return !/^(?:client|auftraggeber|vergabestelle|ausschreibungsstelle|n\/a|na|unknown|unbekannt|none|null|-)\s*:?[\s-]*$/iu.test(name)
    && !AGENCY_ARTIFACT_MARKERS.some((marker) => normalized.includes(marker));
}

/** Apply the same public-content filtering before emitting or resolving an agency URL. */
export function getIndexableAgency(value: unknown): { name: string; slug: string } | null {
  const name = normalizePublicClient(value);
  if (!isIndexableAgencyName(name)) return null;

  const slug = normalizeAgencySlug(name);
  return slug.length >= 3 ? { name, slug } : null;
}
