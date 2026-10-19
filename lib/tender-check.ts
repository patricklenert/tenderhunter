import { parseDeadlineDate } from "@/lib/date-utils";
import {
  buildDocumentAnalysis,
  type AnalyzedDocument,
  type DocumentAnalysis,
} from "@/lib/document-analysis";
import { isHtmlContentType } from "@/lib/document-identity";
import {
  isPdfFormBoilerplate,
  isPdfFormBoilerplateFragment,
  normalizePublicDisplayCandidate,
} from "@/lib/public-content-quality";

export type TenderCheckStatus = "complete" | "partial" | "unknown" | "blocked";
export type ChecklistCategory = "submit" | "proof" | "review";
export type ChecklistCertainty = "confirmed" | "uncertain" | "source_missing";
export type RiskSeverity = "important" | "check";
export type TenderEventType = "submission" | "questions" | "validity" | "site_visit" | "contract_start" | "contract_end";

export interface TenderCheckSource {
  type: "document" | "tender";
  documentId: number | null;
  filename: string | null;
  page: number | null;
  quote: string;
  available: boolean;
}

export interface TenderChecklistItem {
  key: string;
  category: ChecklistCategory;
  title: string;
  mandatory: boolean;
  certainty: ChecklistCertainty;
  source: TenderCheckSource | null;
}

export interface TenderRiskFlag {
  key: string;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  sources: TenderCheckSource[];
}

export interface TenderEvent {
  key: string;
  type: TenderEventType;
  title: string;
  startsAt: string;
  datePrecision: "date" | "minute";
  source: TenderCheckSource | null;
}

export interface TenderCheck {
  version: 1;
  status: TenderCheckStatus;
  coverage: {
    discovered: number;
    downloaded: number;
    parsed: number;
    failed: number;
    empty: number;
  };
  checklist: TenderChecklistItem[];
  risks: TenderRiskFlag[];
  events: TenderEvent[];
  nextEvent: TenderEvent | null;
  limitations: string[];
}

export interface TenderCheckDocument extends AnalyzedDocument {
  filename?: string | null;
}

export interface TenderCheckInput {
  tenderId: number;
  tenderDeadlineAt: Date | string | null;
  structured: unknown;
  rawText?: string | null;
  documents: TenderCheckDocument[];
  documentAnalysis?: DocumentAnalysis;
}

interface PageText {
  page: number | null;
  text: string;
}

interface DateFact {
  type: TenderEventType;
  date: Date;
  precision: "date" | "minute";
  source: TenderCheckSource;
}

interface NumericFact {
  type: "duration";
  value: string;
  source: TenderCheckSource;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

const normalizeKey = (value: string): string => value
  .toLocaleLowerCase("de-DE")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const titleText = (value: string): string => value
  .replace(/^[-*•\d.)\s]+/, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 320);

const checklistTitle = (value: string): string | null => {
  const title = titleText(value);
  const normalized = normalizePublicDisplayCandidate(title);
  if (normalized) return normalized;
  // A standalone form name is useful in a tender checklist, even though it is
  // too ambiguous as a public description candidate.
  return /^formblatt\s+\d+$/iu.test(title) && !isPdfFormBoilerplateFragment(title)
    ? title
    : null;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isUsableDocument = (document: TenderCheckDocument): boolean =>
  document.parseStatus === "parsed" &&
  !isHtmlContentType(document.contentType) &&
  typeof document.extractedText === "string" &&
  document.extractedText.trim().length >= 20 &&
  !isPdfFormBoilerplate(document.extractedText);

const pagesOf = (text: string): PageText[] => {
  const pages: PageText[] = [];
  const pagePattern = /\[Seite\s+(\d+)\]\s*([\s\S]*?)(?=\[Seite\s+\d+\]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = pagePattern.exec(text)) !== null) {
    pages.push({ page: Number(match[1]), text: match[2] });
  }
  return pages.length > 0 ? pages : [{ page: null, text }];
};

