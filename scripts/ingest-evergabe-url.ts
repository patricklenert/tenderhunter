/**
 * Ingestiert eine einzelne evergabe.de-Vergabe (Unterlagenseite) in die Datenbank:
 * Tender anlegen/aktualisieren, Unterlagen über die Parallel-Extract-API laden
 * (evergabe.de blockiert Server-IPs mit 403) und die Dokumenttexte speichern.
 *
 * Nutzung:
 *   DATABASE_URL=... npx tsx scripts/ingest-evergabe-url.ts <evergabe-url> [--category "IT-Dienstleistungen"]
 *
 * Beispiel:
 *   npx tsx scripts/ingest-evergabe-url.ts https://www.evergabe.de/unterlagen/3471766/zustellweg-auswaehlen
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { documents, tenders } from "../lib/schema";
import {
  extractEvergabeDocumentText,
  fetchEvergabeUnterlagenPageViaParallel,
  isEvergabeUrl,
} from "../lib/parallel-extract";
import { saveBytes } from "../lib/storage";
import { classifyDocumentRole } from "../lib/document-classifier";
import { generateDocumentSummary } from "../lib/document-summary";
import { generateTenderSlug } from "../lib/tender-slug";
import { parseDeadlineDate } from "../lib/date-utils";
import { markCatalogDirty } from "../lib/catalog";

const trimText = (value: string | null | undefined, max: number): string | null => {
  const text = (value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

const extractFromPattern = (text: string, pattern: RegExp): string | null => {
  const match = text.match(pattern);
  return match ? match[1].trim().slice(0, 300) : null;
};

const run = async (): Promise<void> => {
  const inputUrl = process.argv[2];
  if (!inputUrl || !isEvergabeUrl(inputUrl)) {
    console.error("Bitte eine evergabe.de-URL übergeben, z. B. https://www.evergabe.de/unterlagen/3471766");
    process.exit(1);
  }
  const categoryIndex = process.argv.indexOf("--category");
  const category = categoryIndex > -1 ? process.argv[categoryIndex + 1] : null;

  const normalizedUrl = (inputUrl.match(/https:\/\/www\.evergabe\.de\/unterlagen\/\d+/i)?.[0] ?? inputUrl).replace(/\/$/, "");
  const externalId = normalizedUrl.match(/unterlagen\/(\d+)/i)?.[1] ?? null;
  if (!externalId) {
    console.error("Konnte keine Vergabe-ID aus der URL lesen.");
    process.exit(1);
  }

  console.log(`[ingest] Lade Unterlagenseite über Parallel: ${normalizedUrl}`);
  const page = await fetchEvergabeUnterlagenPageViaParallel(normalizedUrl);
  const documentLinks = page.documents;
  if (documentLinks.length === 0) {
    console.error("Keine Dokumente auf der Unterlagenseite gefunden.");
    process.exit(1);
  }

  // Offizieller Titel aus der Seitenüberschrift, z. B.
  // "## Teilnahmewettbewerbsunterlage Tourismus, Freizeit & Kultur GmbH Kühlungsborn: Rahmenvertrag …"
  const pageTitle = page.markdown.match(/^##+\s+(?:Teilnahmewettbewerbsunterlage|Vergabeunterlagen:?)\s*(.+)$/im)?.[1]?.trim()
    ?? page.markdown.match(/^##+\s+(.{20,240})$/im)?.[1]?.trim()
    ?? null;

  // Tender anlegen oder aktualisieren
  const existing = await db.select({ id: tenders.id, version: tenders.version }).from(tenders).where(eq(tenders.url, normalizedUrl)).limit(1);
  let tenderId: number;
  let firstDocText = "";

  if (existing[0]) {
    tenderId = existing[0].id;
    await db.update(tenders).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(tenders.id, tenderId));
    console.log(`[ingest] Tender existiert bereits: id=${tenderId}`);
  } else {
    const inserted = await db.insert(tenders).values({
      source: "evergabe-de",
      url: normalizedUrl,
      externalId,
      title: pageTitle ?? `evergabe.de Vergabe ${externalId}`,
      slug: pageTitle ? generateTenderSlug(pageTitle) : null,
      rawText: null,
      metadataJson: JSON.stringify({
        scraper: "evergabe-parallel-ingest",
        discovered_at: new Date().toISOString(),
      }),
    }).returning({ id: tenders.id });
    tenderId = inserted[0].id;
    console.log(`[ingest] Tender angelegt: id=${tenderId}`);
  }

  // Dokumente laden und Text extrahieren
  let docIndex = 0;
  for (const link of documentLinks) {
    docIndex += 1;
    const alreadyThere = await db.select({ id: documents.id }).from(documents).where(eq(documents.url, link.url)).limit(1);
    if (alreadyThere[0]) {
      console.log(`[ingest] Dokument ${docIndex}/${documentLinks.length} bereits vorhanden: ${link.filename ?? link.url}`);
      continue;
    }
    try {
      const { text, pageCount } = await extractEvergabeDocumentText(link.url);
      if (!firstDocText) firstDocText = text;

      const filename = link.filename ?? `evergabe-${externalId}-${docIndex}.pdf`;
      const relative = `tenders/${tenderId}/${docIndex}-${filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.pdf$/i, "")}.txt`;
      const stored = saveBytes(relative, Buffer.from(text, "utf8"), "text/plain");
      const classification = classifyDocumentRole({ filename, url: link.url, textSample: text });

      let aiSummary: string | null = null;
      try {
        aiSummary = await generateDocumentSummary({ filename, role: classification.role, extractedText: text });
      } catch (summaryError) {
        console.warn(`[ingest] KI-Zusammenfassung fehlgeschlagen (${filename}):`, summaryError instanceof Error ? summaryError.message : summaryError);
      }

      await db.insert(documents).values({
        tenderId,
        url: link.url,
        storagePath: stored.storagePath,
        sha256: stored.sha256,
        contentType: "text/plain",
        filename,
        downloadStatus: "downloaded",
        parseStatus: "parsed",
        errorMessage: null,
        pageCount,
        extractedText: text,
        role: classification.role,
        roles: classification.roles,
        roleSource: "evergabe_parallel",
        roleConfidence: classification.confidence,
        aiSummary,
      }).onConflictDoNothing();
      console.log(`[ingest] Dokument ${docIndex}/${documentLinks.length} gespeichert: ${filename} (${text.length} Zeichen, Rolle: ${classification.role})`);
    } catch (docError) {
      console.warn(`[ingest] Dokument ${docIndex}/${documentLinks.length} fehlgeschlagen (${link.filename ?? link.url}):`, docError instanceof Error ? docError.message : docError);
    }
  }

  // Tender-Metadaten aus Seitentitel und Dokumenttexten anreichern
  // Bei bereits vorhandenen Dokumenten den Text aus der DB nachladen.
  if (!firstDocText) {
    const existingDoc = await db
      .select({ extractedText: documents.extractedText })
      .from(documents)
      .where(eq(documents.tenderId, tenderId))
      .orderBy(documents.id)
      .limit(1);
    firstDocText = existingDoc[0]?.extractedText ?? "";
  }
  // Parallel liefert Markdown mit Escape-Sequenzen (11\.11\.2026, **fett**) – für
  // die Metadaten-Extraktion zunächst normalisieren.
  const plainDocText = firstDocText
    .replace(/\\([.,()*_[\]()#~`>;"'|~-])/g, "$1")
    .replace(/\*\*/g, "");
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (pageTitle || plainDocText) {
    const title = pageTitle
      ?? extractFromPattern(plainDocText, /Vergabe einer ([^\n*|]{15,220})/i)
      ?? extractFromPattern(plainDocText, /(?:^|\n)\s*\**([^\n*|]*(?:Rahmenvertrag|Weiterentwicklung|Betreuung)[^\n*|]{10,180})/i);
    const fristMatch = plainDocText.match(/(?:Ablauf der Teilnahmefrist|Teilnahmefrist|Angebotsfrist|Abgabe von)[^0-9]{0,150}?(\d{1,2}\.\d{1,2}\.\d{4})(?:,?\s*(\d{1,2}:\d{2})\s*Uhr)?/i);
    const fristDate = fristMatch?.[1] ?? pageTitle?.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)?.[1] ?? null;
    const deadline = parseDeadlineDate(fristDate ? `${fristDate}${fristMatch?.[2] ? ` ${fristMatch[2]}` : ""}` : null);
    const procedure = extractFromPattern(plainDocText, /(Verhandlungsvergabe[^()\n]{0,120}?UVgO|Offenes Verfahren[^()\n]{0,60})/i);

    if (title) {
      updates.title = title;
      updates.slug = generateTenderSlug(title);
    }
    if (deadline) updates.deadlineAt = deadline;
    if (procedure) updates.procedureType = procedure;
    if (category) updates.category = category;
    updates.qualityStatus = "qualified";
    updates.qualityReason = "evergabe-parallel-ingest";
    if (plainDocText) updates.rawText = trimText(plainDocText, 100_000);
    updates.metadataJson = JSON.stringify({
      scraper: "evergabe-parallel-ingest",
      discovered_at: new Date().toISOString(),
      vergabe_id: externalId,
      unterlagen_seite: normalizedUrl,
      dokumente: documentLinks.map((d) => d.filename ?? d.url),
    });
  }
  await db.update(tenders).set(updates).where(eq(tenders.id, tenderId));
  await markCatalogDirty();

  console.log(`[ingest] Fertig: tender_id=${tenderId}, ${documentLinks.length} Unterlagen verarbeitet.`);
  process.exit(0);
};

run().catch((error) => {
  console.error("[ingest] Fehlgeschlagen:", error);
  process.exit(1);
});
