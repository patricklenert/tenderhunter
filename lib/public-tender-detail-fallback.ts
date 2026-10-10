import { pickCanonicalPublicDescriptionMarkdown, projectPublicTenderRecord } from "@/lib/public-content-quality";
import { normalizeStructured, type StructuredFallbackFacts, type StructuredData } from "@/lib/structurer";
import { readPublicTenderMeta } from "@/lib/tender-meta";

interface PublicTenderDetailFallbackInput {
  title: string | null;
  metadataJson: unknown;
  staleStructuredJson?: unknown;
  source?: string;
  sourceUrl?: string | null;
  fallbackFacts: StructuredFallbackFacts;
  summaryFallbacks?: readonly unknown[];
  descriptionMarkdownFallbacks?: readonly unknown[];
  accessLimited?: boolean;
  accessLimitedDescriptionMarkdown?: unknown;
}

export const projectPublicTenderDetailFallback = (input: PublicTenderDetailFallbackInput): {
  structured: StructuredData;
  display: ReturnType<typeof projectPublicTenderRecord>;
} => {
  const title = input.title ?? "";
  const tenderMeta = readPublicTenderMeta(input.metadataJson, {
    title,
    source: input.source,
    sourceUrl: input.sourceUrl,
  });
  const metadataStructured = normalizeStructured(input.metadataJson, title, input.fallbackFacts);
  const staleStructured = input.staleStructuredJson === undefined
    ? null
    : normalizeStructured(input.staleStructuredJson, title, input.fallbackFacts);
  const structured = staleStructured ?? metadataStructured;
  const display = projectPublicTenderRecord({
    title: input.title,
    metadata: input.metadataJson,
    structured,
    clientFallbacks: [tenderMeta.client, input.fallbackFacts.buyer],
    locationFallbacks: [input.fallbackFacts.location, tenderMeta.location],
    summaryFallbacks: [
      ...(input.summaryFallbacks ?? []),
      tenderMeta.description,
    ],
    descriptionMarkdownFallbacks: [
      metadataStructured.descriptionMarkdown,
      tenderMeta.descriptionMarkdown,
      ...(input.descriptionMarkdownFallbacks ?? []),
    ],
  });
  const descriptionMarkdown = pickCanonicalPublicDescriptionMarkdown(
    ...(input.accessLimited ? [input.accessLimitedDescriptionMarkdown] : []),
    display.descriptionMarkdown,
    tenderMeta.descriptionMarkdown,
    ...(input.descriptionMarkdownFallbacks ?? []),
  );

  return {
    structured,
    display: { ...display, descriptionMarkdown },
  };
};