const quoteFromMatch = (text: string, index: number, length: number): string => {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + Math.max(length, 230));
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 420);
};

const sourceFromText = (
  document: TenderCheckDocument,
  pattern: RegExp,
  sourceType: "document" = "document",
): TenderCheckSource | null => {
  if (!isUsableDocument(document) || !document.extractedText) return null;
  for (const page of pagesOf(document.extractedText)) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(page.text)) !== null) {
      if (match.index === undefined) continue;
      const quote = quoteFromMatch(page.text, match.index, match[0].length);
      if (!isPdfFormBoilerplateFragment(quote)) {
        return {
          type: sourceType,
          documentId: document.id,
          filename: document.filename ?? null,
          page: page.page,
          quote,
          available: document.downloadStatus === "downloaded",
        };
      }
      if (match[0].length === 0) globalPattern.lastIndex += 1;
    }
  }
  return null;
};

const sourceFromEvidence = (
  evidence: DocumentAnalysis["evidence"][number] | undefined,
  documents: TenderCheckDocument[],
): TenderCheckSource | null => {
  if (
    !evidence
    || !Number.isInteger(evidence.documentId)
    || typeof evidence.quote !== "string"
    || !evidence.quote.trim()
    || isPdfFormBoilerplateFragment(evidence.quote)
  ) return null;
  const document = documents.find((candidate) => candidate.id === evidence.documentId);
  const normalizedQuote = evidence.quote.replace(/\s+/g, " ").trim();
  const normalizedDocumentText = document?.extractedText?.replace(/\s+/g, " ").trim() ?? "";
  if (
    !document
    || !isUsableDocument(document)
    || !normalizedQuote
    || !normalizedDocumentText.includes(normalizedQuote)
  ) return null;
  return {
    type: "document",
    documentId: evidence.documentId,
    filename: document?.filename ?? null,
    page: evidence.page,
    quote: evidence.quote,
    available: document?.downloadStatus === "downloaded",
  };
};

const tenderSource = (quote: string): TenderCheckSource => ({
  type: "tender",
  documentId: null,
  filename: null,
  page: null,
  quote,
  available: true,
});

const findDocumentSource = (
  title: string,
  category: ChecklistCategory,
  documents: TenderCheckDocument[],
  analysis: DocumentAnalysis,
): TenderCheckSource | null => {
  const normalizedTitle = normalizeKey(title);
  const titleTokens = normalizedTitle.split(" ").filter((token) => token.length >= 4);
  const categoryPattern = category === "submit"
    ? /mit dem Angebot|einzureichen|vorzulegen/i
    : category === "proof"
      ? /Nachweis|Referenz|Eignung|Eigenerklärung/i
      : /Anforderung|Mindestanforderung|Leistung/i;
  const matchingDocument = documents.find((document) => {
    if (!isUsableDocument(document) || !document.extractedText || titleTokens.length === 0) return false;
    const normalizedText = normalizeKey(document.extractedText);
    return titleTokens.filter((token) => normalizedText.includes(token)).length >= Math.min(2, titleTokens.length);
  });
  if (matchingDocument) {
    // Truncate before escaping; truncating an escaped pattern can leave a dangling `\\`.
    const escapedTitle = escapeRegExp(title.slice(0, 120));
    return sourceFromText(matchingDocument, new RegExp(escapedTitle, "i"))
      ?? sourceFromText(matchingDocument, categoryPattern);
  }

  for (const document of documents) {
    const source = sourceFromText(document, categoryPattern);
    if (source) return source;
  }

  const evidenceField = category === "submit" || category === "proof" ? "requirements" : "requirements";
  return sourceFromEvidence(analysis.evidence.find((evidence) => evidence.field === evidenceField), documents);
};

