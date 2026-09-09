import {
  buildPublicAccessLimitedDescriptionMarkdown,
  cleanPublicDescription,
  extractPublicPortalFacts,
  isPublicNavigationSummary,
  isRawPortalDescription,
  pickPublicDescription,
} from "@/lib/public-tender-scraper";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import {
  isCanonicalPublicDescriptionMarkdown,
  isPdfFormBoilerplate,
  normalizePublicDisplayCandidate,
  pickValidatedPublicClient,
  pickValidatedPublicCandidate,
  pickValidatedPublicLocation,
  pickValidatedPublicLocationForTender,
} from "@/lib/public-content-quality";
import { readPublicTenderMeta } from "@/lib/tender-meta";

const rawPortalText = "(Bekanntmachung Öffentliche Ausschreibung) a)Öffentlicher Auftraggeber (Vergabestelle) NameGrün und Gruga StraßeLührmannstraße 82 Telefon0201 Fax0201";
const cleanText = "Die Stadt beauftragt die Ausführung von Wegebauarbeiten im öffentlichen Raum.";
const participationWallText =
  "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen. Bestätigen Sie die Teilnahme am Verfahren um folgende Vorteile nutzen zu können. Vergabeart: Offenes Verfahren. Abgabefrist 03.08.2026.";
const legitTeilnahmeText =
  "Offenes Verfahren. Die Teilnahmeunterlagen können heruntergeladen werden. Teilnahmefrist: 30.06.2026.";
const bundNavigation = [
  "SERVICE.BUND.DE - Aktuelle Ausschreibungen",
  "Haupt-Navigations-Menü",
  "Meta-Navigation",
  "Andere Ausschreibungen im Bereich",
].join("\n");
const bundFactsText = [
  "Vergabestelle: Stadt Coburg",
  "Vergabeart",
  "Öffentliche Ausschreibung",
  "Angebotsfrist",
  "14.08.2026 10:00",
  "Erfüllungsort",
  "96274 Itzgrund Bayern",
  "Karte anschauen",
].join("\n");

