import { json } from "@/lib/http";
import { getUsTenderById, getUsTenderDocuments, isActiveUsTender, serializeUsTender } from "@/lib/us/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "Invalid opportunity id" }, { status: 400 });
  const tender = await getUsTenderById(id);
  if (!tender || !isActiveUsTender(tender)) return json({ error: "Opportunity not found" }, { status: 404 });
  const documents = await getUsTenderDocuments(tender.id);
  return json({ item: { ...serializeUsTender(tender, true), documents } });
}
