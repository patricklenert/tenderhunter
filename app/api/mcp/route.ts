import { createMcpHandler } from "mcp-handler";
import {
  documentTextInputSchema,
  getDocumentTextForMcp,
  getTenderDossierForMcp,
  matchTendersForMcp,
  matchTendersInputSchema,
  tenderDossierInputSchema,
  type DocumentTextInput,
  type MatchTendersInput,
  type TenderDossierInput,
} from "@/lib/mcp/analysis";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { handleMcpOptions, withMcpCors } from "@/lib/mcp/http";
import {
  mcpTenderSearchSchema,
  searchMcpTenders,
  serializeMcpError,
  type McpTenderSearchInput,
} from "@/lib/mcp/tenders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runMcpTool(run: () => Promise<unknown>) {
  try {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(await run(), null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify(serializeMcpError(error), null, 2) }],
    };
  }
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_tenders",
      {
        title: "Tender suchen",
        description: "Durchsucht qualifizierte, noch offene deutsche Ausschreibungen. Filter: query, bundesland, city, category, smallVendorFitMin (0–100), Fristfilter, todayNew. Sortierung: deadline (Standard), newest oder smallVendorFit. Treffer enthalten zusätzlich procedureType, contractValueMin, externalId und smallVendorFit (null, wenn nicht bewertet). Der Standardzugang liefert maximal 50 Tender pro UTC-Kalendertag über alle MCP-Anfragen hinweg; ein persönlicher Bearer-Key hebt dieses Tageslimit auf.",
        inputSchema: mcpTenderSearchSchema,
      },
      async (input: McpTenderSearchInput, context) => runMcpTool(() => searchMcpTenders(input, {
        unlimitedQuota: context.http?.authInfo?.extra?.unlimitedQuota === true,
      })),
    );
    server.registerTool(
      "match_tenders",
      {
        title: "Tender gegen Firmenprofil prüfen",
        description: "Holt Kandidaten nach den Suchfiltern, sortiert nach smallVendorFit (bis candidatePool), und prüft jeden anhand der Ausschreibungsdokumente gegen profile.bidder (optional profile.partner). Ergebnis: die besten limit Treffer, sortiert nach verdict (no_barrier_found, unclear, barrier), dann smallVendorFit, dann Frist, mit checks und Belegen (quote, filename, page, documentId). not_found bedeutet: in den genannten Dokumenten nicht gefunden – nicht 'nicht erforderlich'. Quota: pro ausgegebenem Treffer; Zeitbudget 25 Sekunden.",
        inputSchema: matchTendersInputSchema,
      },
      async (input: MatchTendersInput, context) => runMcpTool(() => matchTendersForMcp(input, {
        unlimitedQuota: context.http?.authInfo?.extra?.unlimitedQuota === true,
      })),
    );
    server.registerTool(
      "get_tender_dossier",
      {
        title: "Tender-Dossier abrufen",
        description: "Liefert das Dossier einer Ausschreibung per tenderId, optional mit profile für die Eignungsprüfung. Quota: 1 je erfolgreichem Aufruf.",
        inputSchema: tenderDossierInputSchema,
      },
      async (input: TenderDossierInput, context) => runMcpTool(() => getTenderDossierForMcp(input, {
        unlimitedQuota: context.http?.authInfo?.extra?.unlimitedQuota === true,
      })),
    );
    server.registerTool(
      "get_document_text",
      {
        title: "Dokumenttext lesen",
        description: "Liest den Text eines Dokuments per documentId, seitenweise über page oder ab offset mit limit (max. 12000). Quota: 1 je erfolgreichem Aufruf.",
        inputSchema: documentTextInputSchema,
      },
      async (input: DocumentTextInput, context) => runMcpTool(() => getDocumentTextForMcp(input, {
        unlimitedQuota: context.http?.authInfo?.extra?.unlimitedQuota === true,
      })),
    );
  },
  {
    serverInfo: { name: "tenderhunter", version: "1.0.0" },
    instructions: "Tenderhunter stellt eine read-only Suche und Eignungsprüfung über qualifizierte, offene deutsche Ausschreibungen bereit. Nutze search_tenders, um Ausschreibungen zu finden, match_tenders, um die besten Kandidaten gegen ein Firmen- oder Partnerprofil zu prüfen, get_tender_dossier für das Dossier einer Ausschreibung und get_document_text für den Text einzelner Dokumente. Quota: search_tenders und match_tenders zählen pro ausgegebenem Treffer, get_tender_dossier und get_document_text zählen 1 je erfolgreichem Aufruf. Der Standardzugang ist auf 50 Einheiten pro UTC-Kalendertag über alle MCP-Anfragen begrenzt; ein persönlicher Bearer-Key hebt dieses Limit auf, die quota-Angabe zeigt dann unlimited: true. not_found bedeutet: in den geprüften Dokumenten nicht gefunden – nicht: nicht erforderlich. Umgehe keine Anmeldung und keine CAPTCHA-Sperren; nenne Einschränkungen aus limitations ausdrücklich.",
    maxSubscriptions: 0,
  },
);

async function handleRequest(request: Request): Promise<Response> {
  const optionsResponse = handleMcpOptions(request);
  if (optionsResponse) return optionsResponse;

  const access = authenticateMcpRequest(request);
  if (access instanceof Response) return withMcpCors(access);

  return withMcpCors(await mcpHandler(request));
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleMcpOptions(request) ?? new Response(null, { status: 204 });
}
