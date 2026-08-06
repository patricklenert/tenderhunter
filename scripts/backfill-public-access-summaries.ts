import "dotenv/config";
import postgres from "postgres";
import {
  buildPublicAccessLimitedDescription,
  extractPublicPortalFacts,
  isRawPortalDescription,
} from "../lib/public-tender-scraper";
import { isParticipationWallText } from "../lib/access-page-detector";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter");

async function main(): Promise<void> {
  const rows = await sql<{
    id: number;
    title: string;
    metadata_json: Record<string, unknown> | string | null;
    raw_text: string | null;
  }[]>`
    SELECT id, title, metadata_json, raw_text
    FROM tenders
    WHERE quality_status <> 'duplicate'
  `;

  let changed = 0;
  for (const row of rows) {
    const metadataWasString = typeof row.metadata_json === "string";
    const metadata = typeof row.metadata_json === "string"
      ? JSON.parse(row.metadata_json) as Record<string, unknown>
      : row.metadata_json ?? {};
    const rawDescription = metadata.access_limited === true && row.raw_text && row.raw_text.length > 100
      ? row.raw_text
      : [metadata.description, row.raw_text]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" ");
    const isAccessLimited = metadata.access_limited === true
      || isParticipationWallText(rawDescription)
      || isRawPortalDescription(rawDescription);
    if (!isAccessLimited && !metadataWasString) continue;

    const facts = extractPublicPortalFacts(rawDescription);
    const description = isAccessLimited
      ? buildPublicAccessLimitedDescription(row.title, facts)
      : String(metadata.description ?? "");
    const nextMetadata = isAccessLimited
      ? {
         ...metadata,
         ...(facts.client ? { client: facts.client } : {}),
         ...(facts.subject ? { subject: facts.subject } : {}),
         description,
        access_limited: true,
        description_source: "portal_summary",
      }
      : metadata;
    if (
      !metadataWasString
      && metadata.description === description
      && metadata.client === nextMetadata.client
      && metadata.subject === nextMetadata.subject
      && metadata.access_limited === true
    ) continue;

    await sql`
      UPDATE tenders
      SET metadata_json = ${sql.json(nextMetadata as never)},
          updated_at = NOW()
      WHERE id = ${row.id}
    `;
    changed += 1;
  }

  console.log(JSON.stringify({ scanned: rows.length, changed }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exitCode = 1;
});
