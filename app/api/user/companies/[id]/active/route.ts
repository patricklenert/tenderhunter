import { db } from "@/lib/db";
import { userCompanies } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const { id } = await params;
    const userCompanyId = parseInt(id, 10);
    if (!Number.isFinite(userCompanyId) || userCompanyId <= 0) {
      return json({ error: "Ungueltige ID." }, { status: 400 });
    }

    const existing = await db
      .select({ id: userCompanies.id })
      .from(userCompanies)
      .where(and(eq(userCompanies.id, userCompanyId), eq(userCompanies.userId, session.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return json({ error: "Firmenprofil nicht gefunden." }, { status: 404 });
    }

    await db
      .update(userCompanies)
      .set({ isActive: false })
      .where(eq(userCompanies.userId, session.user.id));

    await db
      .update(userCompanies)
      .set({ isActive: true })
      .where(eq(userCompanies.id, userCompanyId));

    return json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
