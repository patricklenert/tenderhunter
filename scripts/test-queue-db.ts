import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { jobs } from "../lib/schema";
import { enqueueJob } from "../lib/queue";

const key = `test:queue:${Date.now()}`;
const createdIds: number[] = [];

const markDone = async (id: number): Promise<void> => {
  await db.update(jobs).set({ status: "done", finishedAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, id));
};

const main = async (): Promise<void> => {
  try {
    const first = await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false });
    createdIds.push(first);

    await markDone(first);
    const second = await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false });
    createdIds.push(second);
    assert.notEqual(second, first, "periodic work must be reinserted after completion");

    assert.equal(
      await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key }),
      second,
      "active work must still be coalesced",
    );

    await markDone(second);
    assert.equal(
      await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key }),
      second,
      "one-shot work must reuse completed work by default",
    );

    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false })),
    );
    const concurrentIds = [...new Set(concurrent)];
    assert.equal(concurrentIds.length, 1, "concurrent periodic enqueues must leave one active row");
    createdIds.push(...concurrentIds);

    console.log("Queue database tests passed.");
  } finally {
    if (createdIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, [...new Set(createdIds)]));
    }
    await db.$client.end({ timeout: 5 }).catch(() => undefined);
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
