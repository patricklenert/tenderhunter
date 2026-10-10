import { parseJsonBody, json, errorResponse } from "@/lib/http";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { handleMcpOptions, withMcpCors } from "@/lib/mcp/http";
import { mcpTenderSearchSchema, searchMcpTenders, serializeMcpError } from "@/lib/mcp/tenders";
import { McpQuotaExceededError } from "@/lib/mcp/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleMcpOptions(request) ?? new Response(null, { status: 204 });
}

export async function POST(request: Request): Promise<Response> {
  const optionsResponse = handleMcpOptions(request);
  if (optionsResponse) return optionsResponse;

  const access = authenticateMcpRequest(request);
  if (access instanceof Response) return withMcpCors(access);

  try {
    const body = await parseJsonBody<unknown>(request);
    const input = mcpTenderSearchSchema.parse(body);
    return withMcpCors(json(await searchMcpTenders(input, access)));
  } catch (error) {
    if (error instanceof McpQuotaExceededError) {
      return withMcpCors(json(serializeMcpError(error), {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((error.resetAt.getTime() - Date.now()) / 1_000))) },
      }));
    }
    return withMcpCors(errorResponse(error));
  }
}
