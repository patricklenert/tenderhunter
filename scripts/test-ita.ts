import assert from "node:assert/strict";
import {
  mapItAusschreibungDetail,
  parseItAusschreibungDetail,
  parseItAusschreibungListing,
} from "../lib/public-tender-scraper";
import { projectPublicDisplayFields } from "../lib/public-content-quality";
import { getPublicSourceDefinition, inferPublicSourceKey, resolvePublicSourceKey } from "../lib/public-source-registry";
import { getTenderSourceDefinition } from "../lib/tender-sources";

const listingHtml = `
<html><body>
<a href="/ausschreibungen?page=2">2</a>
<article>
  <a href="https://www.it-ausschreibung.de/ausschreibung/144039/rahmenvertrag-it-dienstleistungen-fuer-die-schulen">Rahmenvertrag IT-Dienstleistungen für die Schulen</a>
  <p>Kurzbeschreibung A.</p>
</article>
<article>
  <a href="https://www.it-ausschreibung.de/ausschreibung/144044/rack-server-inkl-service">Rack-Server inkl. Service</a>
</article>
<article>
  <a href="https://www.it-ausschreibung.de/ausschreibung/144039/rahmenvertrag-it-dienstleistungen-fuer-die-schulen">Rahmenvertrag IT-Dienstleistungen für die Schulen</a>
</article>
<a href="https://www.it-ausschreibung.de/ausschreibung/144045/ab">ab</a>
</body></html>`;

const rows = parseItAusschreibungListing(listingHtml);
assert.deepEqual(rows.map((row) => row.id), ["144039", "144044"]);
assert.equal(rows[0].url, "https://www.it-ausschreibung.de/ausschreibung/144039/rahmenvertrag-it-dienstleistungen-fuer-die-schulen");
assert.ok(rows[0].title.startsWith("Rahmenvertrag IT-Dienstleistungen"), rows[0].title);

const detailHtml = `
<html><head><title>Ausschreibung für Auftrag: Entwicklung des KI-gestützten Arbeitswerkzeugs WirkCheck | IT-Ausschreibung</title></head>
<body>
<h3>Öffentliche Ausschreibung</h3>
<p>Entwicklung des KI-gestützten Arbeitswerkzeugs WirkCheck</p>
<h3>Gegenstand der Ausschreibung</h3>
<p>Die Leistung umfasst die fachlich-technische Konkretisierung, Entwicklung und Erprobung einer Webanwendung mit dokumentierter Programmierschnittstelle anhand eines Referenzfalls und zweier Erprobungsfälle sowie die erforderliche Dokumentation, technische Übergabe und Vorbereitung der Open-Source-Nachnutzung.</p>
<h3>Art des Auftrags</h3>
<p>Dienstleistung</p>
<h3>Erfüllungsort (Bundesland):</h3>
<p>Sachsen</p>
<h3>Auftraggeber</h3>
<address>04109 Leipzig</address>
<div class="col col-md-4">
  <strong>Eintragsdatum:</strong>
  07.10.2026
  <br>
  <span><strong>Angebotsfrist:</strong>
  26.10.2026</span>
</div>
</body></html>`;

const detail = parseItAusschreibungDetail(detailHtml);
assert.ok(detail, "Detail-Parse fehlgeschlagen");
assert.equal(detail.title, "Entwicklung des KI-gestützten Arbeitswerkzeugs WirkCheck");
assert.ok(detail.description.startsWith("Die Leistung umfasst"), detail.description);
assert.equal(detail.procedure, "Öffentliche Ausschreibung");
assert.equal(detail.contractType, "Dienstleistung");
assert.equal(detail.bundesland, "Sachsen");
assert.equal(detail.location, "Sachsen", "the labeled performance region must not be replaced by the buyer's address");
assert.equal(detail.deadlineText, "26.10.2026");

const detailUrl = "https://www.it-ausschreibung.de/ausschreibung/143782/entwicklung-des-ki-gestuetzten-arbeitswerkzeugs-wirkcheck";
const mapped = mapItAusschreibungDetail("143782", detail, detailUrl);
assert.ok(mapped, "Mapping fehlgeschlagen");
assert.equal(mapped.externalId, "143782");
assert.equal(mapped.source, "it-ausschreibung");
assert.equal(mapped.sourceUrl, detailUrl);
assert.equal(mapped.category, "IT-Dienstleistungen");
assert.equal(mapped.location, "Sachsen");
assert.ok(mapped.deadline, "Fehlende Deadline");
// parseDeadlineDate ohne Uhrzeit → 23:59:59 Europe/Berlin (26.10.2026 ist nach
// der DST-Umstellung CET = UTC+1 → 22:59:59 UTC).
assert.equal(new Date(mapped.deadline!).toISOString(), "2026-10-26T22:59:59.000Z");

// Die sichtbare Beschreibung muss die Pipeline-Validierung überleben
// (roher Fließtext → raw_text → qualifizierbar), trotz Login-gesperrter Details.
const display = projectPublicDisplayFields({
  title: mapped.title,
  client: mapped.client,
  location: mapped.location,
  summary: [mapped.description, mapped.scope],
});
assert.ok(display.description && display.description.length >= 40, JSON.stringify(display.description));
assert.equal(display.location, "Sachsen", "the shared public projection must preserve the sourced Erfüllungsort");

// Registry: Aliase, Host-Regel und SEO-Definition.
assert.equal(resolvePublicSourceKey("it-ausschreibung.de"), "it-ausschreibung");
assert.equal(resolvePublicSourceKey("it-ausschreibung"), "it-ausschreibung");
assert.equal(inferPublicSourceKey(null, detailUrl), "it-ausschreibung");
assert.equal(getPublicSourceDefinition("it-ausschreibung")?.label, "IT-Ausschreibung.de (Aggregator)");
assert.equal(getPublicSourceDefinition("it-ausschreibung")?.supportsContinuation, true);
assert.equal(getTenderSourceDefinition("it-ausschreibung.de")?.key, "it-ausschreibung");

console.log("test-ita: alle Pruefungen bestanden");
