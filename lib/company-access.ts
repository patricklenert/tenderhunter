import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userCompanies } from "@/lib/schema";

export async function hasCompanyMembership(userId: string, companyId: number): Promise<boolean> {
  const rows = await db
    .select({ id: userCompanies.id })
    .from(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)))
    .limit(1);

  return rows.length > 0;
}
