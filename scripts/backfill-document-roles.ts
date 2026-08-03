import { eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { documents } from "../lib/schema";
import { classifyDocumentRole } from "../lib/document-classifier";

const apply = process.argv.includes("--apply");

const run = async () => {
  const rows = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      url: documents.url,
      extractedText: documents.extractedText,
    })
    .from(documents)
    .where(isNull(documents.role));

  let classified = 0;
  for (const row of rows) {
    const result = classifyDocumentRole({
      filename: row.filename,
      url: row.url,
      textSample: row.extractedText?.slice(0, 3000),
    });
    if (result.role === "other") continue;
    classified += 1;
    if (apply) {
      await db.update(documents).set({
        role: result.role,
        roleSource: result.source,
        roleConfidence: result.confidence,
        updatedAt: new Date(),
      }).where(eq(documents.id, row.id));
    }
  }

  console.log(`${apply ? "Angewendet" : "Erkannt"}: ${classified}/${rows.length} Dokumentrollen`);
  if (!apply) console.log("Dry-run: mit --apply schreiben.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