const structuredChecklist = (
  structured: unknown,
  documents: TenderCheckDocument[],
  analysis: DocumentAnalysis,
): TenderChecklistItem[] => {
  const record = asRecord(structured);
  const decisionRelevant = asRecord(record.decision_relevant);
  const procurement = asRecord(record.procurement);
  const seeds: Array<{ category: ChecklistCategory; mandatory: boolean; values: unknown }> = [
    { category: "submit", mandatory: true, values: decisionRelevant.mandatory_documents },
    { category: "proof", mandatory: true, values: procurement.participation_requirements },
    { category: "review", mandatory: false, values: decisionRelevant.requirements },
  ];
  const seen = new Set<string>();
  const items: TenderChecklistItem[] = [];

  for (const seed of seeds) {
    for (const rawTitle of stringList(seed.values)) {
      const title = checklistTitle(rawTitle);
      if (!title) continue;
      const normalized = normalizeKey(title);
      if (normalized.length < 6 || seen.has(`${seed.category}:${normalized}`)) continue;
      seen.add(`${seed.category}:${normalized}`);
      const source = findDocumentSource(title, seed.category, documents, analysis);
      items.push({
        key: `${seed.category}:${normalized}`,
        category: seed.category,
        title,
        mandatory: seed.mandatory,
        certainty: source ? "confirmed" : seed.mandatory ? "source_missing" : "uncertain",
        source,
      });
    }
  }

  return items;
};

const explicitDocumentChecklist = (
  documents: TenderCheckDocument[],
): TenderChecklistItem[] => {
  const items: TenderChecklistItem[] = [];
  const seen = new Set<string>();
  const segmentPattern = /(?:•|\n|(?:^|\s)-\s+|(?:^|\s)\d+\)\s+)\s*([^•\n]{8,700}?)(?=\s+-\s+|[•\n]|\s+\d+\)\s|$)/g;
  const requirementWords = /eigenerklär|nachweis|referenz|formblatt|bescheinigung|zertifikat|versicherung|tariftreue|datenschutz|geheimhaltung|subunternehmen|bietergemeinschaft|fachkunde|qualifiziert|eignung|bietererklärung/i;
  const requirementContext = /mit dem Angebot|mit Angebotsabgabe|einzureichen|vorzulegen|einzureichende|vorzulegende|Nachweis|Unterlagen|Eigenerklärungen|Referenzen|Eignung/i;

  for (const document of documents) {
    if (!isUsableDocument(document) || !document.extractedText) continue;
    for (const page of pagesOf(document.extractedText)) {
      segmentPattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = segmentPattern.exec(page.text)) !== null) {
        const candidate = titleText(match[1])
          .replace(/\s+(?:Es sind folgende|Vom Auftraggeber geforderte|Wirtschaftliche und finanzielle|Technische und berufliche|Vergabe unterlagen|Wesentliche Zahlungsbedingungen|Zusätzliche Angaben|Nachforderung)\b[\s\S]*$/i, "")
          .trim();
        const checkedCandidate = checklistTitle(candidate);
        const context = page.text.slice(Math.max(0, match.index - 280), match.index);
        if (!checkedCandidate || checkedCandidate.length < 10 || checkedCandidate.length > 320 || !requirementContext.test(context) || !requirementWords.test(checkedCandidate)) continue;
        const quote = quoteFromMatch(page.text, match.index, match[0].length);
        if (isPdfFormBoilerplateFragment(quote)) continue;
        const normalized = normalizeKey(checkedCandidate);
        if (normalized.length < 10 || seen.has(normalized)) continue;
        seen.add(normalized);
        const category: ChecklistCategory = /nachweis|referenz|formblatt|bescheinigung|zertifikat|versicherung|eigenerklär|eignung|fachkunde|bietererklärung|qualifiziert/i.test(checkedCandidate)
          ? "proof"
          : "submit";
        items.push({
          key: `${category}:${normalized}`,
          category,
          title: checkedCandidate,
          mandatory: true,
          certainty: "confirmed",
          source: {
            type: "document",
            documentId: document.id,
            filename: document.filename ?? null,
            page: page.page,
            quote,
            available: document.downloadStatus === "downloaded",
          },
        });
      }
    }
  }
  return items;
};

