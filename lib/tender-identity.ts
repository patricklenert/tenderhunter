export function stripSessionId(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/;?]*/i, "");
    parsed.searchParams.delete("jsessionid");
    return parsed.toString();
  } catch {
    return url.replace(/;jsessionid=[^/;?]*/gi, "");
  }
}

export function extractPortalProjectId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/project\/([^/;?]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
