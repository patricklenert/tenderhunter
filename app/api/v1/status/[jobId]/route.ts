import { db } from "@/lib/db";
import { apiJobs, tenders } from "@/lib/schema";
import { requireApiKey } from "@/lib/api-auth";
import { and, eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { jobId: jobIdStr } = await params;
  const jobId = Number.parseInt(jobIdStr, 10);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return Response.json({ error: "Ungueltige jobId." }, { status: 400 });
  }

  const rows = await db
    .select({
      id: apiJobs.id,
      status: apiJobs.status,
      profileUrl: apiJobs.profileUrl,
      tendersJson: apiJobs.tendersJson,
      error: apiJobs.error,
      companyId: apiJobs.companyId,
    })
    .from(apiJobs)
    .where(eq(apiJobs.id, jobId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Job nicht gefunden." }, { status: 404 });
  }

  const job = rows[0];

  if (job.status === "processing") {
    return Response.json({ jobId: job.id, status: "processing" });
  }

  if (job.status === "failed") {
    return Response.json({ jobId: job.id, status: "failed", error: job.error ?? "Analyse fehlgeschlagen." });
  }

  const snapshot = Array.isArray(job.tendersJson) ? job.tendersJson : [];
  const tenderIds = snapshot
    .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).id : null)
    .filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id));
  const visibleIds = tenderIds.length > 0
    ? new Set((await db.select({ id: tenders.id }).from(tenders)
      .where(and(inArray(tenders.id, tenderIds), eq(tenders.qualityStatus, "qualified")))).map((row) => row.id))
    : new Set<number>();
  const visibleTenders = snapshot.filter((item) => item && typeof item === "object" && visibleIds.has((item as Record<string, unknown>).id as number));

  return Response.json({
    jobId: job.id,
    status: "completed",
    profileUrl: job.profileUrl,
    tenders: visibleTenders,
  });
}
