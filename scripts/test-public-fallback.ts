import assert from "node:assert/strict";
import type { Page } from "playwright";
import { isRecoverableBrowserError, readStablePageContent, readStablePageTitle, retryOnceOnRecoverableBrowserError } from "@/lib/firecrawl";
import { extractBasicDetailFromHtml, extractPublicPortalFacts, searchOeffentlicheVergabeByTitle } from "@/lib/public-tender-scraper";

const item = extractBasicDetailFromHtml(
  "<html><head><title>Vergabe</title></head><body><h1>Softwareentwicklung für die Stadtverwaltung</h1><p>Auftraggeber: Stadt Mainz</p><p>Frist: 31.12.2026</p><p>55116 Mainz</p><a href='/docs/unterlagen.pdf'>PDF</a></body></html>",
  "https://example.vergabe.rlp.de/project/123",
  "rlp",
  ["https://example.vergabe.rlp.de/docs/unterlagen.pdf"],
);

assert.ok(item);
assert.equal(item.title, "Softwareentwicklung für die Stadtverwaltung");
assert.equal(item.deadline, "31.12.2026");
assert.equal(item.client, "Stadt Mainz");
assert.equal(item.location, "55116 Mainz");
assert.deepEqual(item.pdfUrls, ["https://example.vergabe.rlp.de/docs/unterlagen.pdf"]);

const verifyStableBrowserPageReaders = async (): Promise<void> => {
  const contentFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => ({ unexpected: true }),
    evaluate: async () => "<html><title>Recovered</title></html>",
  } as unknown as Page;
  assert.equal(await readStablePageContent(contentFallbackPage), "<html><title>Recovered</title></html>");

  const contentTypeErrorPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => "<html><title>Recovered after RPC error</title></html>",
  } as unknown as Page;
  assert.equal(await readStablePageContent(contentTypeErrorPage), "<html><title>Recovered after RPC error</title></html>");

  let navigationEvaluateAttempts = 0;
  const navigationFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => {
      navigationEvaluateAttempts += 1;
      if (navigationEvaluateAttempts === 1) {
        throw new Error("Unable to retrieve content because the page is navigating and changing the content.");
      }
      return "<html><title>Recovered after navigation</title></html>";
    },
  } as unknown as Page;
  assert.equal(
    await readStablePageContent(navigationFallbackPage),
    "<html><title>Recovered after navigation</title></html>",
  );
  assert.equal(navigationEvaluateAttempts, 2, "a transient page navigation should retry the DOM snapshot once");

  const invalidFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => ({ unexpected: true }),
  } as unknown as Page;
  await assert.rejects(readStablePageContent(invalidFallbackPage), /page\.content: value: expected string, got object/u);

  const closedDuringFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => { throw new Error("Target page, context or browser has been closed"); },
    locator: () => ({ innerText: async () => { throw new Error("Target page, context or browser has been closed"); } }),
  } as unknown as Page;
  await assert.rejects(readStablePageContent(closedDuringFallbackPage), /Target page, context or browser has been closed/u);

  const browserClosedError = new Error("Target page, context or browser has been closed");
  assert.equal(isRecoverableBrowserError(browserClosedError), true);
  assert.equal(isRecoverableBrowserError(new Error("ordinary selector timeout")), false);
  let retryAttempts = 0;
  let retryCallbacks = 0;
  const retryResult = await retryOnceOnRecoverableBrowserError(
    async () => {
      retryAttempts += 1;
      if (retryAttempts === 1) throw browserClosedError;
      return "retried";
    },
    () => { retryCallbacks += 1; },
  );
  assert.equal(retryResult, "retried");
  assert.equal(retryAttempts, 2);
  assert.equal(retryCallbacks, 1);

  let nonrecoverableAttempts = 0;
  await assert.rejects(retryOnceOnRecoverableBrowserError(async () => {
    nonrecoverableAttempts += 1;
    throw new Error("ordinary selector timeout");
  }), /ordinary selector timeout/u);
  assert.equal(nonrecoverableAttempts, 1, "ordinary page errors should not be retried");

  let failedRetryAttempts = 0;
  await assert.rejects(retryOnceOnRecoverableBrowserError(async () => {
    failedRetryAttempts += 1;
    throw browserClosedError;
  }), /Target page, context or browser has been closed/u);
  assert.equal(failedRetryAttempts, 2, "a recoverable browser error should be retried only once");

  const responseFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => { throw new Error("page.evaluate unavailable"); },
  } as unknown as Page;
  const responseFallback = { text: async () => "<html><body>Response fallback</body></html>" };
  assert.equal(
    await readStablePageContent(responseFallbackPage, responseFallback as never),
    "<html><body>Response fallback</body></html>",
  );

  const visibleTextFallbackPage = {
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    content: async () => { throw new Error("page.content: value: expected string, got object"); },
    evaluate: async () => { throw new Error("page.evaluate unavailable"); },
    locator: () => ({ innerText: async () => "Tender <details> & terms" }),
  } as unknown as Page;
  const unavailableResponse = { text: async () => { throw new Error("response.text unavailable"); } };
  assert.equal(
    await readStablePageContent(visibleTextFallbackPage, unavailableResponse as never),
    "<html><body><pre>Tender &lt;details&gt; &amp; terms</pre></body></html>",
  );

  const titleFallbackPage = {
    title: async () => { throw new Error("page.title: value: expected string, got object"); },
    evaluate: async () => "Tender detail",
  } as unknown as Page;
  assert.equal(await readStablePageTitle(titleFallbackPage), "Tender detail");

  const missingTitlePage = {
    title: async () => { throw new Error("page.title unavailable"); },
    evaluate: async () => { throw new Error("page.evaluate unavailable"); },
  } as unknown as Page;
  assert.equal(await readStablePageTitle(missingTitlePage), "");
};

