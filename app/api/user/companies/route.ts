import { db } from "@/lib/db";
import { companyProfiles, userCompanies } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { auth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const rows = await db
      .select({
        id: userCompanies.id,
        isActive: userCompanies.isActive,
        label: userCompanies.label,
        createdAt: userCompanies.createdAt,
        companyId: companyProfiles.id,
        companyName: companyProfiles.name,
        websiteUrl: companyProfiles.websiteUrl,
        description: companyProfiles.description,
        industry: companyProfiles.industry,
        logoUrl: companyProfiles.logoUrl,
        teamSize: companyProfiles.teamSize,
        capabilitiesJson: companyProfiles.capabilitiesJson,
        certificationsJson: companyProfiles.certificationsJson,
        regionsJson: companyProfiles.regionsJson,
      })
      .from(userCompanies)
      .leftJoin(companyProfiles, eq(userCompanies.companyId, companyProfiles.id))
      .where(eq(userCompanies.userId, session.user.id))
      .orderBy(desc(userCompanies.isActive), desc(userCompanies.createdAt));

    const companies = rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      isActive: row.isActive,
      label: row.label ?? row.companyName,
      companyName: row.companyName,
      websiteUrl: row.websiteUrl,
      description: row.description,
      industry: row.industry,
      logoUrl: row.logoUrl,
      teamSize: row.teamSize,
      capabilities: Array.isArray(row.capabilitiesJson) ? row.capabilitiesJson as string[] : [],
      certifications: Array.isArray(row.certificationsJson) ? row.certificationsJson as string[] : [],
      regions: Array.isArray(row.regionsJson) ? row.regionsJson as string[] : [],
      createdAt: row.createdAt,
    }));

    return json({ companies });
  } catch (error) {
    return errorResponse(error);
  }
}
