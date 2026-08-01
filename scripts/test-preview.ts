import assert from "node:assert/strict";
import { canonicalizePreviewUrl, PreviewUrlError } from "@/lib/preview";

const main = async () => {
  const canonical = await canonicalizePreviewUrl("https://EXAMPLE.com:443///#fragment").catch((error) => {
    throw error;
  });
  assert.equal(canonical.canonicalUrl, "https://example.com/");
  await assert.rejects(() => canonicalizePreviewUrl("http://127.0.0.1/admin"), PreviewUrlError);
  await assert.rejects(() => canonicalizePreviewUrl("https://user:pass@example.com"), PreviewUrlError);
  console.log("Preview URL validation checks passed.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