const mergeChecklistItems = (
  structuredItems: TenderChecklistItem[],
  documentItems: TenderChecklistItem[],
): TenderChecklistItem[] => {
  const items = [...structuredItems];
  const seen = new Set(structuredItems.map((item) => normalizeKey(item.title)));
  for (const item of documentItems) {
    if (seen.has(normalizeKey(item.title))) continue;
    seen.add(normalizeKey(item.title));
    items.push(item);
  }
  return items;
};

const dateTypeFromContext = (context: string): TenderEventType | null => {
  const lowerContext = context.toLocaleLowerCase("de-DE");
  const candidates: Array<{ type: TenderEventType; keywords: string[] }> = [
    { type: "questions", keywords: ["rückfragen", "rueckfragen", "aufklärungsfragen", "aufklaerungsfragen", "fragenfrist"] },
    { type: "validity", keywords: ["bindefrist", "gültigkeit", "gueltigkeit", "gebunden"] },
    { type: "site_visit", keywords: ["ortstermin", "besichtigung", "besichtigungstermin"] },
    { type: "contract_start", keywords: ["vertragsbeginn", "leistungsbeginn", "beginn der leistung", "ausführungsfristen", "ausfuehrungsfristen", "ausführungsfrist", "ausfuehrungsfrist"] },
    { type: "contract_end", keywords: ["fertigstellung", "auslieferung", "ende der leistung", "vollendung"] },
    { type: "submission", keywords: ["abgabefrist", "angebotsfrist", "schlusstermin", "eingang der angebote", "angebote sind einzureichen", "ablauf der angebotsfrist"] },
  ];
  let selected: { type: TenderEventType; index: number } | null = null;
  for (const candidate of candidates) {
    for (const keyword of candidate.keywords) {
      const index = lowerContext.lastIndexOf(keyword);
      if (index > (selected?.index ?? -1)) selected = { type: candidate.type, index };
    }
  }
  return selected?.type ?? null;
};

const extractDateFacts = (documents: TenderCheckDocument[]): DateFact[] => {
  const facts: DateFact[] = [];
  const datePattern = /\b\d{1,2}\.\d{1,2}\.\d{4}(?:\s*(?:,|um)?\s*\d{1,2}:\d{2})?\b|\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?\b/g;

  for (const document of documents) {
    if (!isUsableDocument(document) || !document.extractedText) continue;
    for (const page of pagesOf(document.extractedText)) {
      let match: RegExpExecArray | null;
      while ((match = datePattern.exec(page.text)) !== null) {
        const contextBefore = page.text.slice(Math.max(0, match.index - 220), match.index);
        const contextAfter = page.text.slice(match.index, Math.min(page.text.length, match.index + 80));
        const context = `${contextBefore} ${contextAfter}`;
        if (/generierungsdatum|cosinex|\bBMS\b|\bVMP\b|©\s*20\d{2}/i.test(contextAfter)) continue;
        if (!/abgabe|angebot|einreich|teilnahme|schlusstermin|angebotsfrist|rückfragen|rueckfragen|fragen|bindefrist|gültigkeit|gueltigkeit|ortstermin|besichtigung|vertragsbeginn|leistungsbeginn|ausführungsfristen|ausfuehrungsfristen|fertigstellung|auslieferung|ende\s+der\s+leistung|vollendung/i.test(context)) continue;
        const date = parseDeadlineDate(match[0].replace(/\bum\b/gi, ","));
        if (!date) continue;
        const type = dateTypeFromContext(contextBefore);
        if (!type) continue;
        const quote = quoteFromMatch(page.text, match.index, match[0].length);
        if (isPdfFormBoilerplateFragment(quote)) continue;
        facts.push({
          type,
          date,
          precision: /:\d{2}/.test(match[0]) ? "minute" : "date",
          source: {
            type: "document",
            documentId: document.id,
            filename: document.filename ?? null,
            page: page.page,
            quote,
            available: document.downloadStatus === "downloaded",
          },
        });
      }
    }
  }

  return facts;
};

