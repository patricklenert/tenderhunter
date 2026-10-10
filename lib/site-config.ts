export const DEFAULT_SITE_URL = "https://palemaz.com";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_SITE_URL;

  try {
    const url = new URL(configured);
    url.protocol = "https:";
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function getSiteHost() {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return new URL(DEFAULT_SITE_URL).host;
  }
}

export function getSiteHostname() {
  try {
    return new URL(getSiteUrl()).hostname;
  } catch {
    return new URL(DEFAULT_SITE_URL).hostname;
  }
}
