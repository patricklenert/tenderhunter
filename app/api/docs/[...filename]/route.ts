import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy shared files cannot be tied back to a tender, so they must not bypass
// the qualified-tender check in the authenticated download endpoint.
export async function GET(): Promise<Response> {
  return new NextResponse("Not found", { status: 404 });
}