if (!isRawPortalDescription(rawPortalText)) {
  throw new Error("Roher Portaltext wurde nicht erkannt");
}
if (!isRawPortalDescription(participationWallText)) {
  throw new Error("Teilnahme-Wand-Text wurde nicht erkannt");
}
if (isRawPortalDescription(legitTeilnahmeText)) {
  throw new Error("Legitime Beschreibung mit Teilnahme-Bezug wurde fälschlich verworfen");
}
if (cleanPublicDescription(rawPortalText) !== "") {
  throw new Error("Roher Portaltext wurde nicht verworfen");
}
if (cleanPublicDescription(participationWallText) !== "") {
  throw new Error("Teilnahme-Wand-Text wurde nicht verworfen");
}
if (cleanPublicDescription(cleanText) !== cleanText) {
  throw new Error("Saubere Beschreibung wurde verändert");
}
if (!isPublicNavigationSummary(bundNavigation) || cleanPublicDescription(bundNavigation) !== "") {
  throw new Error("Service-Bund-Navigation wurde nicht als Zusammenfassung verworfen");
}
if (pickPublicDescription(rawPortalText, cleanText) !== cleanText) {
  throw new Error("Fallback-Auswahl verwendet nicht die erste brauchbare Beschreibung");
}
for (const invalid of ["## Kurzinfo", "## location", "## Bekanntmachung", "... Dienstleistungen ## CPV-Codes ...", "[ROLLEN: bekanntmachung] [ROLLE: bekanntmachung] [DOKUMENT-ID: 51568]", "Formular — Auftragsbekanntmachung ...", "-", "---", "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -", "SERVICE.BUND.DE - Aktuelle Ausschreibungen", "Haupt-Navigations-Menü", "Meta-Navigation", "Andere Ausschreibungen im Bereich", "Ã–ffentliche Ausschreibung", "�ffentliche Ausschreibung", "HüpstedtVergabeartBeschränkte AusschreibungAngebotsfrist03.08.2026", "<p>Portaltext</p>", "Die angegebene URL (https://example.test) gibt einen 404-Fehler zurück. Es liegen keine Ausschreibungsdaten vor.", "{{description}}", "Anmelden erforderlich, um Zugriff zu erhalten"]) {
  if (normalizePublicDisplayCandidate(invalid) !== null) {
    throw new Error(`Ungültiger öffentlicher Kandidat wurde akzeptiert: ${invalid}`);
  }
}
if (normalizePublicDisplayCandidate("Öffentliche Ausschreibung für Kl&#228;ranlage") !== "Öffentliche Ausschreibung für Kläranlage") {
  throw new Error("HTML-Entitäten wurden nicht dekodiert");
}
if (normalizePublicDisplayCandidate("&Uuml;berarbeitung der Au&szlig;enanlagen") !== "Überarbeitung der Außenanlagen") {
  throw new Error("Benannte HTML-Entitäten wurden nicht vollständig dekodiert");
}
if (!isPdfFormBoilerplate("VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift")) {
  throw new Error("PDF-Formularboilerplate wurde nicht erkannt");
}
if (normalizePublicDisplayCandidate("VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift") !== null) {
  throw new Error("PDF-Formularboilerplate wurde als Beschreibung akzeptiert");
}
if (!isPdfFormBoilerplate("Formular — Auftragsbekanntmachung für Dienstleistungen")) {
  throw new Error("Offensichtlicher Formular-Dump wurde nicht erkannt");
}
for (const formDump of ["Formular 121 — Auftragsbekanntmachung DE 5", "Formular Nr. 121: Auftragsbekanntmachung", "Formular 121 Auftragsbekanntmachung"]) {
  if (!isPdfFormBoilerplate(formDump) || normalizePublicDisplayCandidate(formDump) !== null) {
    throw new Error(`Nummerierter Formular-Dump wurde akzeptiert: ${formDump}`);
  }
}
if (normalizePublicDisplayCandidate("Das Formular 121 beschreibt die Auftragsbekanntmachung für das Verfahren.") === null) {
  throw new Error("Legitime deutsche Prosa wurde als Formular-Dump verworfen");
}
if (normalizePublicDisplayCandidate("94469 Deggendorf Bayern Karte anschauen Hinweis: service.bund.de ist nur die Veröffentlichungsplattform für Ausschreibungen") !== null) {
  throw new Error("Service-Bund-Footer wurde als Standort akzeptiert");
}
if (normalizePublicDisplayCandidate("Öffentliche Ausschreibung für Bauleistungen") !== "Öffentliche Ausschreibung für Bauleistungen") {
  throw new Error("Gültiger deutscher Kandidat wurde verändert");
}
if (pickValidatedPublicCandidate("## Kurzinfo", "-", "Dokumentierte Bauleistungen in Mainz") !== "Dokumentierte Bauleistungen in Mainz") {
  throw new Error("Validierter Fallback wählt keinen gültigen Kandidaten");
}
if (pickValidatedPublicClient("Anmelden erforderlich, um Zugriff zu erhalten", "Stadt Mainz") !== "Stadt Mainz") {
  throw new Error("Validierter Auftraggeber-Fallback wählt keinen gültigen Kandidaten");
}
if (pickValidatedPublicLocationForTender("Erneuerung Energiezentrale in Bautzen", "Stadt Bautzen", "Erneuerung Energiezentrale in Bautzen") !== "") {
  throw new Error("Ausschreibungstitel wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Messung in Bonn", "Bundesministerium", "53113 Bonn zu richten.") !== "") {
  throw new Error("Postalische Anweisung wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Wetterwarte Görlitz", "Bundesrepublik Deutschland, Deutscher Wetterdienst", "Deutscher Wetterdienst") !== "") {
  throw new Error("Auftraggeber wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Erneuerung Energiezentrale in Bautzen", "Stadt Bautzen", "Erneuerung Energiezentrale in Bautzen", "02625 Bautzen") !== "02625 Bautzen") {
  throw new Error("Ungültiger erster Standortkandidat blockiert keinen gültigen Fallback");
}
for (const invalidLocation of ["00023 Anzahl Lose", "85435 NUTS-3-Code", "Ort der Leistungserbringung ist Dessau-Roßlau. 6.", "94469 Deggendorf Bayern Karte anschauen Hinweis: service.bund.de"]) {
  if (pickValidatedPublicLocation(invalidLocation) !== "") {
    throw new Error(`Ungültiger Standort wurde akzeptiert: ${invalidLocation}`);
  }
}
if (pickValidatedPublicLocation("00023 NUTS-3-Code", "55116 Mainz") !== "55116 Mainz") {
  throw new Error("Standort-Fallback wählt keinen gültigen Kandidaten");
}
if (normalizePublicDisplayCandidate("Auftraggeber / Ausschreibende Stelle Stadt Mainz") !== "Auftraggeber / Ausschreibende Stelle Stadt Mainz") {
  throw new Error("Gültiger Beschreibungstext wurde unerwartet verändert");
}
const normalizedMeta = readPublicTenderMeta({
  client: "Auftraggeber / Ausschreibende Stelle Stadt Mainz",
  location: "Erfüllungsort: 55116 Mainz",
  description: cleanText,
  descriptionMarkdown: "## Ungeprüfte Beschreibung",
}, { title: "Sanierung in Mainz", source: "dtvp" });
if (normalizedMeta.client !== "Stadt Mainz" || normalizedMeta.location !== "55116 Mainz" || normalizedMeta.description !== cleanText) {
  throw new Error("Öffentliche Metadaten wurden nicht einheitlich normalisiert");
}
if (normalizedMeta.descriptionMarkdown !== "") {
  throw new Error("Ungeprüftes Meta-Markdown wurde übernommen");
}

