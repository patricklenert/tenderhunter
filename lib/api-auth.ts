import { auth } from "@/lib/auth";

const API_KEY = process.env.TENDERHUNTER_API_KEY ?? "";

export function validateApiKey(request: Request): boolean {
  if (!API_KEY) return false;
  const header = request.headers.get("x-api-key") ?? "";
  // Constant-time comparison would be ideal; for a shared key this is acceptable.
  return header === API_KEY;
}

export function requireApiKey(request: Request): Response | null {
  if (!validateApiKey(request)) {
    return Response.json(
      { error: "Ungueltiger oder fehlender API Key." },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Returns the authenticated session or a 401 Response.
 * Use in API routes that require a logged-in user.
 *
 * Usage:
 *   const sessionOrResponse = await requireSession(request);
 *   if (sessionOrResponse instanceof Response) return sessionOrResponse;
 *   const { session } = sessionOrResponse; // session.user.id available
 */
export async function requireSession(
  request: Request
): Promise<{ session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>> } | Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return Response.json(
      { error: "Nicht angemeldet. Bitte einloggen." },
      { status: 401 }
    );
  }
  return { session };
}
