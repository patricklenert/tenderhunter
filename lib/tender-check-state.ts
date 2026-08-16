import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenderCheckStates } from "@/lib/schema";

export type TenderCheckStateMap = Record<string, boolean>;

const normalizeState = (value: unknown): TenderCheckStateMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const state: TenderCheckStateMap = {};
  for (const [key, done] of Object.entries(value as Record<string, unknown>)) {
    if (key.length > 0 && typeof done === "boolean") state[key] = done;
  }
  return state;
};

export async function getTenderCheckState(userId: string, tenderId: number): Promise<TenderCheckStateMap> {
  const rows = await db
    .select({ states: tenderCheckStates.statesJson })
    .from(tenderCheckStates)
    .where(and(eq(tenderCheckStates.userId, userId), eq(tenderCheckStates.tenderId, tenderId)))
    .limit(1);

  return normalizeState(rows[0]?.states);
}

export async function updateTenderCheckState(
  userId: string,
  tenderId: number,
  itemKey: string,
  done: boolean,
): Promise<TenderCheckStateMap> {
  const current = await getTenderCheckState(userId, tenderId);
  const next = { ...current, [itemKey]: done };

  await db
    .insert(tenderCheckStates)
    .values({
      userId,
      tenderId,
      statesJson: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [tenderCheckStates.userId, tenderCheckStates.tenderId],
      set: {
        statesJson: next,
        updatedAt: new Date(),
      },
    });

  return next;
}
