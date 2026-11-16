import { projectPublicTenderRecord } from "@/lib/public-content-quality";

interface TenderDisplayFields {
  id: number;
  title: string;
  client: string;
  location: string;
  description: string;
}

export const syncPublicTenderDisplay = <Tender extends TenderDisplayFields>(
  tenders: Tender[],
  tenderId: number,
  detail: Record<string, unknown>,
): Tender[] => {
  if (detail.id != null && Number(detail.id) !== tenderId) return tenders;

  const tender = tenders.find((item) => item.id === tenderId);
  if (!tender) return tenders;

  const display = projectPublicTenderRecord({
    title: detail.title,
    structured: {
      client: detail.client,
      location: detail.location,
      summary: [detail.summary, detail.description],
      descriptionMarkdown: detail.descriptionMarkdown,
    },
    metadata: {
      title: tender.title,
      client: tender.client,
      location: tender.location,
      description: tender.description,
    },
  });

  return tenders.map((item) => item.id === tenderId
    ? {
      ...item,
      title: display.title ?? item.title,
      client: display.client ?? item.client,
      location: display.location ?? item.location,
      description: display.description ?? item.description,
    }
    : item);
};
