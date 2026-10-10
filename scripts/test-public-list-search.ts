import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { like, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { tenders } from "../lib/schema";

const search = "Küchenmöbel";
const query = new PgDialect().sqlToQuery(
  like(sql`${tenders.metadataJson}::text`, `%${search}%`),
);

assert.match(query.sql, /"tenders"\."metadata_json"::text like \$1/);
assert.equal(query.params[0], `%${search}%`);
assert.doesNotMatch(query.sql, /Küchenmöbel/);

const routeSource = readFileSync("app/api/tenders/public/list/route.ts", "utf8");
assert.match(
  routeSource,
  /like\(sql`\$\{tenders\.metadataJson\}::text`, `%\$\{search\}%`\)/,
);
assert.doesNotMatch(routeSource, /like\(tenders\.metadataJson,/);

console.log("Public list search regression test passed.");
