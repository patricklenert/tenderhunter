import { timingSafeEqual } from "node:crypto";

export interface McpRequestAccess {
  unlimitedQuota: boolean;
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes);
}

function unlimitedKeys(apiKey: string): string[] {
  return (process.env.MCP_UNLIMITED_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0 && key !== apiKey);
}

/** MCP_UNLIMITED_API_KEY takes comma-separated keys (personal, agent); MCP_API_KEY remains an optional global access gate. */
export function authenticateMcpRequest(request: Request): McpRequestAccess | Response {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ", 2);
  const bearerToken = scheme?.toLowerCase() === "bearer" ? token : undefined;

  const apiKey = process.env.MCP_API_KEY?.trim() ?? "";
  if (bearerToken && unlimitedKeys(apiKey).some((key) => secretsMatch(bearerToken, key))) {
    (request as Request & { auth?: unknown }).auth = {
      token: bearerToken,
      clientId: "tenderhunter-personal",
      scopes: [],
      extra: { unlimitedQuota: true },
    };
    return { unlimitedQuota: true };
  }

  if (!apiKey) return { unlimitedQuota: false };
  if (bearerToken && secretsMatch(bearerToken, apiKey)) return { unlimitedQuota: false };

  return Response.json(
    { error: "MCP benötigt einen gültigen Bearer-Token." },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    },
  );
}
