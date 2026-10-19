/** Portal actions and authentication pages are navigation, not attachments. */
export function isPortalActionUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const pathname = new URL(value).pathname;
    return /\.do\/?$/i.test(pathname)
      || /(?:^|\/)(?:account\/(?:login|register)|login|signin|sign-in|signup|sign-up|register|sf_security_check)(?:\/|$)/i.test(pathname);
  } catch {
    const pathname = value.split(/[?#]/, 1)[0] ?? "";
    return /\.do\/?$/i.test(pathname)
      || /(?:^|\/)(?:account\/(?:login|register)|login|signin|sign-in|signup|sign-up|register|sf_security_check)(?:\/|$)/i.test(pathname);
  }
}
