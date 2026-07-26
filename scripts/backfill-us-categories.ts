import { db } from "@/lib/db";
import { usTenders } from "@/lib/schema";
import { categorizeUsTender } from "@/lib/us/categorize";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db.select().from(usTenders);
  let updated = 0;
  for (const row of rows) {
    const category = categorizeUsTender({ naicsCodesJson: row.naicsCodesJson, title: row.title, description: row.description });
    if (row.category === category) continue;
    await db.update(usTenders).set({ category, updatedAt: new Date() }).where(eq(usTenders.id, row.id));
    updated += 1;
  }
  console.log(`Backfilled ${updated} U.S. opportunity categories.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
