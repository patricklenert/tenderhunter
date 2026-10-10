export function dependencyUnavailableResponse(): Response {
  return new Response("Public tender data is temporarily unavailable.", {
    status: 503,
    headers: {
      "Retry-After": "60",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}

/** Optional detail-page data must not turn an otherwise renderable tender into a 5xx. */
export async function optionalPublicRows<T>(query: () => PromiseLike<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch {
    return [];
  }
}
