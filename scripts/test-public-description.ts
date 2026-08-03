import {
  cleanPublicDescription,
  isRawPortalDescription,
  pickPublicDescription,
} from "@/lib/public-tender-scraper";

const rawPortalText = "(Bekanntmachung Öffentliche Ausschreibung) a)Öffentlicher Auftraggeber (Vergabestelle) NameGrün und Gruga StraßeLührmannstraße 82 Telefon0201 Fax0201";
const cleanText = "Die Stadt beauftragt die Ausführung von Wegebauarbeiten im öffentlichen Raum.";
const participationWallText =
  "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen. Bestätigen Sie die Teilnahme am Verfahren um folgende Vorteile nutzen zu können. Vergabeart: Offenes Verfahren. Abgabefrist 03.08.2026.";
const legitTeilnahmeText =
  "Offenes Verfahren. Die Teilnahmeunterlagen können heruntergeladen werden. Teilnahmefrist: 30.06.2026.";

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
if (pickPublicDescription(rawPortalText, cleanText) !== cleanText) {
  throw new Error("Fallback-Auswahl verwendet nicht die erste brauchbare Beschreibung");
}

console.log("Public-description tests passed.");
