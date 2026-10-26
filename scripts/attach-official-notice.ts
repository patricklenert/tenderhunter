/**
 * Hängt die offizielle Bekanntmachungs-PDF (und optional eine Aggregator-
 * Zusammenfassung, z. B. tendigo.de) an einen bestehenden Tender an und
 * reiht die Textextraktion als Pipeline-Job ein.
 *
 * Nützlich, wenn die ursprüngliche Quelle (z. B. it-ausschreibung) nicht auf
 * das Originalportal verlinkt, aber die offizielle Bekanntmachung öffentlich
 * verfügbar ist (z. B. dtvp.de/cosinex, nicht IP-geblockt).
 *
 * Nutzung:
 *   npx tsx scripts/attach-official-notice.ts <tenderId> <pdfUrl> --notice-url <dtvpUrl> \
 *     [--deadline "12.11.2026 09:00"] [--pdf-name "CSX 21 - Bekanntmachung.pdf"] \
 *     [--summary-url <tendigoUrl>] [--summary-name "tendigo-zusammenfassung.md"]
 */
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { documents, tenders } from "../lib/schema";
import { saveBytes } from "../lib/storage";
import { extractViaParallel } from "../lib/parallel-extract";
import { parseDeadlineDate } from "../lib/date-utils";
import { enqueueJob } from "../lib/queue";
import { JOB_PARSE } from "../lib/types";
import { markCatalogDirty } from "../lib/catalog";

const argValue = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};

const run = async (): Promise<void> => {
  const tenderId = Number(process.argv[2]);
  const pdfUrl = process.argv[3];
  const noticeUrl = argValue("--notice-url");
  const deadlineRaw = argValue("--deadline");
  const pdfName = argValue("--pdf-name") ?? "bekanntmachung.pdf";
  const summaryUrl = argValue("--summary-url");
  const summaryName = argValue("--summary-name") ?? "aggregator-zusammenfassung.md";

  if (!Number.isFinite(tenderId) || tenderId <= 0 || !pdfUrl) {
    console.error("Nutzung: tsx scripts/attach-official-notice.ts <tenderId> <pdfUrl> [Optionen]");
    process.exit(1);
  }

  const tender = (await db.select({ id: tenders.id, url: tenders.url, version: tenders.version, metadataJson: tenders.metadataJson }).from(tenders).where(eq(tenders.id, tenderId)).limit(1))[0];
  if (!tender) {
    console.error(`Tender ${tenderId} nicht gefunden.`);
    process.exit(1);
  }

  // 1) Offizielle Bekanntmachungs-PDF laden und anhängen
  const alreadyPdf = await db.select({ id: documents.id }).from(documents).where(eq(documents.url, pdfUrl)).limit(1);
  if (!alreadyPdf[0]) {
    const response = await fetch(pdfUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", Accept: "application/pdf,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`PDF-Download fehlgeschlagen: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("PDF-Download lieferte 0 Bytes (Server braucht ggf. Browser-Session).");
    }
    const slugBase = pdfName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
    const stored = saveBytes(`tenders/${tenderId}/${slugBase}`, buffer, "application/pdf");
    await db.insert(documents).values({
      tenderId,
      url: pdfUrl,
      storagePath: stored.storagePath,
      sha256: stored.sha256,
      contentType: "application/pdf",
      filename: pdfName,
      downloadStatus: "downloaded",
      parseStatus: "pending",
      roleSource: "official_notice",
    }).onConflictDoNothing();
    console.log(`[attach] PDF gespeichert: ${stored.storagePath} (${buffer.length} bytes)`);
  } else {
    console.log("[attach] PDF bereits vorhanden.");
  }

  // 2) Optionale Aggregator-Zusammenfassung (klar als solche gelabelt)
  if (summaryUrl) {
    const alreadySummary = await db.select({ id: documents.id }).from(documents).where(eq(documents.url, summaryUrl)).limit(1);
    if (!alreadySummary[0]) {
      const extract = await extractViaParallel(summaryUrl, { fullContent: true, objective: "Ausschreibungszusammenfassung: Fristen, Kriterien, Eignungsanforderungen" });
      const markdown = (extract.fullContent ?? extract.excerpts.join("\n")).trim();
      if (markdown) {
        const stored = saveBytes(`tenders/${tenderId}/${summaryName}`, Buffer.from(markdown, "utf8"), "text/plain");
        const sha256 = createHash("sha256").update(markdown, "utf8").digest("hex");
        await db.insert(documents).values({
          tenderId,
          url: summaryUrl,
          storagePath: stored.storagePath,
          sha256,
          contentType: "text/plain",
          filename: summaryName,
          downloadStatus: "downloaded",
          parseStatus: "parsed",
          extractedText: markdown,
          role: "other",
          roles: ["other"],
          roleSource: "aggregator_summary",
          aiSummary: "Nicht-amtliche, automatisch erstellte Zusammenfassung eines Aggregators (Sekundärquelle). Maßgeblich ist die offizielle Bekanntmachung.",
        }).onConflictDoNothing();
        console.log(`[attach] Aggregator-Zusammenfassung gespeichert: ${stored.storagePath} (${markdown.length} Zeichen)`);
      }
    } else {
      console.log("[attach] Aggregator-Zusammenfassung bereits vorhanden.");
    }
  }

  // 3) Tender-Metadaten anreichern
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (noticeUrl && tender.url !== noticeUrl) {
    updates.url = noticeUrl;
  }
  const deadline = parseDeadlineDate(deadlineRaw);
  if (deadline) {
    updates.deadlineAt = deadline;
  }
  let metadata: Record<string, unknown> = {};
  try {
    metadata = typeof tender.metadataJson === "string" ? JSON.parse(tender.metadataJson) : (tender.metadataJson as Record<string, unknown>) ?? {};
  } catch { metadata = {}; }
  metadata.official_notice_url = noticeUrl ?? tender.url;
  metadata.enriched_at = new Date().toISOString();
  updates.metadataJson = JSON.stringify(metadata);
  await db.update(tenders).set(updates).where(eq(tenders.id, tenderId));
  console.log(`[attach] Tender aktualisiert (url=${noticeUrl ?? "unverändert"}, deadline=${deadlineRaw ?? "unverändert"})`);

  // 4) Textextraktion + Katalogsync anstoßen (pipeline_version ist Pflicht,
  // sonst überspringt runParseDocuments still als "veraltete Version")
  await enqueueJob(JOB_PARSE, { tender_id: tenderId, pipeline_version: tender.version }, { maxRetries: 2 });
  await markCatalogDirty();
  console.log(`[attach] parse_documents Job eingereiht (pipeline_version=${tender.version}), Katalog als geändert markiert.`);
  process.exit(0);
};

run().catch((error) => {
  console.error("[attach] Fehlgeschlagen:", error);
  process.exit(1);
});
