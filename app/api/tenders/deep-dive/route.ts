import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenderDeepDives, tenders } from "@/lib/schema";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/api-auth";
import { isSmallVendorTenderModeEnabled } from "@/lib/small-vendor";
import { buildTenderPipelineGroupKey, enqueueJob } from "@/lib/queue";
import { JOB_SMALL_VENDOR_DEEP_DIVE } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseTenderId = (value: unknown): number | null => {
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return null;
};

const gate = async (request: Request): Promise<Response | null> => {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  if (!isSmallVendorTenderModeEnabled(sessionOrResponse.session.user)) {
    return json({ error: "Kein Zugriff" }, { status: 403 });
  }
  return null;
};

const loadQualifiedTender = async (tenderId: number): Promise<{ id: number } | null> => {
  const rows = await db
    .select({ id: tenders.id })
    .from(tenders)
    .where(and(eq(tenders.id, tenderId), eq(tenders.qualityStatus, "qualified")))
    .limit(1);
  return rows[0] ?? null;
};

export async function GET(request: Request): Promise<Response> {
  try {
    const denied = await gate(request);
    if (denied) return denied;

    const url = new URL(request.url);
    const tenderId = parseTenderId(url.searchParams.get("tenderId"));
    if (tenderId === null) {
      return json({ error: "tenderId ist erforderlich" }, { status: 400 });
    }
    const tender = await loadQualifiedTender(tenderId);
    if (!tender) {
      return json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(tenderDeepDives)
      .where(eq(tenderDeepDives.tenderId, tenderId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return json({ tenderId, status: "none" });
    }
    return json({
      tenderId,
      status: row.status,
      model: row.model,
      result: row.resultJson ?? null,
      corpusStats: row.corpusStats ?? null,
      error: row.error,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[tenders/deep-dive] GET Fehler:", error);
    return json({ error: "Der Status der Tiefenanalyse konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const denied = await gate(request);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as { tenderId?: unknown; force?: unknown } | null;
    const tenderId = parseTenderId(body?.tenderId);
    if (tenderId === null) {
      return json({ error: "tenderId ist erforderlich" }, { status: 400 });
    }
    const force = body?.force === true;

    const tender = await loadQualifiedTender(tenderId);
    if (!tender) {
      return json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
    }

    const rows = await db
      .select({ status: tenderDeepDives.status })
      .from(tenderDeepDives)
      .where(eq(tenderDeepDives.tenderId, tenderId))
      .limit(1);
    const existing = rows[0];
    if (!force && (existing?.status === "pending" || existing?.status === "running")) {
      return json({ status: existing.status }, { status: 202 });
    }

    await db
      .insert(tenderDeepDives)
      .values({ tenderId, status: "pending" })
      .onConflictDoUpdate({
        target: tenderDeepDives.tenderId,
        set: { status: "pending", error: null, updatedAt: new Date() },
      });

    try {
      await enqueueJob(JOB_SMALL_VENDOR_DEEP_DIVE, { tender_id: tenderId, force }, {
        jobKey: force ? `small_vendor_deep_dive:${tenderId}:force` : `small_vendor_deep_dive:${tenderId}`,
        groupKey: buildTenderPipelineGroupKey(tenderId),
        dedupeCompleted: false,
        priority: 60,
      });
    } catch (error) {
      await db
        .update(tenderDeepDives)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Job konnte nicht eingereiht werden",
          updatedAt: new Date(),
        })
        .where(eq(tenderDeepDives.tenderId, tenderId));
      throw error;
    }

    return json({ status: "queued" }, { status: 202 });
  } catch (error) {
    console.error("[tenders/deep-dive] POST Fehler:", error);
    return json({ error: "Die Tiefenanalyse konnte nicht gestartet werden. Bitte erneut versuchen." }, { status: 500 });
  }
}
