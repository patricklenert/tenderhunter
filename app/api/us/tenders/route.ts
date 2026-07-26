import { errorResponse, json } from "@/lib/http";
import { searchUsTenders, serializeUsTender } from "@/lib/us/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1), 50);
    const page = Math.max(Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1);
    const result = await searchUsTenders({
      query: url.searchParams.get("q") ?? "",
      state: url.searchParams.get("state") ?? "",
      source: url.searchParams.get("source") ?? "",
      category: url.searchParams.get("category") ?? "",
      subcontracting: url.searchParams.get("subcontracting") === "true" ? true : url.searchParams.get("subcontracting") === "false" ? false : undefined,
      limit,
      page,
    });
    return json({ items: result.items.map((item) => serializeUsTender(item)), total: result.total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
}
