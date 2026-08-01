import { errorResponse, json } from "@/lib/http";
import { BidPackError, getBidPackForUser } from "@/lib/bid-packs";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }
const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const csv = (value: unknown): string => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
const filename = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "bid-pack";
const handleError = (error: unknown): Response => error instanceof BidPackError
  ? json({ error: error.message, code: error.code }, { status: error.status })
  : errorResponse(error);

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const id = parseId((await params).id);
    if (id === null) return json({ error: "ungueltige ID" }, { status: 400 });
    const pack = await getBidPackForUser(sessionOrResponse.session.user.id, id);
    const format = new URL(request.url).searchParams.get("format") ?? "markdown";
    const baseName = filename(pack.title);

    if (format === "csv") {
      const rows = [
        ["Typ", "Status", "Titel", "Quelle", "Pflicht", "Nachweise", "Verantwortlich", "Frist"].join(";"),
        ...pack.requirements.map((requirement) => [
          "Anforderung",
          requirement.status,
          requirement.title,
          requirement.source,
          requirement.isMandatory ? "Ja" : "Nein",
          requirement.evidence.map((item) => item.title).join(" | "),
          "",
          "",
        ].map(csv).join(";")),
        ...pack.tasks.map((task) => [
          "Aufgabe",
          task.status,
          task.title,
          task.source,
          "",
          "",
          task.assignee,
          task.dueAt,
        ].map(csv).join(";")),
      ].join("\n");
      return new Response(`\ufeff${rows}`, {
        headers: {
          "cache-control": "no-store",
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${baseName}-bid-pack.csv"`,
        },
      });
    }

    if (format !== "markdown") return json({ error: "format muss markdown oder csv sein" }, { status: 400 });
    const markdown = [
      `# Bid Pack: ${pack.title}`,
      "",
      `- Entscheidung: **${pack.decisionStatus}**`,
      `- Quelle: ${pack.source}`,
      `- Abgabefrist: ${pack.submissionDeadlineAt ?? "nicht erkannt"}`,
      `- Passung: ${Math.round(pack.analysis.fit)}%`,
      `- Indikative Gewinnchance: ${Math.round(pack.analysis.winProbability)}%`,
      `- Anforderungsdeckung: ${Math.round(pack.analysis.requirementCoverage * 100)}%`,
      `- Aufwand: ${Math.round(pack.analysis.effort)}%`,
      "",
      "## Entscheidungshinweis",
      pack.analysis.explanation ?? "Keine Erklärung vorhanden.",
      "",
      "## Anforderungen",
      ...pack.requirements.map((requirement) => {
        const evidence = requirement.evidence.map((item) => item.title).join(", ") || "kein Nachweis verknüpft";
        return `- [${requirement.status}] ${requirement.isMandatory ? "**Pflicht:** " : ""}${requirement.title} _(Quelle: ${requirement.source}; Nachweise: ${evidence})_`;
      }),
      "",
      "## Nächste Schritte",
      ...pack.tasks.map((task) => `- [${task.status}] ${task.title}${task.assignee ? ` (${task.assignee})` : ""}${task.dueAt ? ` bis ${task.dueAt}` : ""}`),
      "",
      "## Hinweis",
      "Dieser Bid Pack ist eine Arbeitsgrundlage und kein rechtsverbindliches Angebot.",
    ].join("\n");
    return new Response(markdown, {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${baseName}-bid-pack.md"`,
      },
    });
  } catch (error) { return handleError(error); }
}
