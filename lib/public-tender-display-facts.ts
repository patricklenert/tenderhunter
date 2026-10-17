import { formatDeadlineDE, parseDeadlineDate } from "@/lib/date-utils";
import {
  pickValidatedPublicCandidate,
  pickValidatedPublicClient,
  pickValidatedPublicLocationForTender,
  pickValidatedPublicProcedure,
} from "@/lib/public-content-quality";
import { extractPublicPortalFacts } from "@/lib/public-tender-scraper";
import type { StructuredFallbackFacts } from "@/lib/structurer";
import type { TenderMeta } from "@/lib/tender-meta";

type PublicMetaDisplayFields = Pick<TenderMeta, "client" | "description" | "location" | "procedure" | "subject">;

export interface PublicTenderDisplayFacts {
  fallbackFacts: StructuredFallbackFacts;
  deadlineAt: Date | null;
}

export const resolvePublicTenderDeadline = (...candidates: unknown[]): Date | null => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string" && !(candidate instanceof Date)) continue;
    const deadlineAt = parseDeadlineDate(candidate);
    if (deadlineAt) return deadlineAt;
  }
  return null;
};

/** Resolve validated portal and metadata fallbacks identically for public projections. */
export const resolvePublicTenderDisplayFacts = (input: {
  title: string | null | undefined;
  metadata: PublicMetaDisplayFields;
  deadlineAt?: Date | string | null;
  procedureType?: unknown;
  hasUsableRawText?: boolean;
}): PublicTenderDisplayFacts => {
  const portalFacts = extractPublicPortalFacts(input.metadata.description);
  const buyer = pickValidatedPublicClient(portalFacts.client, input.metadata.client);
  // The persisted deadline remains canonical; validated portal text is a
  // fallback for rows where no reliable timestamp was stored.
  const deadlineAt = resolvePublicTenderDeadline(input.deadlineAt, portalFacts.deadline);
  const location = pickValidatedPublicLocationForTender(
    input.title,
    buyer,
    portalFacts.location,
    input.metadata.location,
  );

  return {
    deadlineAt,
    fallbackFacts: {
      buyer: buyer || null,
      procedure: pickValidatedPublicProcedure(
        portalFacts.procedure,
        input.metadata.procedure,
        input.hasUsableRawText ? input.procedureType : null,
      ) || null,
      deadline: deadlineAt ? formatDeadlineDE(deadlineAt) : null,
      location: location || null,
      summary: pickValidatedPublicCandidate(input.metadata.description) || null,
      scope: pickValidatedPublicCandidate(portalFacts.subject, input.metadata.subject) || null,
    },
  };
};
