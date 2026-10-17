import { unstable_rethrow } from "next/navigation";

export function dependencyUnavailableResponse(): Response {
  return new Response("Public tender data is temporarily unavailable.", {
    status: 503,
    headers: {
      "Retry-After": "60",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}

/** Preserve Next.js control-flow signals when broad data fallbacks catch errors. */
export function rethrowNavigationError(error: unknown): void {
  unstable_rethrow(error);
}

/** Optional detail-page data must not turn an otherwise renderable tender into a 5xx. */
export async function optionalPublicRows<T>(query: () => PromiseLike<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch {
    return [];
  }
}
