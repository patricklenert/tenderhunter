import assert from "node:assert/strict";
import { derivePublicTenderCategory, extractPublicCpvCodes } from "@/lib/public-tender-scraper";

assert.deepEqual(extractPublicCpvCodes("48000000-8 und 72268000-1"), ["48000000-8", "72268000-1"]);
assert.equal(
  derivePublicTenderCategory(
    "Facility Management",
    ["48000000-8", "72268000-1"],
    "Citrix Lizenz Renewal",
  ),
  "IT-Dienstleistungen",
);
assert.equal(
  derivePublicTenderCategory("Facility Management", [], "Beschaffung einer Softwarelizenz"),
  "IT-Dienstleistungen",
);
assert.equal(
  derivePublicTenderCategory("IT-Dienstleistungen", [], "Metallbauarbeiten mit Software im Vergabeportal"),
  "Bauarbeiten",
);
assert.equal(derivePublicTenderCategory("Bauarbeiten", [], "Dachsanierung"), "Bauarbeiten");

console.log("Public category tests passed.");
