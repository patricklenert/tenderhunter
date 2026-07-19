const UMLAUT_MAP: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss",
};

export function generateSlug(name: string, fallback?: string): string {
  let slug = name;
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    slug = slug.replaceAll(from, to);
  }
  const result = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (result.length > 0) return result;
  if (fallback) return generateSlug(fallback);
  return `company-${Date.now()}`;
}
