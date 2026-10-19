import assert from "node:assert/strict";
import {
  assignRoleHints,
  classifyResourceType,
  extractResourcesFromHtml,
  extractResourcesFromLinks,
  extractResourcesFromNetworkMetadata,
  isGenericPortalNavigationResource,
  isPortalActionUrl,
  normalizeResourceUrl,
  rankSubpageCandidates,
} from "../lib/resource-discovery";

const baseUrl = "https://example.test/portal/start";
const resources = extractResourcesFromHtml(
  `
    <a href="/duplicate#first">First duplicate</a>
    <a href="https://example.test/duplicate#second">Second duplicate</a>
    <a data-href="/notice/42">Bekanntmachung</a>
    <button data-url="/download?id=42">Leistungsbeschreibung</button>
    <a data-download="/files/annex">Anlage</a>
    <form action="/search"><button formaction="/submit">Submit</button></form>
    <iframe src="/embedded/details"></iframe>
    <video><source src="/media/preview.mp4" type="video/mp4"></video>
    <a href="javascript:alert(1)">unsafe</a>
    <a data-url="mailto:test@example.test">unsafe mail</a>
    <a href="#section">fragment</a>
    <a href="/redirect?next=https%3A%2F%2Fevil.test%2Fsecret#fragment">redirect-like</a>
  `,
  baseUrl,
);

assert.equal(resources.filter((resource) => resource.url.endsWith("/duplicate")).length, 1);
assert.equal(resources.find((resource) => resource.url.endsWith("/duplicate"))?.text, "First duplicate");
assert.equal(resources.some((resource) => resource.url.includes("javascript:")), false);
assert.equal(resources.some((resource) => resource.url.startsWith("mailto:")), false);
assert.equal(resources.some((resource) => resource.url.endsWith("#fragment")), false);

const notice = resources.find((resource) => resource.url.endsWith("/notice/42"));
assert.ok(notice);
assert.equal(notice.type, "page");
assert.ok(notice.roleHints.includes("bekanntmachung"));

const pageVariants = extractResourcesFromLinks(
  [
    { href: "/eforms", text: "Verfahrensangaben" },
    { href: "/eforms?-1.-form", text: "Anlage" },
  ],
  baseUrl,
);
assert.equal(new Set(pageVariants.map((resource) => resource.canonicalUrl)).size, 1, "page state variants share one canonical resource");

const download = resources.find((resource) => resource.url.includes("/download?id=42"));
assert.ok(download);
assert.equal(download.type, "download");
assert.ok(download.roleHints.includes("leistungsbeschreibung"));
assert.ok(resources.some((resource) => resource.url.endsWith("/files/annex") && resource.type === "download"));

assert.ok(resources.some((resource) => resource.source === "button" && resource.url.endsWith("/submit")));
assert.ok(resources.some((resource) => resource.source === "form" && resource.url.endsWith("/search")));
assert.ok(resources.some((resource) => resource.source === "iframe" && resource.url.endsWith("/embedded/details")));
assert.ok(resources.some((resource) => resource.source === "source" && resource.type === "media"));

const redirectLike = resources.find((resource) => resource.url.includes("/redirect?next="));
assert.equal(redirectLike?.url, "https://example.test/redirect?next=https%3A%2F%2Fevil.test%2Fsecret");
assert.equal(normalizeResourceUrl("https://user:secret@example.test/path#part"), "https://example.test/path");
assert.equal(normalizeResourceUrl("javascript:location.href='https://evil.test'", baseUrl), null);
assert.equal(normalizeResourceUrl("data:text/html,unsafe", baseUrl), null);
assert.equal(normalizeResourceUrl("mailto:test@example.test", baseUrl), null);

