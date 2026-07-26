import { db } from "@/lib/db";
import { scoreKnownTenders } from "@/lib/discovery";
import { companyProfiles } from "@/lib/schema";

const stringifyList = (value: unknown): string => JSON.stringify(Array.isArray(value) ? value : []);

async function main() {
  const companies = await db
    .select({
      id: companyProfiles.id,
      name: companyProfiles.name,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      industry: companyProfiles.industry,
    })
    .from(companyProfiles)
    .orderBy(companyProfiles.id);

  let total = 0;
  for (const company of companies) {
    const scored = await scoreKnownTenders(company.id, {
      capabilities_json: stringifyList(company.capabilitiesJson),
      certifications_json: stringifyList(company.certificationsJson),
      regions_json: stringifyList(company.regionsJson),
      team_size: company.teamSize,
      industry: company.industry,
    });
    total += scored;
    console.log(`[location-backfill] ${company.name}: ${scored} Ausschreibungen bewertet.`);
  }

  console.log(`[location-backfill] ${companies.length} Firmen, ${total} Scores aktualisiert.`);
}

main().catch((error) => {
  console.error("Location-score backfill failed:", error);
  process.exit(1);
});
