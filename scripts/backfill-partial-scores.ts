import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyProfiles, scores, structuredData, tenders } from "@/lib/schema";
import { scoreKnownTenders } from "@/lib/discovery";
import type { CompanyRow } from "@/lib/scoring";

async function main(): Promise<void> {
  const partialRows = await db
    .select({ n: count() })
    .from(tenders)
    .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "partial"),
      sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
    ));
  const partialTotal = Number(partialRows[0]?.n ?? 0);
  console.log("scorebare partielle Tender:", partialTotal);

  const scoredRows = await db
    .select({ companyId: scores.companyId, n: count() })
    .from(scores)
    .innerJoin(tenders, eq(tenders.id, scores.tenderId))
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "partial"),
    ))
    .groupBy(scores.companyId);
  const scoredByCompany = new Map(
    scoredRows.map((row) => [row.companyId, Number(row.n)]),
  );

  const profiles = await db
    .select({
      id: companyProfiles.id,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      industry: companyProfiles.industry,
    })
    .from(companyProfiles)
    .orderBy(desc(companyProfiles.id));

  let total = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const have = scoredByCompany.get(profile.id) ?? 0;
    if (have >= partialTotal && partialTotal > 0) {
      skipped += 1;
      continue;
    }
    console.log("company", profile.id, "deckt", have, "von", partialTotal, "- rescore");
    const companyRow: CompanyRow = {
      capabilities_json: JSON.stringify(profile.capabilitiesJson ?? []),
      certifications_json: JSON.stringify(profile.certificationsJson ?? []),
      regions_json: JSON.stringify(profile.regionsJson ?? []),
      team_size: profile.teamSize,
      industry: profile.industry,
    };
    const scored = await scoreKnownTenders(profile.id, companyRow);
    total += scored;
    console.log("company", profile.id, "scored", scored, "tenders");
  }

  console.log("fertig:", profiles.length, "Firmenprofile,", skipped, "uebersprungen,", total, "Tender gescored");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
