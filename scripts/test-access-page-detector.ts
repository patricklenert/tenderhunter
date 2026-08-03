import { detectAccessPage } from "../lib/access-page-detector";

const cases = [
  {
    name: "cookie block page",
    text: "Die Ausschreibungsseite konnte aufgrund fehlender Cookies nicht geladen werden.",
    blocked: true,
  },
  {
    name: "login page",
    text: "Please sign in. Authentication required to view tender details.",
    url: "https://example.de/account/login",
    blocked: true,
  },
  {
    name: "RIB terms page",
    text: "RIB Tender - Nutzungsbedingungen für Bieter. Jetzt freischalten.",
    blocked: true,
  },
  {
    name: "RLP participation wall with tender signals",
    text: "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen. Teilnahme am Verfahren. Bestätigen Sie die Teilnahme am Verfahren um folgende Vorteile nutzen zu können. Vergabeart: Offenes Verfahren. Abgabefrist 03.08.2026.",
    blocked: true,
    reason: "participation_required",
  },
  {
    name: "legit tender mentioning Teilnahmeunterlagen",
    text: "Offenes Verfahren. Die Teilnahmeunterlagen können heruntergeladen werden. Teilnahmefrist: 30.06.2026. Auftraggeber: Stadt Musterstadt.",
    blocked: false,
  },
  {
    name: "normal tender with cookie policy",
    text: "Offenes Verfahren. Auftraggeber: Stadt Musterstadt. Angebotsfrist: 30.06.2026. Cookie Policy und Datenschutzerklärung.",
    blocked: false,
  },
];

for (const testCase of cases) {
  const result = detectAccessPage(testCase.text, { url: testCase.url });
  if (result.blocked !== testCase.blocked) {
    throw new Error(`${testCase.name}: erwartet blocked=${testCase.blocked}, erhalten ${JSON.stringify(result)}`);
  }
  if (testCase.reason && result.reason !== testCase.reason) {
    throw new Error(`${testCase.name}: erwartet reason=${testCase.reason}, erhalten ${result.reason}`);
  }
}

console.log(`Access-page-detector: ${cases.length} Fälle OK`);
