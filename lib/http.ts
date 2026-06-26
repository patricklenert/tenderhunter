import { ZodError } from "zod";

export const json = (payload: unknown, init?: ResponseInit): Response =>
  Response.json(payload, {
    headers: {
      "cache-control": "no-store"
    },
    ...init
  });

export const parseJsonBody = async <T>(request: Request): Promise<T> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Request muss application/json sein");
  }
  return (await request.json()) as T;
};

export const errorResponse = (error: unknown): Response => {
  if (error instanceof ZodError) {
    return json(
      {
        error: "ungueltige Nutzdaten",
        details: error.flatten()
      },
      { status: 422 }
    );
  }

  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  return json({ error: message }, { status: 400 });
};
