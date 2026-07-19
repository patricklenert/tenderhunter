// SEO: Generate keyword-rich URL slugs for tender detail pages.
// Used in /ausschreibung/[id]/[slug] URLs and internal links across the site.
// Improves long-tail keyword signals compared to numeric-only URLs like /ausschreibung/12345.

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss",
};

function toSlugPart(text: string): string {
  let slug = text;
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    slug = slug.replaceAll(from, to);
  }
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Generate a URL-safe slug from tender title and optional location.
 * Returns a hyphenated string like "gebaeudereinigung-verwaltungsgebaeude-muenchen".
 * Max ~80 chars to keep URLs reasonable.
 */
export function generateTenderSlug(title: string, location?: string): string {
  const titlePart = toSlugPart(title);
  const locationPart = location ? toSlugPart(location.split(",")[0]) : "";
  const parts = [titlePart, locationPart].filter(Boolean);
  return parts.join("-").slice(0, 80) || "ausschreibung";
}
