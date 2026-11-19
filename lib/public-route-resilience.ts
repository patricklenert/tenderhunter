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

/** Preserve Next.js control flow and surface failures from required public data. */
export function rethrowPublicDataError(error: unknown): never {
  unstable_rethrow(error);
  throw error;
}

/** Optional detail-page data must not turn an otherwise renderable tender into a 5xx. */
export async function optionalPublicRows<T>(query: () => PromiseLike<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch {
    return [];
  }
}