assert.deepEqual(assignRoleHints("Unterlagen: Bekanntmachung und Leistungsbeschreibung"), [
  "leistungsbeschreibung",
  "bekanntmachung",
]);
assert.equal(classifyResourceType("https://example.test/download?id=1"), "download");
assert.equal(isPortalActionUrl("https://example.test/VMPCenter/public/company/projectForwarding.do?pid=42"), true);
assert.equal(isPortalActionUrl("https://example.test/VMPSatellite/mandator/sf_security_check"), true);
assert.equal(isPortalActionUrl("/VMPSatellite/mandator/sf_security_check?continue=documents"), true);
assert.equal(isPortalActionUrl("https://example.test/files/notice.pdf"), false);
const genericPortalResources = extractResourcesFromLinks(
  [
    { href: "/", text: "cosinex GmbH" },
    { href: "/service", text: "SERVICE.BUND.DE" },
    { href: "/navigation", text: "Haupt-Navigations-Menü" },
    { href: "/meta", text: "Meta-Navigation" },
    { href: "/other-notices", text: "Andere Ausschreibungen im Bereich" },
    { href: "/service/vergabemarktplatz-impressum", text: "Impressum" },
    { href: "/service/vergabemarktplatz-impressum.do", text: "" },
    { href: "/service/vergabemarktplatz-datenschutz", text: "Datenschutz" },
    { href: "/service/vergabemarktplatz-datenschutzerklaerung", text: "Datenschutzerklärung" },
    { href: "/service/vergabemarktplatz-nutzungsbedingungen", text: "Nutzungsbedingungen" },
    { href: "/service/vergabemarktplatz-kontakt", text: "Kontakt" },
    { href: "https://buyer.example.test/", text: "Homepage des Auftraggebers" },
    { href: "/logo", text: "Abbildung zeigt das Logo des Landes Brandenburg" },
    { href: "/VMPSatellite/", text: "Abbildung zeigt das Logo des Vergabemarktplatz Brandenburg" },
    { href: "/VMPCenter/", text: "Zur Vergabeplattform" },
  ],
  baseUrl,
);
assert.deepEqual(genericPortalResources, [], "generic portal navigation and footer links are not discovered resources");
assert.equal(isGenericPortalNavigationResource({
  url: "https://example.test/VMPSatellite/",
  label: "Abbildung zeigt das Logo des Vergabemarktplatz Brandenburg",
  resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: "https://example.test/VMPCenter/",
  label: "Zur Vergabeplattform",
  resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: "/branding",
  label: "Logo der Vergabeplattform Brandenburg",
  resourceType: "image",
}), true, "generic Brandenburg platform logo-alt variants are filtered");
assert.equal(
  extractResourcesFromHtml('<a href="/brand"><img alt="Abbildung zeigt das Logo des Landes Brandenburg"></a>', baseUrl).length,
  0,
  "logo alt text on a linked image is treated as generic portal navigation",
);
const serviceBundBase = "https://www.service.bund.de/";
const serviceBundContentUrl = "https://www.service.bund.de/Content/DE/Service/Navigation/Content-Seite.html";
const duplicateServiceBundListingUrl = "https://www.service.bund.de/IMPORTE/Ausschreibungen/BE/2026/06/IMPORTE/Ausschreibungen/BE/2026/06/notice-1.html";
const serviceBundResources = extractResourcesFromLinks(
  [
    { href: serviceBundContentUrl, text: "Content-Seite" },
    { href: duplicateServiceBundListingUrl, text: "Bekanntmachung" },
    { href: "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fservice.bund.de", text: "Facebook" },
    { href: "https://twitter.com/intent/tweet?url=https%3A%2F%2Fservice.bund.de", text: "Twitter" },
    { href: "/Content/Karte", text: "Karte anschauen" },
    { href: "/Content/Weiterempfehlen", text: "Information per E-Mail weiterempfehlen" },
    { href: "/IMPORTE/Ausschreibungen/BE/2026/06/notice-1.html", text: "Bekanntmachung" },
    { href: "/IMPORTE/Ausschreibungen/BE/2026/06/notice-1/Unterlagen.pdf", text: "Vergabeunterlagen" },
  ],
  serviceBundBase,
);
assert.equal(serviceBundResources.length, 2, "generic service.bund.de pages and social/map links are not discovered resources");
assert.ok(serviceBundResources.some((resource) => resource.url.endsWith("/notice-1.html")), "tender-specific service.bund.de detail pages remain");
assert.ok(serviceBundResources.some((resource) => resource.type === "document" && resource.url.endsWith("/Unterlagen.pdf")), "real tender PDFs remain");
assert.equal(isGenericPortalNavigationResource({ url: serviceBundContentUrl, resourceType: "page" }), true);
assert.equal(isGenericPortalNavigationResource({ url: duplicateServiceBundListingUrl, resourceType: "page" }), true);
assert.equal(isGenericPortalNavigationResource({ url: serviceBundContentUrl, resourceType: "document" }), false, "document resources bypass generic path suppression");
assert.equal(isGenericPortalNavigationResource({ url: duplicateServiceBundListingUrl, resourceType: "download" }), false, "download resources bypass generic path suppression");
assert.equal(isGenericPortalNavigationResource({ url: serviceBundContentUrl, filename: "notice.pdf", resourceType: "page" }), false, "PDF filenames bypass generic path suppression");
assert.equal(isGenericPortalNavigationResource({ url: "/map", label: "Karte anschauen", resourceType: "page" }), true);
assert.equal(isGenericPortalNavigationResource({ url: "/share", label: "Facebook", resourceType: "page" }), true);
assert.equal(isGenericPortalNavigationResource({ url: "/share", label: "Twitter", resourceType: "page" }), true);
assert.equal(isGenericPortalNavigationResource({ url: "/forward", label: "Information per E-Mail weiterempfehlen", resourceType: "page" }), true);
const bundProcessFormUrl = "https://www.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?view=processForm&nn=4642046";
assert.equal(isGenericPortalNavigationResource({
  url: bundProcessFormUrl,
  label: "Vergabeverfahren - Bundesweit",
  resourceType: "page",
}), true, "the generic Bund search form is not a tender resource");
assert.equal(isGenericPortalNavigationResource({
  url: "https://www.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?view=processForm&nn=1234567",
  label: "Vergabeverfahren - Bundesweit",
  resourceType: "page",
}), true, "Bund search-form suppression does not depend on incidental nn navigation context");
assert.equal(isGenericPortalNavigationResource({
  url: "https://www.bund.de/Content/DE/Ausschreibungen/notice.html",
  label: "Bekanntmachung",
  resourceType: "page",
}), false, "tender-specific Bund pages are not suppressed");

