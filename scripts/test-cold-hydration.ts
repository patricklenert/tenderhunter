import "dotenv/config";
import fs from "node:fs";
import { ensureLocalStored } from "../lib/object-store-cold";

const storagePath = process.argv[2] ?? "tenders/10000/249601879f1a-pdf.pdf";

const main = async (): Promise<void> => {
  const existed = fs.existsSync(require("path").join(process.env.OBJECT_STORE_PATH ?? "data/object_store", storagePath));
  const started = Date.now();
  const absolute = await ensureLocalStored(storagePath);
  const ms = Date.now() - started;
  const exists = fs.existsSync(absolute);
  process.stdout.write(JSON.stringify({ storagePath, existed, absolute, exists, ms }) + "\n");
  if (!exists) process.exit(1);
};

main().catch((error) => {
  console.error("HYDRATION FEHLGESCHLAGEN:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
