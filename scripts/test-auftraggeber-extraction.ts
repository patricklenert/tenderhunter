import assert from "node:assert/strict";
import {
  extractBasicDetailFromHtml,
  extractBundRssClient,
  extractPublicPortalFacts,
} from "@/lib/public-tender-scraper";
import { extractStructuredData } from "@/lib/structurer";

const rawText = [
  "Zur Angebotsabgabe / Teilnahme auffordernde Stelle",
  "BezeichnungLogistik Zentrum Niedersachsen Landesbetrieb - Außenstelle Hannover",
  "PostanschriftPodbielskistraße 166",
  "Ort30177 Hannover",
  "Telefon+49 51189848102",
  "VO: UVgOVergabeart: Öffentliche Ausschreibung",
  "Die Nachforderung von Unterlagen liegt im Ermessen des Auftraggebers. Die",
  "Bieter haben keinen Anspruch auf Nachforderung/Nachreichung von Unterlagen.",
  "Wirtschaftliche und finanzielle Leistungsfähigkeit",
].join("\n");

const main = async (): Promise<void> => {
  const structured = await extractStructuredData("Lieferung eines Mehrzellen-Gefangenentransportwagens (GTW)", rawText, { useLLM: false });
  assert.equal(
    structured.hard_facts.buyer,
    "Logistik Zentrum Niedersachsen Landesbetrieb - Außenstelle Hannover",
  );

  const facts = extractPublicPortalFacts(rawText);
  assert.equal(facts.client, "Logistik Zentrum Niedersachsen Landesbetrieb - Außenstelle Hannover");
  assert.equal(facts.procedure, "Öffentliche Ausschreibung");
  assert.doesNotMatch(facts.client ?? "", /Bieter|Nachforderung|Wirtschaftliche/);

  const accessFacts = extractPublicPortalFacts(
    "Öffentlich sichtbar sind: Auftraggeber: Stadt Mainz; Verfahren: Offenes Verfahren; Angebotsfrist: 03.08.2026 08:00.",
  );
  assert.equal(accessFacts.client, "Stadt Mainz");

  const loginCapturedAsClient = "n und ein gültiges Passwort besitzen, melden Sie sich bitte mit diesen Daten am System an.";
  assert.equal(extractPublicPortalFacts(`Auftraggeber: ${loginCapturedAsClient}`).client, null);

  const muenchenDetail = extractBasicDetailFromHtml(
    `<html><head><title>Vergabeplattform Landeshauptstadt München</title></head><body>
      <h1>Vergabeplattform Landeshauptstadt München</h1>
      <p>Auftraggeber: ${loginCapturedAsClient}</p>
      <p>Angebotsfrist: 20.08.2026</p>
    </body></html>`,
    "https://vergabe.muenchen.de/NetServer/PublicationSearchControllerServlet?function=GetPublication&oid=test",
    "muenchen",
    [],
    true,
  );
  assert.equal(muenchenDetail?.client, "Landeshauptstadt München");

  assert.equal(
    extractBundRssClient("Vergabestelle: Bundesagentur f&#252;r Arbeit Angebotsfrist: 20.08.2026 11:00"),
    "Bundesagentur für Arbeit",
  );
  assert.equal(
    extractBundRssClient("Bundesagentur f&#252;r Arbeit Angebotsfrist: 20.08.2026 11:00"),
    "Bund",
  );

  console.log("Auftraggeber extraction tests passed.");
};

void main();
