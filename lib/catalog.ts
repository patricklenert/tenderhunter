import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogState } from "@/lib/schema";

const STALE_SYNC_AFTER_MS = 30 * 60 * 1_000;

export async function markCatalogDirty(): Promise<number> {
  const rows = await db
    .insert(catalogState)
    .values({ id: 1, revision: 1, syncedRevision: 0, syncRunning: false })
    .onConflictDoUpdate({
      target: catalogState.id,
      set: {
        revision: sql`${catalogState.revision} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ revision: catalogState.revision });
  return rows[0]?.revision ?? 0;
}

/** Keep a live sync lock alive while batches are still making progress. */
export async function touchCatalogSync(): Promise<void> {
  await db.update(catalogState).set({
    syncStartedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(catalogState.id, 1), eq(catalogState.syncRunning, true)));
}

export async function getCatalogState() {
  const rows = await db.select().from(catalogState).where(eq(catalogState.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(catalogState).values({ id: 1 }).onConflictDoNothing();
  return (await db.select().from(catalogState).where(eq(catalogState.id, 1)).limit(1))[0];
}

export async function acquireCatalogSync(): Promise<number | null> {
  const staleBefore = new Date(Date.now() - STALE_SYNC_AFTER_MS);
  const rows = await db
    .update(catalogState)
    .set({ syncRunning: true, syncStartedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(catalogState.id, 1),
      or(
        eq(catalogState.syncRunning, false),
        and(
          eq(catalogState.syncRunning, true),
          or(isNull(catalogState.syncStartedAt), lt(catalogState.syncStartedAt, staleBefore)),
        ),
      ),
    ))
    .returning({ revision: catalogState.revision });
  return rows[0]?.revision ?? null;
}

export async function finishCatalogSync(syncedRevision: number): Promise<void> {
  await db.update(catalogState).set({
    syncedRevision,
    syncRunning: false,
    syncStartedAt: null,
    updatedAt: new Date(),
  }).where(eq(catalogState.id, 1));
}

export async function releaseCatalogSync(): Promise<void> {
  await db.update(catalogState).set({ syncRunning: false, syncStartedAt: null, updatedAt: new Date() }).where(eq(catalogState.id, 1));
}

/** Release a lock left behind by a killed worker process. */
export async function releaseStaleCatalogSync(): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_SYNC_AFTER_MS);
  const rows = await db.update(catalogState).set({
    syncRunning: false,
    syncStartedAt: null,
    updatedAt: new Date(),
  }).where(and(
    eq(catalogState.id, 1),
    eq(catalogState.syncRunning, true),
    or(
      isNull(catalogState.syncStartedAt),
      lt(catalogState.syncStartedAt, staleBefore),
    ),
  )).returning({ id: catalogState.id });
  return rows.length > 0;
}

/** Release a catalog lock when no sync job still owns it. */
export async function releaseOrphanedCatalogSync(): Promise<boolean> {
  const rows = await db.execute(sql`
    UPDATE catalog_state
    SET sync_running = false, sync_started_at = NULL, updated_at = NOW()
    WHERE id = 1
      AND sync_running = true
      AND NOT EXISTS (
        SELECT 1
        FROM jobs
        WHERE type = 'sync_meilisearch'
          AND status = 'running'
      )
    RETURNING id
  `);
  return rows.length > 0;
}
