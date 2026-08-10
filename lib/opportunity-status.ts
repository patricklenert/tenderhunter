export interface OpportunityStatus {
  isAwarded: boolean;
  reason: string;
}

type AwardSignal = {
  label: string;
};

const HTML_ENTITY_REPLACEMENTS: Readonly<Record<string, string>> = {
  "&auml;": "\u00e4",
  "&ouml;": "\u00f6",
  "&uuml;": "\u00fc",
  "&szlig;": "\u00df",
};

const DEFINITIVE_AWARD_SIGNALS: ReadonlyArray<AwardSignal & { pattern: RegExp }> = [
  {
    pattern: /\bbekanntmachung\s+(?:ueber\s+)?vergeben(?:er|en|e)?\s+auftrae?ge\b/,
    label: "Bekanntmachung vergebener Auftraege",
  },
  {
    pattern: /\bex\s+post\s+bekanntmachung\b/,
    label: "Ex-post-Bekanntmachung",
  },
  {
    pattern: /\bauftrag\s+(?:wurde|ist)\s+(?:bereits\s+)?vergeben\b/,
    label: "Auftrag wurde bereits vergeben",
  },
  {
    pattern: /\bauftrag\s+(?:(?:wurde|ist)\s+)?(?:bereits\s+)?vergeben\s+an\b/,
    label: "Auftrag vergeben an",
  },
];

const decodeGermanHtmlEntities = (value: string): string =>
  value.replace(/&(auml|ouml|uuml|szlig);/gi, (entity) => HTML_ENTITY_REPLACEMENTS[entity.toLowerCase()] ?? entity);

const normalizeText = (value: string | null | undefined): string =>
  decodeGermanHtmlEntities(value ?? "")
    .replace(/\u00c4/g, "Ae")
    .replace(/\u00d6/g, "Oe")
    .replace(/\u00dc/g, "Ue")
    .replace(/\u00df/g, "ss")
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findAwardedZuschlag = (text: string): AwardSignal | null => {
  const pattern = /\bzuschlag\s+(?:wurde\s+)?erteilt\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const followingText = text.slice(match.index + match[0].length);
    if (!/^\s+(?:wird|werden|der\s+auftraggeber|die\s+vergabestelle)\b/.test(followingText)) {
      return { label: "Zuschlag erteilt" };
    }
  }

  return null;
};

const findAwardSignal = (text: string): AwardSignal | null => {
  for (const signal of DEFINITIVE_AWARD_SIGNALS) {
    if (signal.pattern.test(text)) return signal;
  }

  return findAwardedZuschlag(text);
};

/**
 * Classifies whether a public-procurement notice describes an already awarded contract.
 */
export const classifyOpportunityStatus = (
  title: string | null | undefined,
  rawText: string | null | undefined,
): OpportunityStatus => {
  const sources = [
    ["Titel", normalizeText(title)],
    ["Inhalt", normalizeText(rawText)],
  ] as const;

  for (const [source, text] of sources) {
    const signal = findAwardSignal(text);
    if (signal) {
      return {
        isAwarded: true,
        reason: `Bereits vergebener Auftrag erkannt (${signal.label} im ${source}).`,
      };
    }
  }

  return {
    isAwarded: false,
    reason: "Kein belastbarer Hinweis auf eine bereits erfolgte Vergabe erkannt.",
  };
};
