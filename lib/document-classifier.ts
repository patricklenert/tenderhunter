import type { DocumentRole } from "./schema";

export type RoleSource = "filename" | "url" | "linktext" | "content";

export interface ClassifyInput {
  filename?: string | null;
  url?: string | null;
  linkText?: string | null;
  textSample?: string | null;
}

export interface ClassifyResult {
  role: DocumentRole;
  confidence: number;
  source: RoleSource;
}

const ROLE_KEYWORDS: Array<{ role: DocumentRole; patterns: RegExp[] }> = [
  {
    role: "leistungsbeschreibung",
    patterns: [
      /leistungsbeschreibung/i,
      /\bleistungsbeschreibungen\b/i,
      /\bleistungsumfang\b/i,
      /\bgegenstand\s+der\s+ausschreibung\b/i,
      /\bgegenstand\s+des\s+auftrags\b/i,
      /\bauftragsgegenstand\b/i,
      /\bart\s+und\s+umfang\b/i,
      /\bbeschreibung\s+der\s+leistung\b/i,
    ],
  },
  {
    role: "leistungsverzeichnis",
    patterns: [
      /leistungsverzeichnis/i,
      /\blv\b/i,
      /\bstundenleistung/i,
      /\bpositionen\s/i,
      /\bmenge\b.*\teinheit\b/i,
    ],
  },
  {
    role: "bekanntmachung",
    patterns: [
      /bekanntmachung/i,
      /\bausschreibung\b/i,
      /\bvergabebericht/i,
      /\bbekanntmachungs?id\b/i,
      /\bnotice\b/i,
    ],
  },
  {
    role: "eignung",
    patterns: [
      /\beignung/i,
      /\beignungskriteri/i,
      /\bteilnahmebeding/i,
      /\bmindestanforder/i,
      /\bfachkunde/i,
      /\bleistungsfaehigkeit/i,
      /\breferenz/i,
      /\bpraekvalifik/i,
    ],
  },
  {
    role: "zuschlagskriterien",
    patterns: [
      /zuschlagskriteri/i,
      /\bzuschlag\b/i,
      /\bbewertung/i,
      /\bgewichtung/i,
      /\bangebotsbewert/i,
    ],
  },
  {
    role: "vertragsbedingungen",
    patterns: [
      /vertragsbeding/i,
      /\bvertragsentwurf/i,
      /\blieferbeding/i,
      /\bnutzungsbeding/i,
      /\bvertragsmuster/i,
    ],
  },
  {
    role: "formblatt",
    patterns: [
      /formblatt/i,
      /\bvordruck/i,
      /\berklaerung\b/i,
      /\bselbsterklaer/i,
      /\bmustervertrag/i,
    ],
  },
  {
    role: "nachtrag",
    patterns: [
      /\bnachtrag/i,
      /\baddendum/i,
      /\baenderungsmitteil/i,
      /\bfaq\b/i,
      /\brueckfrage/i,
    ],
  },
  {
    role: "anlage",
    patterns: [
      /\banlage\b/i,
      /\bplan\b/i,
      /\bskizze/i,
      /\bzeichnung/i,
      /\battachment/i,
    ],
  },
];

const classifyByPatterns = (
  text: string,
  patterns: RegExp[],
): boolean => patterns.some((p) => p.test(text));

const safeLower = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().replace(/[_\-./]+/g, " ");

export const classifyDocumentRole = (input: ClassifyInput): ClassifyResult => {
  const filename = safeLower(input.filename);
  const url = safeLower(input.url);
  const linkText = safeLower(input.linkText);
  const textSample = safeLower(input.textSample).slice(0, 3000);

  for (const { role, patterns } of ROLE_KEYWORDS) {
    if (filename && classifyByPatterns(filename, patterns)) {
      return { role, confidence: 0.85, source: "filename" };
    }
  }
  for (const { role, patterns } of ROLE_KEYWORDS) {
    if (url && classifyByPatterns(url, patterns)) {
      return { role, confidence: 0.7, source: "url" };
    }
  }
  for (const { role, patterns } of ROLE_KEYWORDS) {
    if (linkText && classifyByPatterns(linkText, patterns)) {
      return { role, confidence: 0.75, source: "linktext" };
    }
  }
  for (const { role, patterns } of ROLE_KEYWORDS) {
    if (textSample && classifyByPatterns(textSample, patterns)) {
      return { role, confidence: 0.6, source: "content" };
    }
  }

  return { role: "other", confidence: 0, source: "content" };
};

export const ROLE_PRIORITY: Record<string, number> = {
  leistungsbeschreibung: 1,
  leistungsverzeichnis: 2,
  bekanntmachung: 3,
  zuschlagskriterien: 4,
  eignung: 5,
  vertragsbedingungen: 6,
  formblatt: 7,
  nachtrag: 8,
  anlage: 9,
  other: 10,
};

export const rolePriority = (role: string | null | undefined): number =>
  ROLE_PRIORITY[role ?? "other"] ?? 10;

export const ROLE_LABELS_DE: Record<string, string> = {
  bekanntmachung: "Bekanntmachung",
  leistungsbeschreibung: "Leistungsbeschreibung",
  leistungsverzeichnis: "Leistungsverzeichnis",
  eignung: "Eignungsnachweise",
  zuschlagskriterien: "Zuschlagskriterien",
  vertragsbedingungen: "Vertragsbedingungen",
  formblatt: "Formblätter",
  anlage: "Anlagen / Pläne",
  nachtrag: "Nachträge / Ergänzungen",
  other: "Sonstiges",
};
