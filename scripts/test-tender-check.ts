import assert from "node:assert/strict";
import { buildTenderCheck } from "../lib/tender-check";
import { buildTenderCalendarIcs, calendarFilename } from "../lib/tender-calendar";

const completeDocuments = [
  {
    id: 101,
    filename: "Bekanntmachung.pdf",
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 1]\nAbgabefrist: 15.08.2026, 10:00 Uhr\nMit dem Angebot einzureichen ist die Eigenerklärung. Mindestens drei Referenzen sind vorzulegen. Vertragslaufzeit: 12 Monate. Bindefrist bis 30.08.2026. Preis 60 %.",
    pageCount: 1,
    roleConfidence: 0.9,
  },
  {
    id: 102,
    filename: "Leistungsbeschreibung.pdf",
    role: "leistungsbeschreibung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 3]\nAbgabefrist: 20.08.2026, 10:00 Uhr\nVertragslaufzeit: 24 Monate. Qualität 40 %.",
    pageCount: 3,
    roleConfidence: 0.9,
  },
];

const structured = {
  decision_relevant: {
    mandatory_documents: ["Eigenerklärung", "Eigenerklärung"],
    requirements: ["Technische Beschreibung"],
  },
  procurement: {
    participation_requirements: ["Mindestens drei Referenzen"],
  },
};

const check = buildTenderCheck({
  tenderId: 1,
  tenderDeadlineAt: new Date("2026-08-15T10:00:00.000+02:00"),
  structured,
  documents: completeDocuments,
});

assert.equal(check.version, 1);
assert.equal(check.status, "complete");
assert.equal(check.coverage.parsed, 2);
assert.equal(check.checklist.length, 3);
assert.equal(new Set(check.checklist.map((item) => item.key)).size, 3);
assert.ok(check.checklist.every((item) => item.source?.documentId));
assert.ok(check.risks.some((risk) => risk.title === "Abgabefristen unterscheiden sich"));
assert.ok(check.risks.some((risk) => risk.title === "Vertragsdauer prüfen"));
assert.ok(!check.risks.some((risk) => risk.title === "Bewertung prüfen"));
assert.ok(check.events.some((event) => event.type === "submission"));
assert.ok(check.events.some((event) => event.type === "validity"));

const partialCheck = buildTenderCheck({
  tenderId: 2,
  tenderDeadlineAt: new Date("2026-08-15T10:00:00.000+02:00"),
  structured: { decision_relevant: { mandatory_documents: ["Bekanntmachung"] } },
  documents: [
    completeDocuments[0],
    {
      id: 103,
      filename: "Duplikat.pdf",
      role: "bekanntmachung",
      parseStatus: "failed",
      downloadStatus: "failed",
      errorMessage: "Download fehlgeschlagen",
      extractedText: null,
      pageCount: null,
      roleConfidence: 0.8,
    },
  ],
});

assert.equal(partialCheck.status, "partial");
assert.equal(partialCheck.coverage.parsed, 1);
assert.equal(partialCheck.coverage.failed, 1);
assert.equal(partialCheck.risks.length, 0);
assert.ok(partialCheck.limitations.length > 0);

// Regression: escaping must happen after truncation so a trailing backslash
// cannot produce an invalid RegExp during SSR.
const boundaryTitle = `Dokument mit ${"x".repeat(106)}\\`;
const boundaryCheck = buildTenderCheck({
  tenderId: 4,
  tenderDeadlineAt: null,
  structured: { decision_relevant: { mandatory_documents: [boundaryTitle] } },
  documents: [{
    id: 104,
    filename: "Anlage.pdf",
    role: "anlage",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "Dokument mit einer Anlage und weiteren Angaben.",
    pageCount: 1,
    roleConfidence: 0.8,
  }],
});
assert.equal(boundaryCheck.checklist.length, 1);

const noDocuments = buildTenderCheck({
  tenderId: 3,
  tenderDeadlineAt: null,
  structured: {},
  documents: [],
});

assert.equal(noDocuments.status, "unknown");
assert.equal(noDocuments.events.length, 0);
assert.equal(noDocuments.nextEvent, null);
assert.ok(noDocuments.limitations.includes("Es liegen noch keine prüfbaren Dokumente vor."));

const calendar = buildTenderCalendarIcs({
  tenderId: 7,
  title: "Test, Ausschreibung; Berlin",
  url: "https://example.test/tender/7",
  events: [{
    key: "submission:test",
    type: "submission",
    title: "Abgabe des Angebots",
    startsAt: "2026-08-15T10:00:00.000Z",
    datePrecision: "minute",
    source: null,
  }],
  now: new Date("2026-08-01T00:00:00.000Z"),
});

assert.match(calendar, /BEGIN:VCALENDAR/);
assert.match(calendar, /BEGIN:VEVENT/);
assert.match(calendar, /SUMMARY:Abgabe des Angebots - Test\\, Ausschreibung\\; Berlin/);
assert.match(calendar, /DTSTART:20260815T100000Z/);
assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
assert.equal(calendarFilename("Ämter, Berlin / 2026"), "amter-berlin-2026");

console.log("Tender check tests passed.");
