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
  {
    name: "DTVP Keycloak redirect URL (realms + openid-connect/auth)",
    text: "Anmelden Benutzername Passwort Angemeldet bleiben",
    url: "https://id.dtvp.de/realms/ted/protocol/openid-connect/auth?client_id=dtvp-portal&redirect_uri=https%3A%2F%2Fwww.dtvp.de%2Fcenter%2F",
    blocked: true,
    reason: "login_required",
  },
  {
    name: "DTVP Keycloak login page title",
    text: "Anmeldung für Unternehmen. Geben Sie Ihre Zugangsdaten ein, um fortzufahren.",
    title: "Anmeldung für Unternehmen",
    url: "https://id.dtvp.de/realms/ted/login-actions/authenticate",
    blocked: true,
    reason: "login_required",
  },
  {
    name: "access-limited tender placeholder title",
    text: "",
    title: "Nicht zugänglich – Anmeldung erforderlich",
    blocked: true,
    reason: "login_required",
  },
  {
    name: "Keycloak id host realm page",
    text: "Sign in to your account",
    url: "https://id.service-bw.de/realms/baustin/",
    blocked: true,
    reason: "login_required",
  },
];

for (const testCase of cases) {
  const result = detectAccessPage(testCase.text, { url: testCase.url, title: testCase.title });
  if (result.blocked !== testCase.blocked) {
    throw new Error(`${testCase.name}: erwartet blocked=${testCase.blocked}, erhalten ${JSON.stringify(result)}`);
  }
  if (testCase.reason && result.reason !== testCase.reason) {
    throw new Error(`${testCase.name}: erwartet reason=${testCase.reason}, erhalten ${result.reason}`);
  }
}

console.log(`Access-page-detector: ${cases.length} Fälle OK`);