const surfaceFixture = {
  metadataDescription: "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -",
  structuredSummary: "Sanierung der Turnhalle in Mainz",
  metadataLocation: "##",
  structuredLocation: "55116 Mainz",
};
const listSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.metadataDescription, surfaceFixture.structuredSummary),
  location: pickValidatedPublicCandidate(surfaceFixture.metadataLocation, surfaceFixture.structuredLocation),
};
const modalSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.metadataDescription, surfaceFixture.structuredSummary),
  location: pickValidatedPublicCandidate(surfaceFixture.metadataLocation, surfaceFixture.structuredLocation),
};
const detailSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.structuredSummary, surfaceFixture.metadataDescription),
  location: pickValidatedPublicCandidate(surfaceFixture.structuredLocation, surfaceFixture.metadataLocation),
};
if (JSON.stringify(listSurface) !== JSON.stringify(modalSurface)
  || JSON.stringify(modalSurface) !== JSON.stringify(detailSurface)) {
  throw new Error("Listenansicht, Modal und Detailseite wählen keine konsistenten Anzeige-Fallbacks");
}

const markdown = buildTenderDescriptionMarkdown({
  client: "Stadt [Mainz]",
  procedure: "Offenes Verfahren",
  deadline: "03.08.2026 08:00",
  location: "55116 Mainz",
  value: "100.000 EUR",
  duration: "24 Monate",
  reference: "AZ-42",
  summary: "Softwareentwicklung [mit Link](https://example.test)",
  requirements: ["Referenzen", "Zertifikat"],
  awardCriteria: [{ criterion: "Preis", weight: 70 }],
  cpv: ["72200000-7"],
});
if (!markdown.includes("- **Auftraggeber:** Stadt \\[Mainz\\]")) {
  throw new Error("Markdown-Werte werden nicht sicher escaped");
}
if (markdown.includes("](https://example.test)")) {
  throw new Error("Markdown-Beschreibung lässt dynamische Links zu");
}
if (!isCanonicalPublicDescriptionMarkdown(markdown)) {
  throw new Error("Generiertes Markdown wird nicht als kanonische Anzeige erkannt");
}
const escapedMarkdown = buildTenderDescriptionMarkdown({ client: "Stadt < 5 `A` ~~B~~" });
if (!escapedMarkdown.includes("Stadt \\< 5 \\`A\\` \\~\\~B\\~\\~")
  || !isCanonicalPublicDescriptionMarkdown(escapedMarkdown)) {
  throw new Error("Markdown-Sonderzeichen werden nicht sicher und kanonisch escaped");
}
if (isCanonicalPublicDescriptionMarkdown("## Ungeprüfte Beschreibung\n- Rohdaten")) {
  throw new Error("Ungeprüftes Markdown wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** ... Dienstleistungen ## CPV-Codes ...")) {
  throw new Error("Inline-Markdown-Rest wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** **ungeprüfte Formatierung**")) {
  throw new Error("Unescaped Markdown-Formatierung wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** ~~ungeprüfte Formatierung~~")) {
  throw new Error("Unescaped Markdown-Durchstreichung wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Hinweis:** SERVICE.BUND.DE - Haupt-Navigations-Menü")) {
  throw new Error("Ungeprüfte Navigation wurde als kanonischer Hinweis akzeptiert");
}

