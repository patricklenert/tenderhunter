import assert from "node:assert/strict";
import type { CriteriaResult } from "../lib/tender-criteria";
import { extractNoticeText, splitPageMarkedText } from "../lib/tender-criteria-sources";
import {
  buildTenderDossier,
  deriveOpportunityStatus,
  mapRetrievalStatus,
  type DossierBuildInput,
  type DossierDocumentInput,
  type RetrievalStatus,
} from "../lib/tender-dossier";

const emptyCriteria: CriteriaResult = {
  findings: [],
  coverage: [],
  sourcesSearched: 0,
  documentsSearched: 0,
  limitations: [],
};

const NOTICE_TEXT = [
  "Bekanntmachung: Lieferung von Büromaterial.",
  "Angebotsfrist: 15.03.2026 bis 10:00 Uhr.",
  "Die Vergabe umfasst Lose 1 bis 3.",
  "Berichtigung: Der Termin für die Angebotsabgabe wurde verschoben.",
  "Aufhebung von Los 3 wurde beschlossen.",
].join("\n");

const RAW_TEXT = `${NOTICE_TEXT}\n\n[Dokument]\n[ROLLEN: eignung] [ROLLE: eignung] [DOKUMENT-ID: 11]\nBerichtigung: Abschnitt aus Dokument.`;

const DOC_11_TEXT = "[Seite 1]\nAllgemeine Angaben zum Verfahren.\n\n[Seite 2]\nDie Vergabe erfolgt am 01.04.2026 nach Prüfung.\n";

const ZIP_ENTRIES = [
  { name: "a.pdf", size: 1234, supported: true },
  { name: "b.exe", size: 99, supported: false },
];

const UPDATED_AT = new Date("2026-02-10T09:00:00.000Z");

const baseDocument = (overrides: Partial<DossierDocumentInput> & { id: number }): DossierDocumentInput => ({
  filename: null,
  url: null,
  sha256: `hash-${overrides.id}`,
  contentType: "application/pdf",
  extractedText: null,
  downloadStatus: "downloaded",
  parseStatus: "parsed",
  errorMessage: null,
  pageCount: null,
  role: "eignung",
  roles: ["eignung"],
  updatedAt: UPDATED_AT,
  ...overrides,
});

const documents: DossierDocumentInput[] = [
  baseDocument({ id: 11, filename: "leistung.pdf", extractedText: DOC_11_TEXT, pageCount: 2 }),
  baseDocument({
    id: 12,
    filename: "anlage.pdf",
    downloadStatus: "failed",
    parseStatus: "pending",
    errorMessage: "Dokument konnte nicht geladen werden: 404",
  }),
  baseDocument({
    id: 13,
    filename: "eignung.pdf",
    downloadStatus: "blocked",
    parseStatus: "pending",
    errorMessage: "401 Login erforderlich",
  }),
  baseDocument({ id: 14, filename: "leer.pdf", parseStatus: "empty" }),
  baseDocument({ id: 15, filename: "html.html", downloadStatus: "skipped", parseStatus: "empty" }),
  baseDocument({
    id: 16,
    filename: "unterlagen.zip",
    contentType: "application/zip",
    extractedText: "=== a.pdf ===\nBeispieltext ohne Seitenmarker.",
    zipEntries: ZIP_ENTRIES,
  }),
  baseDocument({ id: 17, filename: "kaputt.zip", contentType: "application/zip", parseStatus: "empty", zipEntries: null }),
  baseDocument({ id: 18, filename: "ohne-liste.zip", contentType: "application/zip", extractedText: "Inhalt ohne Liste." }),
];

const resources = [
  {
    url: "https://portal.example/doc/1.pdf",
    label: "Leistungsverzeichnis",
    resourceType: "document",
    status: "downloaded",
    errorMessage: null,
    sourcePageUrl: "https://portal.example/t/42",
    attempts: 1,
  },
  {
    url: "https://portal.example/doc/2.pdf",
    label: "Eignung",
    resourceType: "document",
    status: "failed",
    errorMessage: "403 Forbidden",
    sourcePageUrl: "https://portal.example/t/42",
    attempts: 2,
  },
  {
    url: "https://portal.example/doc/3.pdf",
    label: "Anhang",
    resourceType: "document",
    status: "discovered",
    errorMessage: null,
    sourcePageUrl: null,
    attempts: 0,
  },
  {
    url: "https://portal.example/doc/4.pdf",
    label: "Zusatz",
    resourceType: "document",
    status: "failed",
    errorMessage: `HTTP 500 ${"x".repeat(300)}`,
    sourcePageUrl: null,
    attempts: 3,
  },
];

