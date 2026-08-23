/** Java portal actions such as projectForwarding.do are pages, not attachments. */
export function isPortalActionUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return /\.do\/?$/i.test(new URL(value).pathname);
  } catch {
    return /\.do\/?$/i.test(value.split(/[?#]/, 1)[0] ?? "");
  }
}