const procedureItem = extractBasicDetailFromHtml(
  "<html><head><title>Offene Bauarbeiten</title></head><body><h1>Offene Bauarbeiten</h1><p>Vergabeart: Offenes Verfahren (sangaben)</p><p>Auftraggeber: Stadt Mainz</p><p>Frist: 31.12.2026</p><p>55116 Mainz</p></body></html>",
  "https://example.vergabe.rlp.de/project/124",
  "rlp",
  [],
);
assert.ok(procedureItem);
assert.equal(procedureItem.procedure, "Offenes Verfahren");
assert.doesNotMatch(procedureItem.descriptionMarkdown, /sangaben|Losangaben/i);

const procedureFactsFallback = extractPublicPortalFacts([
  "Verfahren: (Losangaben)",
  "Verfahren: Verhandlungsverfahren",
].join("\n"));
assert.equal(procedureFactsFallback.procedure, "Verhandlungsverfahren");

const rlpItem = extractBasicDetailFromHtml(
  `<html><head><title>CXCPEYDYYYRM0 | 26F0047 (LBB NL Mainz) Bauendreinigung | www.vergabe.rlp.de</title></head><body>
    <h1>Bekanntmachung</h1>
    <section><h2>Ausschreibende Stelle</h2><p>Bezeichnung:</p><p>LBB Niederlassung Mainz</p></section>
    <section><h2>Beschreibung der Leistung</h2><p>Bezeichnung:</p><p>26F0047 (LBB NL Mainz) Bauendreinigung</p></section>
    <p>Hauptleistungsort</p><p>55128 Mainz</p><p>Bekanntmachungs-ID:</p><p>CXCPEYDYYYRM0</p>
  </body></html>`,
  "https://vergabe.rlp.de/VMPCenter/public/company/projectForwarding.do?pid=58739",
  "rlp",
  [],
);

assert.ok(rlpItem);
assert.equal(rlpItem.title, "26F0047 (LBB NL Mainz) Bauendreinigung");
assert.equal(rlpItem.client, "LBB Niederlassung Mainz");
assert.equal(rlpItem.location, "55128 Mainz");
assert.equal(rlpItem.referenceNumber, "CXCPEYDYYYRM0");

const participationWallItem = extractBasicDetailFromHtml(
  `<html><head><title>DA Ausstellungsbau (3)</title></head><body>
    <h1>DA Ausstellungsbau (3)</h1>
    <p>Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.</p>
    <p>Vergabeart: Offenes Verfahren</p>
    <p>Auftraggeber / Ausschreibende Stelle Leibniz-Zentrum für Archäologie</p>
    <p>Abgabefrist 03.08.2026 08:00 Ortszeit</p>
  </body></html>`,
  "https://landesverwaltung.vergabe.rlp.de/project/123",
  "rlp-land",
  [],
  true,
);

assert.ok(participationWallItem);
assert.equal(participationWallItem.client, "Leibniz-Zentrum für Archäologie");
assert.equal(participationWallItem.deadline, "03.08.2026 08:00");
assert.match(participationWallItem.description, /vollständige Leistungsbeschreibung/);
assert.match(participationWallItem.descriptionMarkdown ?? "", /- \*\*Auftraggeber:\*\* Leibniz-Zentrum für Archäologie/);
assert.match(participationWallItem.descriptionMarkdown ?? "", /- \*\*Hinweis:\*\*.*vollständige Leistungsbeschreibung/);
void Promise.all([
  searchOeffentlicheVergabeByTitle("Nicht zugänglich – Anmeldung erforderlich"),
  verifyStableBrowserPageReaders(),
]).then(([result]) => {
    assert.equal(result, null);
    console.log("Public detail fallback tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
