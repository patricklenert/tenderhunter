import assert from "node:assert/strict";
import { extractPublicPortalFacts } from "@/lib/public-tender-scraper";
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

  console.log("Auftraggeber extraction tests passed.");
};

void main();
