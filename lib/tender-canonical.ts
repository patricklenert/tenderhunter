import { generateTenderSlug } from "@/lib/tender-slug";

export function getCanonicalTenderSlug(slug: string | null, title: string | null, metadataJson: unknown): string {
  if (slug) return slug;
  const metadata = typeof metadataJson === "object" && metadataJson !== null
    ? metadataJson as Record<string, unknown>
    : {};
  const location = typeof metadata.location === "string" ? metadata.location : "";
  return generateTenderSlug(title ?? "", location);
}
