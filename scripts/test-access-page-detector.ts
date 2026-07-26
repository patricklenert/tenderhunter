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
}

console.log(`Access-page-detector: ${cases.length} Fälle OK`);
