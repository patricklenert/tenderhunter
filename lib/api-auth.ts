const API_KEY = process.env.TENDERHUNTER_API_KEY ?? "";

export function validateApiKey(request: Request): boolean {
  if (!API_KEY) return false;
  const header = request.headers.get("x-api-key") ?? "";
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
