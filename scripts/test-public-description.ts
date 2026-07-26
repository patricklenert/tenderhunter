import {
  cleanPublicDescription,
  isRawPortalDescription,
  pickPublicDescription,
} from "@/lib/public-tender-scraper";

const rawPortalText = "(Bekanntmachung Öffentliche Ausschreibung) a)Öffentlicher Auftraggeber (Vergabestelle) NameGrün und Gruga StraßeLührmannstraße 82 Telefon0201 Fax0201";
const cleanText = "Die Stadt beauftragt die Ausführung von Wegebauarbeiten im öffentlichen Raum.";

if (!isRawPortalDescription(rawPortalText)) {
  throw new Error("Roher Portaltext wurde nicht erkannt");
}
if (cleanPublicDescription(rawPortalText) !== "") {
  throw new Error("Roher Portaltext wurde nicht verworfen");
}
if (cleanPublicDescription(cleanText) !== cleanText) {
  throw new Error("Saubere Beschreibung wurde verändert");
}
if (pickPublicDescription(rawPortalText, cleanText) !== cleanText) {
  throw new Error("Fallback-Auswahl verwendet nicht die erste brauchbare Beschreibung");
}

console.log("Public-description tests passed.");
