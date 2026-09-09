export function dependencyUnavailableResponse(): Response {
  return new Response("Public tender data is temporarily unavailable.", {
    status: 503,
    headers: {
      "Retry-After": "60",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
