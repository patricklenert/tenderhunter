import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { companyProfiles } from "@/lib/schema";
import { getUsTenderById, isActiveUsTender, serializeUsTender } from "@/lib/us/repository";
import { buildUsPursuitChecklist, scoreUsTender } from "@/lib/us/scoring";
import { findUsPrimeContractors } from "@/lib/us/usaspending";
import { getUsTeamingResources } from "@/lib/us/teaming-resources";
import { parseStringArray } from "@/lib/us/types";
import { eq } from "drizzle-orm";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const premiumOrResponse = await requirePremiumSession(request);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  const id = Number.parseInt((await params).id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "Invalid opportunity id" }, { status: 400 });
  const tender = await getUsTenderById(id);
  if (!tender || !isActiveUsTender(tender)) return json({ error: "Opportunity not found" }, { status: 404 });

  const companyId = Number.parseInt(new URL(request.url).searchParams.get("companyId") ?? "", 10);
  const company = Number.isSafeInteger(companyId) && companyId > 0
    ? (await db.select().from(companyProfiles).where(eq(companyProfiles.id, companyId)).limit(1))[0] ?? null
    : null;
  const [primesResult] = await Promise.allSettled([findUsPrimeContractors(parseStringArray(tender.naicsCodesJson))]);
  const primes = primesResult.status === "fulfilled" ? primesResult.value : [];
  const fit = company ? scoreUsTender(tender, company) : null;

  return json({
    opportunity: serializeUsTender(tender, true),
    fit,
    checklist: buildUsPursuitChecklist(tender, company),
    primeContractors: primes,
    teamingResources: getUsTeamingResources(tender.buyer),
    directBidReady: Boolean(fit?.registrationReady && fit.eligibleForSetAside !== false),
    teamingGuidance: "Contact each relevant prime with a tailored capability statement, the solicitation number, matching NAICS codes, and a concise description of the work package you can perform.",
  });
}