const mvPortal = "https://vergabe.mv-regierung.de";
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/`, label: "Zur Startseite", resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/LanguageSelectServlet?language=en_US`, label: "English", resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=InvitationToTender`,
  label: "Liefer- und Dienstleistungen",
  resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationSearchControllerServlet?Category=InvitationToTender&thContext=publications&Gesetzesgrundlage=All&function=SearchPublications&Start=100&Order=desc`,
  label: "Alle Vergabeverfahren",
  resourceType: "page",
}), true, "the generic M-V invitation listing is filtered regardless of query parameter order");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationSearchControllerServlet?Gesetzesgrundlage=VOB&Start=0&function=SearchPublications&thContext=publications&Category=InvitationToTender&OrderBy=PublicationDate`,
  label: "Bauleistungen",
  resourceType: "page",
}), true, "the M-V VOB listing is filtered independent of its search facets and label");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=ContractAward&thContext=awardPublications`,
  label: "Alle vergebenen Aufträge",
  resourceType: "page",
}), true, "the live M-V contract-awards listing is filtered");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationSearchControllerServlet?function=Other&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications`,
  label: "Alle Vergabeverfahren",
  resourceType: "page",
}), false, "M-V publication search filtering requires the exact function parameter");
assert.equal(isGenericPortalNavigationResource({
  url: `https://other.example.test/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications`,
  label: "Alle Vergabeverfahren",
  resourceType: "page",
}), false, "M-V publication search filtering is host-scoped");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/LoginControllerServlet?function=LoginForm`, label: "Registrierung", resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=hint_11_3_vgv_123`,
  label: "Allgemeine Informationen zur VgV",
  resourceType: "page",
}), true);
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?thContext=home&Page=hintOfferSubmission&function=Generic`,
  label: "Hinweis zur Angebotsabgabe",
  resourceType: "page",
}), true, "the generic M-V offer-submission help page is filtered independent of parameter order");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=impressum&thContext=home`,
  label: "Impressum / Datenschutz",
  resourceType: "page",
}), true, "M-V Generic portal pages are filtered regardless of Page");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Other&Page=impressum&thContext=home`,
  label: "Impressum / Datenschutz",
  resourceType: "page",
}), false, "M-V legal navigation filtering requires the exact function parameter");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=datenschutz&thContext=home`,
  label: "Impressum / Datenschutz",
  resourceType: "page",
}), true, "M-V Generic privacy pages are filtered");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=anotherHint&thContext=home`,
  label: "Hinweis zur Angebotsabgabe",
  resourceType: "page",
}), true, "M-V Generic pages are filtered regardless of Page");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Other&Page=hintOfferSubmission&thContext=home`,
  label: "Hinweis zur Angebotsabgabe",
  resourceType: "page",
}), false, "M-V offer-submission help filtering requires the exact function parameter");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=hintOfferSubmission&thContext=other`,
  label: "Hinweis zur Angebotsabgabe",
  resourceType: "page",
}), true, "M-V Generic pages are filtered regardless of context");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Generic&Page=frequentQuestions&thContext=home`,
  label: "Häufige Fragen",
  resourceType: "page",
}), true, "the live M-V FAQ portal page is filtered");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/index.jsp?function=Other&Page=frequentQuestions&thContext=home`,
  label: "Häufige Fragen",
  resourceType: "page",
}), false, "M-V index pages with other functions remain");
assert.equal(isGenericPortalNavigationResource({
  url: `https://other.example.test/NetServer/index.jsp?function=Generic&Page=frequentQuestions&thContext=home`,
  label: "Häufige Fragen",
  resourceType: "page",
}), false, "M-V Generic page filtering is host-scoped");
assert.equal(isGenericPortalNavigationResource({
  url: "http://www.service.m-v.de/cms/DLP_prod/DLP/Lebenslagen/Unternehmen/Oeffentliche_Auftraege/index.jsp",
  label: "Infoportal - Lebenslage öffentliche Aufträge in M-V",
  resourceType: "page",
}), true, "the M-V public-procurement information link is generic navigation");
assert.equal(isGenericPortalNavigationResource({
  url: "http://lxwww2.mvnet.de/vlwg/user/index.php?&sortfield=frist&sortorder=down&state=1",
  label: "Laufende und abgeschlossene Vergabeverfahren im Land",
  resourceType: "page",
}), true, "the M-V current-procedures listing is generic navigation");

