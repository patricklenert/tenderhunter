import { generateTenderSlug } from "@/lib/tender-slug";
import { pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";

export function isCanonicalTenderId(id: string, numericId: number): boolean {
  return Number.isSafeInteger(numericId) && id === String(numericId);
}

export function getCanonicalTenderSlug(
  slug: string | null,
  title: string | null,
  metadataJson: unknown,
  structuredJson?: unknown,
): string {
  if (slug) return slug;
  const metadata = typeof metadataJson === "object" && metadataJson !== null
    ? metadataJson as Record<string, unknown>
    : {};
  const structured = typeof structuredJson === "object" && structuredJson !== null
    ? structuredJson as Record<string, unknown>
    : {};
  const hardFacts = typeof structured.hard_facts === "object" && structured.hard_facts !== null
    ? structured.hard_facts as Record<string, unknown>
    : {};
  const location = pickValidatedPublicLocationForTender(
    title,
    metadata.client,
    metadata.location,
    hardFacts.location,
  );
  return generateTenderSlug(title ?? "", location);
}
