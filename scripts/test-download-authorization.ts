import assert from "node:assert/strict";
import { resolveSafeStoredDocumentPath } from "../app/api/tenders/public/download/route";

const root = "/tmp/tenderhunter-object-store";
assert.equal(resolveSafeStoredDocumentPath(root, "tenders/42/document.pdf"), `${root}/tenders/42/document.pdf`);
assert.equal(resolveSafeStoredDocumentPath(root, "../outside.pdf"), null);
assert.equal(resolveSafeStoredDocumentPath(root, "tenders/42/../../outside.pdf"), null);
assert.equal(resolveSafeStoredDocumentPath(root, "/etc/passwd"), null);
assert.equal(resolveSafeStoredDocumentPath(root, "tenders\\42\\document.pdf"), null);

console.log("Download authorization tests passed.");