const buildInput = (overrides: Partial<DossierBuildInput> = {}): DossierBuildInput => ({
  tender: {
    id: 42,
    title: "Büromaterial",
    source: "bund",
    url: "https://portal.example/t/42",
    externalId: "EXT-42",
    rawText: RAW_TEXT,
    deadlineAt: new Date("2026-03-20T08:00:00.000Z"),
    qualityStatus: "qualified",
    readinessStatus: "ready",
    readinessReason: null,
    contractValueMin: 1000,
    contractValueMax: 5000,
    contractDurationMonths: 24,
    procedureType: "offen",
    version: 3,
    firstSeenAt: new Date("2026-01-05T10:00:00.000Z"),
    lastSeenAt: new Date("2026-03-01T10:00:00.000Z"),
  },
  documents,
  resources,
  structured: { procurement: { cpv_codes: ["30192000-1", 7, "30197000-6"] } },
  criteria: { ...emptyCriteria, sourcesSearched: 3, documentsSearched: 2, limitations: ["Testlauf"] },
  match: null,
  now: new Date("2026-10-10T08:00:00.000Z"),
  ...overrides,
});

const statusCases: Array<{
  name: string;
  doc: Parameters<typeof mapRetrievalStatus>[0];
  expected: RetrievalStatus;
}> = [
  { name: "blocked without auth hint", doc: { downloadStatus: "blocked", parseStatus: "pending", errorMessage: "Tiefenanalyse: Netzwerkfehler" }, expected: "blockiert" },
  { name: "blocked with login hint", doc: { downloadStatus: "blocked", parseStatus: "pending", errorMessage: "401 Login erforderlich" }, expected: "anmeldung_noetig" },
  { name: "blocked with forbidden hint", doc: { downloadStatus: "blocked", parseStatus: "pending", errorMessage: "403 Forbidden" }, expected: "berechtigung_fehlt" },
  { name: "failed 404", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Dokument konnte nicht geladen werden: 404" }, expected: "nicht_gefunden" },
  { name: "failed login", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Anmeldung erforderlich" }, expected: "anmeldung_noetig" },
  { name: "failed 403", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Access denied" }, expected: "berechtigung_fehlt" },
  { name: "failed expired link", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Signature expired" }, expected: "link_abgelaufen" },
  { name: "failed generic", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Verbindung abgebrochen" }, expected: "download_fehlgeschlagen" },
  { name: "failed access page", doc: { downloadStatus: "failed", parseStatus: "pending", errorMessage: "Zugriffsblockierte Seite statt Dokument (participation_required)" }, expected: "blockiert" },
  { name: "skipped", doc: { downloadStatus: "skipped", parseStatus: "empty", errorMessage: null }, expected: "uebersprungen" },
  { name: "parsed", doc: { downloadStatus: "downloaded", parseStatus: "parsed", errorMessage: null }, expected: "erfolgreich" },
  { name: "empty", doc: { downloadStatus: "downloaded", parseStatus: "empty", errorMessage: null }, expected: "leer" },
  { name: "pending", doc: { downloadStatus: "downloaded", parseStatus: "pending", errorMessage: null }, expected: "parsen_ausstehend" },
  { name: "parse failed", doc: { downloadStatus: "downloaded", parseStatus: "failed", errorMessage: "Parserfehler" }, expected: "parsen_fehlgeschlagen" },
  { name: "ocr failed", doc: { downloadStatus: "downloaded", parseStatus: "failed", errorMessage: "OpenRouter Mistral-OCR fehlgeschlagen (500)" }, expected: "ocr_fehlgeschlagen" },
  { name: "unknown parse status", doc: { downloadStatus: "downloaded", parseStatus: "weird", errorMessage: null }, expected: "unbekannt" },
];

for (const testCase of statusCases) {
  assert.equal(mapRetrievalStatus(testCase.doc), testCase.expected, testCase.name);
}

const paged = "[Seite 1]\nEins\n\n[Seite 2]\nZwei\n\n[Seite 3]\nDrei";
const pagedSegments = splitPageMarkedText(paged);
assert.deepEqual(pagedSegments.map((segment) => segment.page), [1, 2, 3]);
assert.deepEqual(pagedSegments.map((segment) => segment.text), ["Eins", "Zwei", "Drei"]);
for (const segment of pagedSegments) {
  assert.ok(paged.includes(segment.text), `segment must be an exact substring: ${segment.text}`);
}
assert.deepEqual(splitPageMarkedText("Nur Text"), [{ page: null, text: "Nur Text" }]);
assert.deepEqual(splitPageMarkedText("Vorspann\n[Seite 1]\nEins"), [
  { page: null, text: "Vorspann" },
  { page: 1, text: "Eins" },
]);
assert.deepEqual(splitPageMarkedText("[Seite 1]\nEins"), [{ page: 1, text: "Eins" }]);

assert.equal(extractNoticeText(NOTICE_TEXT), NOTICE_TEXT);
assert.equal(extractNoticeText(RAW_TEXT), NOTICE_TEXT);
assert.equal(extractNoticeText("[ROLLEN: eignung] [DOKUMENT-ID: 3]\nText"), "");
assert.equal(extractNoticeText("Bekanntmachung\n[ROLLEN: eignung] [DOKUMENT-ID: 3]\nText"), "Bekanntmachung");
assert.equal(extractNoticeText(null), "");

const dossier = buildTenderDossier(buildInput());
const docById = (id: number) => dossier.documents.find((doc) => doc.documentId === id);

assert.equal(dossier.tender.id, 42);
assert.equal(dossier.tender.sourceUrl, "https://portal.example/t/42");
assert.equal(dossier.tender.externalId, "EXT-42");
assert.equal(dossier.tender.status.qualityStatus, "qualified");
assert.equal(dossier.tender.status.readinessStatus, "ready");
assert.equal(dossier.tender.status.readinessReason, null);
assert.deepEqual(dossier.tender.contract, {
  valueMin: 1000,
  valueMax: 5000,
  currency: "EUR",
  durationMonths: 24,
  procedureType: "offen",
});
assert.deepEqual(dossier.tender.cpvCodes, ["30192000-1", "30197000-6"]);
assert.equal(dossier.tender.version, 3);
assert.equal(dossier.tender.firstSeenAt, "2026-01-05T10:00:00.000Z");

assert.deepEqual(dossier.tender.deadline, {
  iso: "2026-03-15T10:00",
  originalText: "Angebotsfrist: 15.03.2026 bis 10:00",
  timezoneAssumed: "Europe/Berlin",
  timezoneNote: "angenommen: deutsche Vergabestelle, nicht aus der Quelle",
});

assert.equal(dossier.tender.lots.mentioned, true);
assert.ok(dossier.tender.lots.quote?.includes("Lose 1"), "lot quote must name the lot");

assert.deepEqual(
  dossier.documents.map((doc) => [doc.documentId, doc.status]),
  [
    [11, "erfolgreich"],
    [12, "nicht_gefunden"],
    [13, "anmeldung_noetig"],
    [14, "leer"],
    [15, "uebersprungen"],
    [16, "erfolgreich"],
    [17, "leer"],
    [18, "erfolgreich"],
  ],
);
assert.equal(docById(12)?.statusDetail, "Dokument konnte nicht geladen werden: 404");
assert.equal(docById(11)?.statusDetail, "Text extrahiert.");
assert.equal(docById(11)?.updatedAt, "2026-02-10T09:00:00.000Z");
assert.equal(docById(11)?.pagesDetected, true);
assert.equal(docById(11)?.textChars, DOC_11_TEXT.length);
assert.equal(docById(16)?.pagesDetected, false);
assert.deepEqual(docById(16)?.zipEntries, ZIP_ENTRIES);
assert.equal(docById(18)?.zipEntries, undefined);

assert.deepEqual(dossier.resources.byStatus, { downloaded: 1, failed: 2, discovered: 1 });
assert.equal(dossier.resources.total, 4);
assert.equal(dossier.resources.items.length, 4);
assert.equal(dossier.resources.items[3].errorMessage?.length, 200);

assert.equal(dossier.access.blocked, true);
assert.ok(dossier.access.notes.includes("Anmeldung nötig laut Abruf von eignung.pdf"));
assert.ok(dossier.access.notes.includes("Berechtigung fehlt laut Abruf von Eignung"));

const vergabe = dossier.changeNotices.find((notice) => notice.type === "vergabe");
assert.deepEqual(vergabe?.source, { documentId: 11, filename: "leistung.pdf", page: 2 });
assert.equal(vergabe?.quote, "Die Vergabe erfolgt am 01.04.2026 nach Prüfung.");
assert.ok(
  dossier.changeNotices.some((notice) => notice.type === "berichtigung" && notice.source.documentId === null),
  "berichtigung from the notice must be reported",
);
assert.ok(
  dossier.changeNotices.some((notice) => notice.type === "aufhebung" && notice.source.documentId === null),
  "aufhebung from the notice must be reported",
);
assert.ok(
  !dossier.changeNotices.some((notice) => notice.quote.includes("Abschnitt aus Dokument")),
  "appended document sections of rawText must not count as notice",
);

assert.deepEqual(dossier.criteria, buildInput().criteria);
assert.equal(dossier.match, null);
assert.equal(dossier.retrievedAt, "2026-10-10T08:00:00.000Z");

for (const limitation of [
  "Änderungsverlauf nicht gespeichert: nur aktueller Stand und version-Feld.",
  "Seitenangaben nur bei Dokumenten mit [Seite n]-Markern.",
  "Dokumente ohne Status erfolgreich liefern keinen Kriterienbeleg.",
  "5 von 8 Dokumenten nicht erfolgreich verarbeitet; ihr Inhalt fehlt in der Prüfung.",
  "ZIP-Inhalt nicht lesbar: kaputt.zip",
  "1 ZIP-Archiv(e) ohne Inhaltsliste; deren Dateien wurden nicht geprüft.",
]) {
  assert.ok(dossier.limitations.includes(limitation), `missing limitation: ${limitation}`);
}

const sourceTextOf = (documentId: number | null): string =>
  documentId === null ? RAW_TEXT : documents.find((doc) => doc.id === documentId)?.extractedText ?? "";
for (const notice of dossier.changeNotices) {
  assert.ok(sourceTextOf(notice.source.documentId).includes(notice.quote), `quote must be exact: ${notice.quote}`);
}
assert.ok(RAW_TEXT.includes(dossier.tender.lots.quote ?? ""), "lots quote must be exact");
assert.ok(RAW_TEXT.includes(dossier.tender.deadline.originalText ?? ""), "deadline original text must be exact");

const noLots = buildTenderDossier(
  buildInput({
    tender: { ...buildInput().tender, rawText: "Die nahtlose Integration ist ohne Teilnehmerlose vorgesehen." },
    documents: [],
    resources: [],
  }),
);
assert.equal(noLots.tender.lots.mentioned, false);

const clean = buildTenderDossier(
  buildInput({
    tender: { ...buildInput().tender, rawText: null, deadlineAt: new Date("2026-03-20T08:00:00.000Z") },
    documents: [baseDocument({ id: 21, extractedText: "Nur ein Dokument ohne Auffälligkeiten." })],
    resources: [],
    structured: null,
  }),
);
assert.equal(clean.access.blocked, false);
assert.deepEqual(clean.access.notes, []);
assert.equal(clean.tender.deadline.iso, "2026-03-20T08:00:00.000Z");
assert.equal(clean.tender.deadline.timezoneNote, "UTC aus Datenbank");
assert.equal(clean.tender.deadline.originalText, null);
assert.equal(clean.tender.lots.mentioned, false);
assert.deepEqual(clean.tender.cpvCodes, []);
assert.deepEqual(clean.resources.byStatus, {});

const readinessBlocked = buildTenderDossier(
  buildInput({
    tender: { ...buildInput().tender, readinessStatus: "blocked", readinessReason: "Dokument- oder Quellzugriff ist blockiert." },
    documents: [],
    resources: [],
  }),
);
assert.equal(readinessBlocked.access.blocked, true);
assert.deepEqual(readinessBlocked.access.notes, ["Dokument- oder Quellzugriff ist blockiert."]);
assert.ok(readinessBlocked.limitations.includes("Keine Dokumente gespeichert; die Prüfung beschränkt sich auf die Bekanntmachung."));

const duplicated = buildTenderDossier(
  buildInput({
    tender: { ...buildInput().tender, rawText: null },
    documents: [
      baseDocument({ id: 31, extractedText: "Die Aufhebung erfolgt sofort." }),
      baseDocument({ id: 32, extractedText: "Die Aufhebung erfolgt sofort." }),
    ],
    resources: [],
  }),
);
assert.equal(duplicated.changeNotices.filter((notice) => notice.type === "aufhebung").length, 1);

const missingFile = buildTenderDossier(
  buildInput({
    documents: [
      baseDocument({
        id: 51,
        downloadStatus: "failed",
        parseStatus: "failed",
        errorMessage: "ENOENT: no such file or directory, open '/app/data/object_store/tenders/1/x'",
      }),
    ],
    resources: [],
  }),
);
assert.equal(missingFile.documents[0].status, "download_fehlgeschlagen");
assert.equal(missingFile.documents[0].statusDetail, "Datei nicht im Speicher vorhanden.");

const flood = buildTenderDossier(
  buildInput({
    documents: [
      baseDocument({
        id: 41,
        extractedText: Array.from({ length: 30 }, (_, index) => `Berichtigung ${index} wurde veröffentlicht.`).join("\n"),
      }),
    ],
  }),
);
assert.equal(flood.changeNotices.length, 25);
assert.ok(flood.limitations.includes("Änderungshinweise auf 25 begrenzt."));

const OPEN_NOW = new Date("2026-10-10T08:00:00Z");
const DEADLINE = "2026-11-02T12:00";
assert.equal(deriveOpportunityStatus([{ type: "vergabe" }], DEADLINE, OPEN_NOW).status, "vergeben");
assert.equal(deriveOpportunityStatus([{ type: "vergabe" }, { type: "aufhebung" }], DEADLINE, OPEN_NOW).status, "aufgehoben");
assert.equal(deriveOpportunityStatus([{ type: "berichtigung" }], DEADLINE, OPEN_NOW).status, "geändert");
assert.equal(deriveOpportunityStatus([], DEADLINE, OPEN_NOW).status, "offen");
assert.equal(deriveOpportunityStatus([], "2026-09-01T12:00", OPEN_NOW).status, "unklar");
assert.equal(deriveOpportunityStatus([], null, OPEN_NOW).status, "unklar");
// Konstatierende Aufhebung im Quoten-Kontext -> aufgehoben
assert.equal(
  deriveOpportunityStatus([{ type: "aufhebung", quote: "Das Vergabeverfahren wurde hiermit aufgehoben." }], DEADLINE, OPEN_NOW).status,
  "aufgehoben",
);
// Informationshafte Rechtsformel in Unterlagen -> weiterhin offen
assert.equal(
  deriveOpportunityStatus(
    [{ type: "aufhebung", quote: "…Zuschlagserteilung sowie gegebenenfalls über die Aufhebung des Verfahrens. Auf Verlangen…" }],
    DEADLINE,
    OPEN_NOW,
  ).status,
  "offen",
);
// Konditionale Formulierung -> weiterhin offen
assert.equal(
  deriveOpportunityStatus([{ type: "aufhebung", quote: "Der Auftraggeber kann das Verfahren aufheben, soweit…" }], DEADLINE, OPEN_NOW).status,
  "offen",
);
// "Die Vergabe erfolgt im Wege der Verhandlungsvergabe" ist kein Zuschlagshinweis
assert.equal(
  deriveOpportunityStatus(
    [{ type: "vergabe", quote: "Die Vergabe erfolgt im Wege der Verhandlungsvergabe mit Teilnahmewettbewerb." }],
    DEADLINE,
    OPEN_NOW,
  ).status,
  "offen",
);
// echter Zuschlagshinweis -> vergeben
assert.equal(
  deriveOpportunityStatus([{ type: "vergabe", quote: "Der Zuschlag wurde am 01.11.2026 erteilt." }], DEADLINE, OPEN_NOW).status,
  "vergeben",
);
// DSGVO-"Recht auf Berichtigung" ist keine Berichtigung der Ausschreibung
assert.equal(
  deriveOpportunityStatus(
    [{ type: "berichtigung", quote: "Recht auf Berichtigung, Löschung, Einschränkung der Verarbeitung personenbezogener Daten" }],
    DEADLINE,
    OPEN_NOW,
  ).status,
  "offen",
);
// echte Berichtigung -> geändert
assert.equal(
  deriveOpportunityStatus(
    [{ type: "berichtigung", quote: "Berichtigung der Ausschreibung: Fristverlängerung bis 15.12.2026." }],
    DEADLINE,
    OPEN_NOW,
  ).status,
  "geändert",
);
console.log("tender-dossier passed.");