const accessFacts = extractPublicPortalFacts(
  "Auftraggeber / Ausschreibende Stelle Stadt Mainz Vergabeart Offenes Verfahren Abgabefrist 03.08.2026 08:00 Erfüllungsort 55116 Mainz Leistungsgegenstand Softwareentwicklung",
);
const accessMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Softwareentwicklung für die Stadt Mainz", accessFacts);
if (!accessMarkdown.startsWith("- **Auftraggeber:** Stadt Mainz")) {
  throw new Error("Zugangsbeschränkte Ausschreibung erzeugt keine Markdown-Faktenliste");
}
if (!accessMarkdown.includes("- **Angebotsfrist:** 03.08.2026 08:00")) {
  throw new Error("Angebotsfrist fehlt in der Markdown-Faktenliste");
}
if (!accessMarkdown.includes("- **Leistungsgegenstand:** Softwareentwicklung")) {
  throw new Error("Leistungsgegenstand fehlt in der Markdown-Faktenliste");
}
if (!accessMarkdown.includes("vollständige Leistungsbeschreibung") || !accessMarkdown.includes("- **Hinweis:**")) {
  throw new Error("Zugangshinweis fehlt in der Markdown-Beschreibung");
}
if (!isCanonicalPublicDescriptionMarkdown(accessMarkdown)) {
  throw new Error("Zugangsbeschränkte Markdown-Beschreibung ist nicht kanonisch");
}

const userExampleFacts = extractPublicPortalFacts(
  "Für „Praxistage im Ökolandbau“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Auftraggeber: Ministerium für Landwirtschaft, Weinbau, Umwelt und Forsten; Verfahren: Öffentliche Ausschreibung; Angebotsfrist: 08.08.2026 23:59; Leistungsgegenstand: 80000000-4 Allgemeine und berufliche Bildung. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.",
);
if (userExampleFacts.subject !== "80000000-4 Allgemeine und berufliche Bildung") {
  throw new Error("Leistungsgegenstand wird aus der Zugangsbeschreibung nicht sauber begrenzt");
}

const bundFacts = extractPublicPortalFacts(bundFactsText);
if (bundFacts.client !== "Stadt Coburg" || bundFacts.procedure !== "Öffentliche Ausschreibung") {
  throw new Error("Zeilengetrennte Service-Bund-Fakten wurden nicht gelesen");
}
if (bundFacts.deadline !== "14.08.2026 10:00" || bundFacts.location !== "96274 Itzgrund Bayern") {
  throw new Error("Service-Bund-Frist oder -Leistungsort wurden nicht sauber gelesen");
}
const invalidFirstFacts = extractPublicPortalFacts([
  "Vergabestelle: Anmelden erforderlich, um Zugriff zu erhalten",
  "Auftraggeber / Ausschreibende Stelle",
  "Stadt Mainz",
].join("\n"));
if (invalidFirstFacts.client !== "Stadt Mainz") {
  throw new Error("Ungültiger erster Auftraggeber blockiert keinen gültigen Fallback");
}
const bundMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Generalsanierung Kläranlage", bundFacts);
if (/service\.bund|navigations|andere ausschreibungen/i.test(bundMarkdown)) {
  throw new Error("Service-Bund-Navigation ist in Fakten-Markdown gelangt");
}

console.log("Public-description tests passed.");
