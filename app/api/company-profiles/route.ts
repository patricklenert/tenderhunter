import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/schema";
import { companyProfileSchema } from "@/lib/validation";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const items = await db
    .select()
    .from(companyProfiles)
    .orderBy(companyProfiles.id);

  return json({ items });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = companyProfileSchema.parse(await parseJsonBody<unknown>(request));
    const result = await db
      .insert(companyProfiles)
      .values({
        name: payload.name,
        capabilitiesJson: payload.capabilities,
        certificationsJson: payload.certifications,
        teamSize: payload.team_size ?? null,
        regionsJson: payload.regions,
      })
      .onConflictDoUpdate({
        target: companyProfiles.name,
        set: {
          capabilitiesJson: payload.capabilities,
          certificationsJson: payload.certifications,
          teamSize: payload.team_size ?? null,
          regionsJson: payload.regions,
          updatedAt: new Date(),
        },
      })
      .returning({ id: companyProfiles.id });

    return json({ id: result[0]?.id, name: payload.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