for (const assetUrl of [
  `${mvPortal}/NetServer/_commonfiles/css/base.css`,
  `${mvPortal}/NetServer/_commonfiles/css/jquery-ui/jquery-ui.min.css`,
  `${mvPortal}/NetServer/_images/img/favicon.ico`,
]) {
  assert.equal(isGenericPortalNavigationResource({
    url: assetUrl,
    label: "",
    resourceType: assetUrl.endsWith(".css") ? "stylesheet" : "image",
  }), true, `unlabelled M-V portal chrome asset is filtered: ${assetUrl}`);
}
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/ParticipationControllerServlet`,
  label: "",
  resourceType: "api",
}), true, "the M-V participation action is filtered without relying on a label");
assert.equal(isGenericPortalNavigationResource({
  url: "https://other.example.test/NetServer/_commonfiles/css/base.css",
  label: "",
  resourceType: "unknown",
}), false, "M-V portal chrome filtering is host-scoped");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/_commonfiles/css/base.js`,
  label: "",
  resourceType: "unknown",
}), false, "M-V asset filtering is scoped to the observed CSS path");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/_commonfiles/css/jquery-ui/theme.css`,
  label: "",
  resourceType: "stylesheet",
}), false, "nested M-V CSS filtering is limited to the observed stylesheet pathname");
assert.equal(isGenericPortalNavigationResource({
  url: `https://other.example.test/NetServer/_commonfiles/css/jquery-ui/jquery-ui.min.css`,
  label: "",
  resourceType: "stylesheet",
}), false, "nested M-V CSS filtering is host-scoped");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/_commonfiles/css/Unterlagen.pdf`,
  label: "",
  resourceType: "document",
}), false, "real documents under M-V portal asset paths remain");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/_commonfiles/css/base.css`,
  label: "",
  resourceType: "document",
}), false, "document resources are preserved even at an observed M-V asset URL");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/ParticipationControllerServlet?function=Download&TOID=MV-123`,
  label: "",
  resourceType: "download",
}), false, "real downloads at an M-V action path remain");

const mvTenderDetailUrl = `${mvPortal}/NetServer/PublicationControllerServlet?function=Detail&TOID=MV-123`;
const mvProcedureDetailsUrl = `${mvPortal}/NetServer/TenderingProcedureDetails?function=_Details&TenderOID=MV-123`;
assert.equal(isGenericPortalNavigationResource({
  url: mvTenderDetailUrl, label: "Bekanntmachung", resourceType: "page",
}), false, "M-V tender-specific publication details remain");
assert.equal(isGenericPortalNavigationResource({
  url: mvProcedureDetailsUrl, label: "Verfahrensdetails", resourceType: "page",
}), false, "M-V tender-specific procedure details remain");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/PublicationDocumentServlet?function=Download&TOID=MV-123`,
  label: "Unterlagen zur Ansicht herunterladen",
  resourceType: "download",
}), false, "tender-specific M-V downloads remain");
assert.equal(isGenericPortalNavigationResource({
  url: `${mvPortal}/NetServer/downloads/Unterlagen.pdf`,
  label: "Unterlagen zur Ansicht herunterladen",
  resourceType: "document",
}), false, "tender-specific M-V PDFs remain");

