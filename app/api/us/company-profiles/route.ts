import { ZodError } from "zod";
import { db } from "@/lib/db";
import { json, parseJsonBody } from "@/lib/http";
import { companyProfiles } from "@/lib/schema";
import { parseStringArray } from "@/lib/us/types";
import { companyProfileSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isUsProfile = (markets: unknown): boolean => Array.isArray(markets) && markets.includes("US");

export async function GET(): Promise<Response> {
  const items = await db.select().from(companyProfiles).orderBy(companyProfiles.id);
  return json({ items: items.filter((profile) => isUsProfile(profile.marketsJson)) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = companyProfileSchema.parse(await parseJsonBody<unknown>(request));
    if (!payload.markets.includes("US")) {
      return json({ error: "A U.S. profile must include the U.S. market." }, { status: 422 });
    }
    const existing = await db
      .select({ marketsJson: companyProfiles.marketsJson })
      .from(companyProfiles)
      .where(eq(companyProfiles.name, payload.name))
      .limit(1);
    const markets = [...new Set([...parseStringArray(existing[0]?.marketsJson), ...payload.markets])];
    const result = await db
      .insert(companyProfiles)
      .values({
        name: payload.name,
        capabilitiesJson: payload.capabilities,
        certificationsJson: payload.certifications,
        teamSize: payload.team_size ?? null,
        regionsJson: payload.regions,
        marketsJson: markets,
        naicsCodesJson: payload.naics_codes,
        pscCodesJson: payload.psc_codes,
        uei: payload.uei ?? null,
        cageCode: payload.cage_code ?? null,
        socioEconomicJson: payload.socio_economic,
      })
      .onConflictDoUpdate({
        target: companyProfiles.name,
        set: {
          capabilitiesJson: payload.capabilities,
          certificationsJson: payload.certifications,
          teamSize: payload.team_size ?? null,
          regionsJson: payload.regions,
          marketsJson: markets,
          naicsCodesJson: payload.naics_codes,
          pscCodesJson: payload.psc_codes,
          uei: payload.uei ?? null,
          cageCode: payload.cage_code ?? null,
          socioEconomicJson: payload.socio_economic,
          updatedAt: new Date(),
        },
      })
      .returning({ id: companyProfiles.id });
    return json({ id: result[0]?.id, name: payload.name }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return json({ error: "Invalid U.S. profile data.", details: error.flatten() }, { status: 422 });
    return json({ error: "Unable to save the U.S. profile." }, { status: 400 });
  }
}
