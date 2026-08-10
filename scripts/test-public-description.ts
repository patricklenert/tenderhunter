import {
  buildPublicAccessLimitedDescriptionMarkdown,
  cleanPublicDescription,
  extractPublicPortalFacts,
  isPublicNavigationSummary,
  isRawPortalDescription,
  pickPublicDescription,
} from "@/lib/public-tender-scraper";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";

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
const bundMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Generalsanierung Kläranlage", bundFacts);
if (/service\.bund|navigations|andere ausschreibungen/i.test(bundMarkdown)) {
  throw new Error("Service-Bund-Navigation ist in Fakten-Markdown gelangt");
}

console.log("Public-description tests passed.");
