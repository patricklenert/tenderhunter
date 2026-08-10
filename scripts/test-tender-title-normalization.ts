import assert from "node:assert/strict";
import { cleanTenderTitle } from "@/lib/public-tender-scraper";

assert.equal(
  cleanTenderTitle("DWI_2026_004: IT Security Awareness", "DWI_2026_004"),
  "IT Security Awareness",
);
assert.equal(
  cleanTenderTitle("DWI_2026_004: IT Security Awareness", "DWI_2026_005"),
  "DWI_2026_004: IT Security Awareness",
);
assert.equal(
  cleanTenderTitle("CXS0YYZYT24PNNN6 | IT Security Awareness"),
  "IT Security Awareness",
);

console.log("Tender title normalization tests passed.");
