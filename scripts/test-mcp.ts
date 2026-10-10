import assert from "node:assert/strict";
import { authenticateMcpRequest } from "../lib/mcp/auth";
import { mcpTenderSearchSchema } from "../lib/mcp/tenders";
import { getUtcQuotaWindow, MCP_DAILY_TENDER_LIMIT } from "../lib/mcp/quota";

assert.equal(MCP_DAILY_TENDER_LIMIT, 50);

const normalWindow = getUtcQuotaWindow(new Date("2026-09-10T12:34:56.000Z"));
assert.equal(normalWindow.bucketKey, "mcp:tenders:2026-09-10");
assert.equal(normalWindow.windowStartedAt.toISOString(), "2026-09-10T00:00:00.000Z");
assert.equal(normalWindow.resetAt.toISOString(), "2026-09-11T00:00:00.000Z");

const daylightSavingWindow = getUtcQuotaWindow(new Date("2026-10-25T01:30:00.000Z"));
assert.equal(daylightSavingWindow.bucketKey, "mcp:tenders:2026-10-25");
assert.equal(daylightSavingWindow.resetAt.toISOString(), "2026-10-26T00:00:00.000Z");

assert.deepEqual(mcpTenderSearchSchema.parse({}), {
  query: "",
  limit: 10,
  page: 1,
  todayNew: false,
  deadlineFilter: "all",
  sort: "deadline",
});
assert.throws(() => mcpTenderSearchSchema.parse({ limit: 31 }));
assert.throws(() => mcpTenderSearchSchema.parse({ deadlineFrom: "10.09.2026" }));

const previousApiKey = process.env.MCP_API_KEY;
const previousUnlimitedApiKey = process.env.MCP_UNLIMITED_API_KEY;
process.env.MCP_UNLIMITED_API_KEY = "patrick-personal-key";

delete process.env.MCP_API_KEY;
const anonymousRequest = new Request("https://example.test/api/mcp");
assert.deepEqual(authenticateMcpRequest(anonymousRequest), { unlimitedQuota: false });

const personalWithoutGlobalGateRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer patrick-personal-key" },
});
assert.deepEqual(authenticateMcpRequest(personalWithoutGlobalGateRequest), { unlimitedQuota: true });

process.env.MCP_API_KEY = "shared-access-key";

const personalRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer patrick-personal-key" },
});
assert.deepEqual(authenticateMcpRequest(personalRequest), { unlimitedQuota: true });
assert.equal(
  (personalRequest as Request & { auth?: { extra?: { unlimitedQuota?: boolean } } }).auth?.extra?.unlimitedQuota,
  true,
);

const sharedRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer shared-access-key" },
});
assert.deepEqual(authenticateMcpRequest(sharedRequest), { unlimitedQuota: false });

process.env.MCP_UNLIMITED_API_KEY = "patrick-personal-key, hermes-agent-key";
const agentRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer hermes-agent-key" },
});
assert.deepEqual(authenticateMcpRequest(agentRequest), { unlimitedQuota: true });
const wrongAgentRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer hermes-agent-wrong" },
});
assert.ok(authenticateMcpRequest(wrongAgentRequest) instanceof Response);
process.env.MCP_UNLIMITED_API_KEY = "patrick-personal-key";

process.env.MCP_UNLIMITED_API_KEY = "shared-access-key";
const sameKeyRequest = new Request("https://example.test/api/mcp", {
  headers: { authorization: "Bearer shared-access-key" },
});
assert.deepEqual(authenticateMcpRequest(sameKeyRequest), { unlimitedQuota: false });
process.env.MCP_UNLIMITED_API_KEY = "patrick-personal-key";

const unauthorizedRequest = new Request("https://example.test/api/mcp");
const unauthorizedResult = authenticateMcpRequest(unauthorizedRequest);
assert.ok(unauthorizedResult instanceof Response);
assert.equal(unauthorizedResult.status, 401);

if (previousApiKey === undefined) delete process.env.MCP_API_KEY;
else process.env.MCP_API_KEY = previousApiKey;
if (previousUnlimitedApiKey === undefined) delete process.env.MCP_UNLIMITED_API_KEY;
else process.env.MCP_UNLIMITED_API_KEY = previousUnlimitedApiKey;

console.log("MCP quota and input validation tests passed.");
