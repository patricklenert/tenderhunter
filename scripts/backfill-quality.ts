import postgres from "postgres";
import { createHash } from "node:crypto";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

interface StructuredData {
  title: string;
  summary: string;
  hard_facts: {
    deadline: string | null;
    location: string | null;
    buyer: string | null;
    contract_type: string | null;
    budget: string | null;
  };
  decision_relevant: {
    scope: string[];
    requirements: string[];
    award_criteria: string[];
    mandatory_documents: string[];
  };
  confidence: number;
}

interface TenderRow {
  id: number;
  title: string | null;
  url: string;
  raw_text: string | null;
}

const POSITIVE_KEYWORDS = [
  "ausschreibung",
  "bekanntmachung",
  "vergabe",
  "vergabeunterlagen",
  "teilnahmewettbewerb",
  "leistungsbeschreibung",
  "zuschlagskriterien",
  "angebotsfrist",
  "beschaffung",
  "contract notice",
  "procurement",
  "tender",
];

const NEGATIVE_KEYWORDS = [
  "impressum",
  "datenschutz",
  "cookie",
  "kontakt",
  "login",
  "registrierung",
  "newsletter",
  "sitemap",
  "karriere",
  "hilfe",
  "faq",
];

const compactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const countKeywordMatches = (haystack: string, keywords: readonly string[]): number => {
  const normalized = haystack.toLowerCase();
  return keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
};

const buildFingerprintSeed = (structured: StructuredData): string => {
  const parts = [
    structured.title,
    structured.hard_facts.buyer ?? "",
    structured.hard_facts.location ?? "",
    structured.hard_facts.deadline ?? "",
    structured.hard_facts.contract_type ?? "",
    structured.hard_facts.budget ?? "",
    structured.decision_relevant.scope.slice(0, 5).join(" | "),
    structured.decision_relevant.requirements.slice(0, 5).join(" | "),
    structured.decision_relevant.mandatory_documents.slice(0, 5).join(" | "),
  ];
  return compactText(parts.join("\n")).toLowerCase();
};

const buildTenderFingerprint = (structured: StructuredData): string | null => {
  const seed = buildFingerprintSeed(structured);
  if (seed.length < 80) return null;
  return createHash("sha1").update(seed).digest("hex");
};

const assessQuality = (title: string, url: string, rawText: string, structured: StructuredData) => {
  const summaryText = compactText(`${title} ${url} ${structured.summary} ${(rawText ?? "").slice(0, 2_000)}`);
  const positiveMatches = countKeywordMatches(summaryText, POSITIVE_KEYWORDS);
  const negativeMatches = countKeywordMatches(summaryText, NEGATIVE_KEYWORDS);
  const extractedSignals = [
    structured.hard_facts.deadline,
    structured.hard_facts.location,
    structured.hard_facts.buyer,
    structured.hard_facts.contract_type,
    structured.hard_facts.budget,
  ].filter(Boolean).length;
  const relevantLineCount =
    structured.decision_relevant.scope.length +
    structured.decision_relevant.requirements.length +
    structured.decision_relevant.award_criteria.length +
    structured.decision_relevant.mandatory_documents.length;
  const fingerprint = buildTenderFingerprint(structured);

  if (compactText(rawText ?? "").length < 250) {
    return { status: "rejected" as const, reason: "Zu wenig Inhalt fuer eine belastbare Ausschreibungsbewertung.", fingerprint };
  }
  if (structured.confidence < 0.35 && relevantLineCount < 3 && positiveMatches < 2) {
    return { status: "rejected" as const, reason: "Zu wenig ausschreibungsrelevante Signale nach der Strukturierung.", fingerprint };
  }
  if (negativeMatches >= 3 && positiveMatches <= 1 && extractedSignals < 2) {
    return { status: "rejected" as const, reason: "Die Seite wirkt eher wie Navigation oder Information als wie eine Ausschreibung.", fingerprint };
  }
  if (positiveMatches === 0 && extractedSignals < 2 && relevantLineCount < 3) {
    return { status: "rejected" as const, reason: "Die Quelle enthaelt keine ausreichenden Vergabehinweise.", fingerprint };
  }
  return { status: "qualified" as const, reason: "Ausschreibungssignale erkannt und fuer das Scoring freigegeben.", fingerprint };
};

async function main() {
  console.log("Connecting to PostgreSQL...");
  const client = postgres(connectionString, { max: 1 });

  try {
    const candidateTenders: TenderRow[] = await client`
      SELECT id, title, url, raw_text FROM tenders WHERE quality_status = 'candidate' ORDER BY id ASC
    `;
    console.log(`Found ${candidateTenders.length} candidate tenders to re-evaluate.`);

    let qualified = 0;
    let rejected = 0;
    let duplicate = 0;
    let skipped = 0;

    for (const tender of candidateTenders) {
      const structuredRows: { json_blob: StructuredData }[] = await client`
        SELECT json_blob FROM structured_data WHERE tender_id = ${tender.id} LIMIT 1
      `;

      if (structuredRows.length === 0) {
        console.log(`  #${tender.id} "${tender.title ?? tender.url}" - no structured data, skipping`);
        skipped++;
        continue;
      }

      const structured = structuredRows[0].json_blob;
      const assessment = assessQuality(tender.title ?? "", tender.url, tender.raw_text ?? "", structured);

      let finalStatus: string = assessment.status;
      let finalReason = assessment.reason;
      let duplicateOfId: number | null = null;

      if (assessment.fingerprint) {
        const dupes: { id: number }[] = await client`
          SELECT id FROM tenders WHERE content_fingerprint = ${assessment.fingerprint} AND id != ${tender.id} ORDER BY id ASC LIMIT 1
        `;
        if (dupes.length > 0) {
          finalStatus = "duplicate";
          finalReason = `Inhalt entspricht bereits Ausschreibung #${dupes[0].id}.`;
          duplicateOfId = dupes[0].id;
        }
      }

      await client`
        UPDATE tenders SET
          quality_status = ${finalStatus},
          quality_reason = ${finalReason},
          content_fingerprint = ${assessment.fingerprint ?? null},
          duplicate_of_tender_id = ${duplicateOfId},
          updated_at = NOW()
        WHERE id = ${tender.id}
      `;

      if (finalStatus !== "qualified") {
        await client`DELETE FROM insights WHERE tender_id = ${tender.id}`;
        await client`DELETE FROM scores WHERE tender_id = ${tender.id}`;
      }

      if (finalStatus === "qualified") qualified++;
      else if (finalStatus === "rejected") rejected++;
      else if (finalStatus === "duplicate") duplicate++;

      console.log(`  #${tender.id} "${tender.title ?? tender.url}" -> ${finalStatus}${finalStatus === "duplicate" ? ` (dup of #${duplicateOfId})` : ""}`);
    }

    console.log(`\nBackfill complete: ${qualified} qualified, ${rejected} rejected, ${duplicate} duplicate, ${skipped} skipped (no structured data).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