const extractNumericFacts = (documents: TenderCheckDocument[]): NumericFact[] => {
  const facts: NumericFact[] = [];
  const durationPattern = /(?:vertragslaufzeit|laufzeit|leistungszeitraum|ausführungsfrist|ausfuehrungsfrist)[^\n.]{0,100}?\b(\d{1,3})\s*(tage?|wochen?|monate?|jahre?)\b/gi;

  for (const document of documents) {
    if (!isUsableDocument(document) || !document.extractedText) continue;
    for (const page of pagesOf(document.extractedText)) {
      let match: RegExpExecArray | null;
      while ((match = durationPattern.exec(page.text)) !== null) {
        const quote = quoteFromMatch(page.text, match.index ?? 0, match[0].length);
        if (isPdfFormBoilerplateFragment(quote)) continue;
        facts.push({
          type: "duration",
          value: `${match[1]} ${match[2].toLocaleLowerCase("de-DE")}`,
          source: {
            type: "document",
            documentId: document.id,
            filename: document.filename ?? null,
            page: page.page,
            quote,
            available: document.downloadStatus === "downloaded",
          },
        });
      }
    }
  }
  return facts;
};

const datesDiffer = (left: Date, right: Date): boolean => {
  const leftDay = left.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const rightDay = right.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  if (leftDay !== rightDay) return true;
  return Math.abs(left.getTime() - right.getTime()) > 5 * 60 * 1000;
};

const numericValue = (value: string): string => normalizeKey(value).replace(/\s+/g, " ");

const buildRisks = (
  tenderDeadlineAt: Date | string | null,
  dateFacts: DateFact[],
  numericFacts: NumericFact[],
): TenderRiskFlag[] => {
  const risks: TenderRiskFlag[] = [];
  const deadline = parseDeadlineDate(tenderDeadlineAt);
  const tenderDeadlineSource = tenderSource("Abgabefrist aus den Ausschreibungsdaten.");
  const submissionFacts = dateFacts.filter((fact) => fact.type === "submission");

  if (deadline) {
    const conflictingDocument = submissionFacts.find((fact) => datesDiffer(deadline, fact.date));
    if (conflictingDocument) {
      risks.push({
        key: `deadline:tender:${deadline.toISOString()}:${conflictingDocument.date.toISOString()}`,
        severity: "important",
        title: "Abgabefristen unterscheiden sich",
        explanation: `Die Ausschreibungsdaten und ein Dokument nennen unterschiedliche Abgabefristen (${deadline.toLocaleDateString("de-DE")} und ${conflictingDocument.date.toLocaleDateString("de-DE")}).`,
        sources: [tenderDeadlineSource, conflictingDocument.source],
      });
    }
  }

  for (let index = 0; index < submissionFacts.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < submissionFacts.length; otherIndex += 1) {
      const left = submissionFacts[index];
      const right = submissionFacts[otherIndex];
      if (!datesDiffer(left.date, right.date)) continue;
      risks.push({
        key: `deadline:documents:${left.source.documentId}:${right.source.documentId}`,
        severity: "important",
        title: "Abgabefristen in den Dokumenten prüfen",
        explanation: `Zwei Dokumente nennen unterschiedliche Abgabefristen (${left.date.toLocaleDateString("de-DE")} und ${right.date.toLocaleDateString("de-DE")}).`,
        sources: [left.source, right.source],
      });
    }
  }

  for (const type of ["duration"] as const) {
    const values = numericFacts.filter((fact) => fact.type === type);
    const distinct = [...new Set(values.map((fact) => numericValue(fact.value)))];
    if (distinct.length < 2) continue;
    const left = values.find((fact) => numericValue(fact.value) === distinct[0]);
    const right = values.find((fact) => numericValue(fact.value) === distinct[1]);
    if (!left || !right) continue;
    risks.push({
      key: `${type}:${distinct.slice(0, 2).join(":")}`,
      severity: "check",
      title: "Vertragsdauer prüfen",
      explanation: `Die Unterlagen nennen unterschiedliche Laufzeiten (${left.value} und ${right.value}).`,
      sources: [left.source, right.source],
    });
  }

  const seen = new Set<string>();
  return risks
    .filter((risk) => {
      if (seen.has(risk.key)) return false;
      seen.add(risk.key);
      return risk.sources.length > 0;
    })
    .slice(0, 3);
};

