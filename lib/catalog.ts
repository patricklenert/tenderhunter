import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogState } from "@/lib/schema";

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

export async function getCatalogState() {
  const rows = await db.select().from(catalogState).where(eq(catalogState.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(catalogState).values({ id: 1 }).onConflictDoNothing();
  return (await db.select().from(catalogState).where(eq(catalogState.id, 1)).limit(1))[0];
}

export async function acquireCatalogSync(): Promise<number | null> {
  const rows = await db
    .update(catalogState)
    .set({ syncRunning: true, updatedAt: new Date() })
    .where(and(eq(catalogState.id, 1), eq(catalogState.syncRunning, false)))
    .returning({ revision: catalogState.revision });
  return rows[0]?.revision ?? null;
}

export async function finishCatalogSync(syncedRevision: number): Promise<void> {
  await db.update(catalogState).set({
    syncedRevision,
    syncRunning: false,
    updatedAt: new Date(),
  }).where(eq(catalogState.id, 1));
}

export async function releaseCatalogSync(): Promise<void> {
  await db.update(catalogState).set({ syncRunning: false, updatedAt: new Date() }).where(eq(catalogState.id, 1));
}
