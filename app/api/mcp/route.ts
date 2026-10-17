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
        description: "Durchsucht qualifizierte Ausschreibungen im aktuellen Tenderhunter-Index. Bekannte Fristen sind nicht abgelaufen, Einträge ohne bekannte Frist können enthalten sein; es gibt keine Vollständigkeitsgarantie für alle Vergabeportale. Filter: query, bundesland, city, category (Nur gültige Werte: Bauarbeiten, Tiefbau, TGA, Gebäudereinigung, Winterdienst, Immobilienverwaltung, Facility Management, Grünflächenpflege, Gartenarbeiten, Planungsleistungen, IT-Dienstleistungen, Lieferung, Sonstiges — Slugs wie it-dienstleistungen werden akzeptiert; unbekannte Werte wie 'IT' werden mit Fehler abgelehnt, nicht stillschweigend auf 0 gefiltert), smallVendorFitMin (0–100), Fristfilter, todayNew. Sortierung: deadline (Standard), newest oder smallVendorFit. Treffer enthalten contractValueMin/Max, procedureType, smallVendorFit sowie die heuristischen Hinweise lowEntryBarrier, remoteFriendly, isItDomain und isLot. Diese Hinweise ersetzen nicht die Prüfung der Originalunterlagen. Maximal 30 Treffer pro Suchanfrage. Der Standardzugang liefert maximal 50 Tender pro UTC-Kalendertag über alle MCP-Anfragen hinweg; ein persönlicher Bearer-Key hebt dieses Tageslimit auf.",
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
        description: "Prüft bis zu candidatePool Kandidaten anhand verfügbarer Ausschreibungsdokumente gegen profile.bidder (Hauptbieter; optional profile.partner für einen konkret benannten Partner). profile.partner.roles kann subcontractor, capacity_provider und/oder consortium_member enthalten; eine Rolle wird nur für passende, in den Unterlagen gefundene Kapazitätsregeln berücksichtigt. Nutze query plus bis zu 7 fokussierte searchQueries (z. B. verschiedene Leistungsbegriffe); die Suchanfragen werden zusammengeführt und dedupliziert. category akzeptiert nur die gültigen Werte der search_tenders-Beschreibung ('IT' und 'KI' sind keine Kategorien; für Software/IT kommt IT-Dienstleistungen infrage). Unbekannte Profilwerte weglassen statt zu erfinden. Das Ergebnis trennt Suchdiagnostik (no_candidates/evaluation_failed/partial/completed) von der Eignungsprüfung. no_barrier_found bedeutet nur, dass in den ausgewerteten Unterlagen keine der erkannten Muss-Hürden gefunden wurde; es ist weder technischer Fit noch Wirtschaftlichkeits- oder Zuschlagsprognose. Prüfe bei interessanten Treffern das Dossier und die Originalunterlagen; Partner-/Nachunternehmer- oder Eignungsleihe-Regeln müssen ausdrücklich passen. Die Suche umfasst nur aktuell im Index liegende qualifizierte Ausschreibungen; bekannte Fristen sind nicht abgelaufen, Einträge ohne bekannte Frist können enthalten sein. Quota: pro ausgegebenem Treffer; Zeitbudget 60 Sekunden. Ist das Ergebnis unvollständig (status partial/evaluation_failed/no_candidates), enthält retryHint den konkreten nächsten Schritt – folge ihm (einzelnen Kandidaten per get_tender_dossier isolieren, Lauf mit kleinerem Pool/ohne Kategorie wiederholen), statt 'kein Fit' oder 'keine Kandidaten' zu berichten.",
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
    instructions: "Tenderhunter bietet read-only Suche über qualifizierte Ausschreibungen im aktuellen Index. Bekannte Fristen sind nicht abgelaufen, unbekannte Fristen können vorkommen; es gibt keine vollständige Abdeckung aller deutschen Vergabeportale. Nutze für ein Firmenprofil mehrere präzise query/searchQueries statt nur eines engen Suchbegriffs und dedupliziere die zusammengeführten Kandidaten. Setze category nur auf erlaubte Kategorien (für Software/IT: IT-Dienstleistungen; 'KI' ist ein Suchbegriff, keine Kategorie). Verwende bei match_tenders profile.bidder für den tatsächlichen Hauptbieter und profile.partner nur für konkret benannte Partner; unbekannte Werte weglassen. Partnerrollen sind subcontractor, capacity_provider und consortium_member; gib nur tatsächlich geplante Rollen an, da der Matcher sie gegen die passenden dokumentierten Kapazitätsregeln prüft. Trenne technischen Leistungsfit, wirtschaftliche Tragfähigkeit und formale Eignung. no_barrier_found prüft nur erkannte Muss-Anforderungen in verfügbaren Dokumenten und ist keine Zuschlags- oder Bewerbungsempfehlung. Ein leerer Kandidatenpool bedeutet nur: keine Treffer in diesem Suchlauf/Index, nicht: es existiert keine passende Ausschreibung. Prüfe bei Kandidaten Dossier, Originalunterlagen, Frist, Auftragsscope, Wert, Daten-/Remote-Anforderungen und die ausdrückliche Zulässigkeit der Partnerrolle. Quota: search_tenders und match_tenders zählen pro ausgegebenem Treffer, get_tender_dossier und get_document_text zählen 1 je erfolgreichem Aufruf. Der Standardzugang ist auf 50 Einheiten pro UTC-Kalendertag über alle MCP-Anfragen begrenzt; ein persönlicher Bearer-Key hebt dieses Limit auf, die quota-Angabe zeigt dann unlimited: true. not_found bedeutet: in den geprüften Dokumenten nicht gefunden – nicht: nicht erforderlich. Umgehe keine Anmeldung und keine CAPTCHA-Sperren; nenne Einschränkungen aus limitations ausdrücklich.",
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