const eventTitle = (type: TenderEventType): string => {
  switch (type) {
    case "questions": return "Frist für Rückfragen";
    case "validity": return "Bindefrist / Gültigkeit";
    case "site_visit": return "Ortstermin / Besichtigung";
    case "contract_start": return "Vertrags- oder Leistungsbeginn";
    case "contract_end": return "Fertigstellung / Leistungsende";
    default: return "Abgabe des Angebots";
  }
};

const buildEvents = (tenderDeadlineAt: Date | string | null, dateFacts: DateFact[]): TenderEvent[] => {
  const events: TenderEvent[] = [];
  const deadline = parseDeadlineDate(tenderDeadlineAt);
  if (deadline) {
    events.push({
      key: "submission:tender",
      type: "submission",
      title: eventTitle("submission"),
      startsAt: deadline.toISOString(),
      datePrecision: "minute",
      source: tenderSource("Abgabefrist aus den Ausschreibungsdaten."),
    });
  }

  for (const fact of dateFacts) {
    const alreadyKnown = events.some((event) => event.type === fact.type && Math.abs(new Date(event.startsAt).getTime() - fact.date.getTime()) <= 5 * 60 * 1000);
    if (alreadyKnown) continue;
    events.push({
      key: `${fact.type}:${fact.date.toISOString()}:${fact.source.documentId}`,
      type: fact.type,
      title: eventTitle(fact.type),
      startsAt: fact.date.toISOString(),
      datePrecision: fact.precision,
      source: fact.source,
    });
  }

  return events.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
};

export const buildTenderCheck = (input: TenderCheckInput): TenderCheck => {
  const analysis = input.documentAnalysis ?? buildDocumentAnalysis(input.documents);
  const checklist = mergeChecklistItems(
    structuredChecklist(input.structured, input.documents, analysis),
    explicitDocumentChecklist(input.documents),
  );
  const dateFacts = extractDateFacts(input.documents);
  const numericFacts = extractNumericFacts(input.documents);
  const events = buildEvents(input.tenderDeadlineAt, dateFacts);
  const risks = buildRisks(input.tenderDeadlineAt, dateFacts, numericFacts);
  const futureEvents = events.filter((event) => new Date(event.startsAt).getTime() >= Date.now());
  const limitations: string[] = [];
  if (analysis.coverage.failed > 0 || analysis.coverage.empty > 0) {
    limitations.push("Nicht alle entdeckten Unterlagen konnten gelesen werden.");
  }
  if (analysis.coverageStatus === "unknown") {
    limitations.push("Es liegen noch keine prüfbaren Dokumente vor.");
  }

  return {
    version: 1,
    status: analysis.coverageStatus,
    coverage: {
      discovered: analysis.coverage.discovered,
      downloaded: analysis.coverage.downloaded,
      parsed: analysis.coverage.parsed,
      failed: analysis.coverage.failed,
      empty: analysis.coverage.empty,
    },
    checklist,
    risks,
    events,
    nextEvent: futureEvents[0] ?? events[0] ?? null,
    limitations,
  };
};
