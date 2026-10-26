import type { DocumentRole } from "./schema";

export type RoleSource = "filename" | "url" | "linktext" | "content";

export interface ClassifyInput {
  filename?: string | null;
  url?: string | null;
  linkText?: string | null;
  textSample?: string | null;
}

export interface RoleEvidence {
  source: RoleSource;
  match: string;
}

export interface RoleHint {
  role: DocumentRole;
  confidence: number;
  source: RoleSource;
  evidence: RoleEvidence[];
}

export interface ClassifyResult {
  role: DocumentRole;
  confidence: number;
  source: RoleSource;
  roles: DocumentRole[];
  roleHints: RoleHint[];
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

const safeLower = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().replace(/[_\-./]+/g, " ");

const ROLE_SIGNAL_WEIGHTS: Record<RoleSource, number> = {
  filename: 0.85,
  linktext: 0.75,
  content: 0.6,
  // URLs often contain the tender type or a generic route. They are useful
  // evidence, but should not outrank a filename, link label, or document text.
  url: 0.5,
};

const isGenericUrlMatch = (match: string): boolean => /^ausschreibung$/i.test(match.trim());

export const classifyDocumentRole = (input: ClassifyInput): ClassifyResult => {
  const filename = safeLower(input.filename);
  const url = safeLower(input.url);
  const linkText = safeLower(input.linkText);
  const textSample = safeLower(input.textSample).slice(0, 3000);

  const signals = [
    { source: "filename" as const, text: filename, weight: ROLE_SIGNAL_WEIGHTS.filename },
    { source: "linktext" as const, text: linkText, weight: ROLE_SIGNAL_WEIGHTS.linktext },
    { source: "content" as const, text: textSample, weight: ROLE_SIGNAL_WEIGHTS.content },
    { source: "url" as const, text: url, weight: ROLE_SIGNAL_WEIGHTS.url },
  ].filter((signal) => signal.text.length > 0);
  const hasNonUrlRoleSignal = signals.some(
    (signal) => signal.source !== "url" && ROLE_KEYWORDS.some(({ patterns }) => patterns.some((pattern) => pattern.test(signal.text))),
  );

  const candidates = new Map<DocumentRole, {
    evidence: RoleEvidence[];
    bestSource: RoleSource;
    bestWeight: number;
  }>();

  for (const signal of signals) {
    for (const { role, patterns } of ROLE_KEYWORDS) {
      const matches = patterns
        .map((pattern) => signal.text.match(pattern)?.[0])
        .filter((match): match is string => Boolean(match))
        .filter((match) => !(signal.source === "url" && hasNonUrlRoleSignal && isGenericUrlMatch(match)));
      if (matches.length === 0) continue;

      const candidate = candidates.get(role) ?? {
        evidence: [],
        bestSource: signal.source,
        bestWeight: signal.weight,
      };
      for (const match of matches) {
        if (!candidate.evidence.some((evidence) => evidence.source === signal.source && evidence.match === match)) {
          candidate.evidence.push({ source: signal.source, match });
        }
      }
      if (signal.weight > candidate.bestWeight) {
        candidate.bestSource = signal.source;
        candidate.bestWeight = signal.weight;
      }
      candidates.set(role, candidate);
    }
  }

  const roleHints = [...candidates.entries()]
    .map(([role, candidate]): RoleHint => {
      const sourceCount = new Set(candidate.evidence.map((evidence) => evidence.source)).size;
      const corroborationBonus = Math.min(0.1, (sourceCount - 1) * 0.05);
      return {
        role,
        confidence: Math.min(0.99, candidate.bestWeight + corroborationBonus),
        source: candidate.bestSource,
        evidence: candidate.evidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || rolePriority(a.role) - rolePriority(b.role));

  if (roleHints.length === 0) {
    const fallback: RoleHint = { role: "other", confidence: 0, source: "content", evidence: [] };
    return { role: fallback.role, confidence: fallback.confidence, source: fallback.source, roles: [fallback.role], roleHints: [fallback] };
  }

  const primary = roleHints[0];
  return {
    role: primary.role,
    confidence: primary.confidence,
    source: primary.source,
    roles: roleHints.map((hint) => hint.role),
    roleHints,
  };
};

export const shouldRefineDocumentRole = (input: {
  role: string | null;
  roleSource: string | null;
  confidence: number | null;
}): boolean => input.roleSource !== "aggregator_summary"
  && (!input.role || input.role === "other" || (input.confidence ?? 0) < 0.75);

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