const tenderSpecificResources = extractResourcesFromLinks(
  [
    { href: "/tender/overview", text: "Übersicht" },
    { href: "/tender/teilnahmeunterlagen", text: "Teilnahmeunterlagen" },
    { href: "/tender/verfahrensangaben", text: "Verfahrensangaben" },
    { href: "/tender/kommunikation", text: "Kommunikation" },
    { href: "/buyer/project/kontakt", text: "Kontakt" },
    { href: "/service/vergabemarktplatz-impressum.pdf", text: "Impressum" },
  ],
  baseUrl,
);
assert.equal(tenderSpecificResources.length, 6, "tender pages, project-specific contact routes and document downloads remain");
assert.ok(tenderSpecificResources.some((resource) => resource.url.endsWith("/overview")));
assert.ok(tenderSpecificResources.some((resource) => resource.url.endsWith("/teilnahmeunterlagen")));
assert.ok(tenderSpecificResources.some((resource) => resource.url.endsWith("/verfahrensangaben")));
assert.ok(tenderSpecificResources.some((resource) => resource.url.endsWith("/kommunikation")));
assert.ok(tenderSpecificResources.some((resource) => resource.url.endsWith("/project/kontakt")));
assert.ok(tenderSpecificResources.some((resource) => resource.type === "document" && resource.url.endsWith("/vergabemarktplatz-impressum.pdf")));
assert.equal(isGenericPortalNavigationResource({ url: "/notice/42", label: "Kommunikation", resourceType: "page" }), false);
assert.equal(isGenericPortalNavigationResource({ url: "/files/notice.pdf", label: "Impressum", resourceType: "document" }), false);
assert.equal(isGenericPortalNavigationResource({ url: "/?notice=42", resourceType: "page" }), false);
assert.equal(classifyResourceType({ url: "https://example.test/api/notices", resourceType: "fetch" }), "api");
assert.equal(
  classifyResourceType({ url: "https://example.test/file", contentType: "application/pdf", contentDisposition: null }),
  "document",
);

const networkResources = extractResourcesFromNetworkMetadata(
  [
    {
      url: "/api/notices",
      method: "GET",
      status: 200,
      contentType: "application/json; charset=utf-8",
      contentDisposition: null,
      resourceType: "fetch",
      cookie: "must not be retained",
      authorization: "must not be retained",
    },
    {
      url: "/download/notice",
      method: "GET",
      status: 200,
      contentType: "application/octet-stream",
      contentDisposition: "attachment; filename=notice.pdf",
      resourceType: "xhr",
    },
    {
      url: "https://external.test/api/other",
      method: "GET",
      status: 200,
      contentType: "application/json",
      contentDisposition: null,
      resourceType: "fetch",
    },
  ],
  baseUrl,
);
assert.equal(networkResources.length, 2);
assert.ok(networkResources.some((resource) => resource.type === "api"));
assert.ok(networkResources.some((resource) => resource.type === "download"));
assert.equal("headers" in networkResources[0], false);
assert.equal("cookie" in networkResources[0], false);
assert.equal("authorization" in networkResources[0], false);

const candidates = extractResourcesFromLinks(
  [
    { href: "/about", text: "Über uns" },
    { href: "/notice/42", text: "Bekanntmachung" },
    { href: "https://external.test/ausschreibung", text: "Ausschreibung" },
  ],
  baseUrl,
);
const ranked = rankSubpageCandidates(candidates, { baseUrl, limit: 2 });
assert.equal(ranked.length, 1);
assert.equal(ranked[0].url, "https://example.test/notice/42");
assert.ok(ranked[0].score > 0);

console.log("Resource discovery tests passed.");
