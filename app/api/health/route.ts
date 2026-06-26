import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const result = await db.execute(sql`SELECT 1 AS ok`);
  const ok = result[0]?.ok;
  return json({ status: ok === 1 ? "ok" : "error" });
}
