import "dotenv/config";
import postgres from "postgres";
import { classifyOpportunityStatus } from "@/lib/opportunity-status";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";
const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  try {
    const rows = await client<{ id: number; title: string | null; raw_text: string | null }[]>`
      SELECT id, title, raw_text
      FROM tenders
      WHERE quality_status <> 'rejected'
      ORDER BY id ASC
    `;
    const rejected = rows.flatMap((row) => {
      const status = classifyOpportunityStatus(row.title, row.raw_text);
      return status.isAwarded ? [{ ...row, reason: status.reason }] : [];
    });

    if (dryRun) {
      for (const row of rejected) console.log(`#${row.id}: ${row.reason}`);
      console.log(JSON.stringify({ dryRun, scanned: rows.length, rejected: rejected.length }));
      return;
    }

    for (const row of rejected) {
      await client.begin(async (tx) => {
        await tx`
          UPDATE tenders
          SET quality_status = 'rejected', quality_reason = ${row.reason},
              readiness_status = 'manual_review', readiness_reason = ${row.reason}, updated_at = NOW()
          WHERE id = ${row.id}
        `;
        await tx`DELETE FROM insights WHERE tender_id = ${row.id}`;
        await tx`DELETE FROM scores WHERE tender_id = ${row.id}`;
      });
    }
    if (rejected.length > 0) {
      await client`UPDATE catalog_state SET revision = revision + 1, updated_at = NOW() WHERE id = 1`;
    }
    console.log(JSON.stringify({ dryRun, scanned: rows.length, rejected: rejected.length }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Awarded-tender reclassification failed:", error);
  process.exitCode = 1;
});
