import {
  buildPublicAccessLimitedDescription,
  buildPublicAccessLimitedDescriptionMarkdown,
  cleanTenderTitle,
  decodePublicResponseBytes,
  cleanPublicDescription,
  extractPublicPortalFacts,
  getPublicAccessLimitedFallback,
  isPublicNavigationSummary,
  isRawPortalDescription,
  pickPublicDescription,
  readPublicResponseText,
} from "@/lib/public-tender-scraper";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import {
  hasPositivePublicAccessEvidence,
  repairPublicDescriptionFields,
  selectPublicDescriptionMarkdown,
  shouldSyncPublicDescriptionBackfillMeili,
} from "@/lib/public-description-backfill";
import {
  isCanonicalPublicDescriptionMarkdown,
  isPdfFormBoilerplate,
  normalizePublicDisplayCandidate,
  normalizePublicProcedureCandidate,
  isPublicNavigationSummary as isSharedPublicNavigationSummary,
  pickValidatedPublicClient,
  pickValidatedPublicCandidate,
  pickSourceBackedPublicCandidate,
  pickValidatedPublicLocation,
  pickValidatedPublicLocationForTender,
  pickValidatedPublicProcedure,
  projectPublicDisplayFields,
  projectPublicTenderRecord,
  groundPublicTenderFields,
} from "@/lib/public-content-quality";
import { pickPublicTenderDescription, readPublicTenderMeta } from "@/lib/tender-meta";

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
if (!hasPositivePublicAccessEvidence(false, participationWallText)
  || hasPositivePublicAccessEvidence(false, bundNavigation)
  || !hasPositivePublicAccessEvidence(true, "")) {
  throw new Error("Öffentliche Zugangszusammenfassung erfordert positive Zugangsevidenz");
}
const accessFallback = getPublicAccessLimitedFallback({
  title: "Sanierung der Turnhalle in Mainz",
  factsText: bundFactsText,
  evidenceText: participationWallText,
});
if (!accessFallback?.description.includes("Stadt Coburg")
  || !isCanonicalPublicDescriptionMarkdown(accessFallback.descriptionMarkdown)
  || getPublicAccessLimitedFallback({ title: "Sanierung in Mainz", evidenceText: bundNavigation }) !== null) {
  throw new Error("Neutraler Access-Fallback nutzt keine geprüften Fakten oder feuert auf Navigation");
}
if (!isPublicNavigationSummary(bundNavigation) || cleanPublicDescription(bundNavigation) !== "") {
  throw new Error("Service-Bund-Navigation wurde nicht als Zusammenfassung verworfen");
}
if (pickPublicDescription(rawPortalText, cleanText) !== cleanText) {
  throw new Error("Fallback-Auswahl verwendet nicht die erste brauchbare Beschreibung");
}
for (const invalid of ["## Kurzinfo", "## location", "## Bekanntmachung", "... Dienstleistungen ## CPV-Codes ...", "[ROLLEN: bekanntmachung] [ROLLE: bekanntmachung] [DOKUMENT-ID: 51568]", "Formular — Auftragsbekanntmachung ...", "-", "---", "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -", "SERVICE.BUND.DE - Aktuelle Ausschreibungen", "Haupt-Navigations-Menü", "Meta-Navigation", "Andere Ausschreibungen im Bereich", "Ã–ffentliche Ausschreibung", "�ffentliche Ausschreibung", "HüpstedtVergabeartBeschränkte AusschreibungAngebotsfrist03.08.2026", "<p>Portaltext</p>", "Die angegebene URL (https://example.test) gibt einen 404-Fehler zurück. Es liegen keine Ausschreibungsdaten vor.", "{{description}}", "Anmelden", "Alle Ausschreibungen", "Login", "Log in", "Sign in", "Anmeldung", "Registrieren", "Registrierung", "Formblatt 1", "Anmelden erforderlich, um Zugriff zu erhalten", "Bitte melden Sie sich an, um die vollständigen Vergabeunterlagen einzusehen.", "Sie müssen sich anmelden, um die vollständigen Ausschreibungsunterlagen herunterzuladen.", "Eine Teilnahme ist erforderlich, um die Vergabeunterlagen einzusehen."]) {
  if (normalizePublicDisplayCandidate(invalid) !== null) {
    throw new Error(`Ungültiger öffentlicher Kandidat wurde akzeptiert: ${invalid}`);
  }
}
if (!["Anmelden", "Alle Ausschreibungen", "Login", "Log in", "Sign in", "Anmeldung", "Registrieren", "Registrierung"]
  .every(isSharedPublicNavigationSummary)) {
  throw new Error("Standalone-Portalaktionen/-navigation wurden nicht klassifiziert");
}
const gluedBundNavigation = "SERVICE.BUND.DEHaupt-Navigations-Men&#xFC;Meta-NavigationAndere Ausschreibungen im Bereich";
if (!isPublicNavigationSummary(gluedBundNavigation) || normalizePublicDisplayCandidate(gluedBundNavigation) !== null) {
  throw new Error("Verklebte/HTML-kodierte Service-Bund-Navigation wurde als Beschreibung akzeptiert");
}
if (normalizePublicDisplayCandidate(legitTeilnahmeText) !== legitTeilnahmeText) {
  throw new Error("Legitime deutsche Ausschreibungsprosa mit Teilnahme-Bezug wurde als Zugangs-Wand verworfen");
}
if (normalizePublicDisplayCandidate("Öffentliche Ausschreibung für Kl&#228;ranlage") !== "Öffentliche Ausschreibung für Kläranlage") {
  throw new Error("HTML-Entitäten wurden nicht dekodiert");
}
if (normalizePublicDisplayCandidate("&Uuml;berarbeitung der Au&szlig;enanlagen") !== "Überarbeitung der Außenanlagen") {
  throw new Error("Benannte HTML-Entitäten wurden nicht vollständig dekodiert");
}
if (!isPdfFormBoilerplate("VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift")) {
  throw new Error("PDF-Formularboilerplate wurde nicht erkannt");
}
if (normalizePublicDisplayCandidate("VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift") !== null) {
  throw new Error("PDF-Formularboilerplate wurde als Beschreibung akzeptiert");
}
const observedVhbNrwFormDump = "[Seite 3] VHB NRW Formular 412a 01/2020 Auftragsbekanntmachung Teilnahmewettbewerb ... Bekanntmachungs-ID ... BMS ...";
if (!isPdfFormBoilerplate(observedVhbNrwFormDump)
  || normalizePublicDisplayCandidate(observedVhbNrwFormDump) !== null) {
  throw new Error("Beobachteter VHB-NRW-Formulartext wurde als Beschreibung akzeptiert");
}
const observedCosinexPageDump = "[Seite 2/4] VO: Sonstige Vergabeart Bekanntmachungs-ID CXS-123 Seite 2 Generierungsdatum 29.09.2026 cosinex BMS CSX";
const observedDocumentDump = "=== anschreiben/321 EU Anfrage Angebotsabgabe.DOCX === Dienststelle Ort, Datum Vergabe-Nr. 321 Sehr geehrte Damen und Herren, anbei die Unterlagen.";
const observedCoverLetterBoilerplate = "Dienststelle Ort, Datum Vergabe-Nr. 321 Sehr geehrte Damen und Herren, anbei erhalten Sie die Unterlagen.";
const observedBietercockpitManual = "Diese Seite enthält ausschließlich das Benutzerhandbuch AI BIETER COCKPIT und keine konkrete Ausschreibung.";
const observedNoTenderExplanation = "Diese Seite enthält keine konkrete Ausschreibung, sondern nur allgemeine Informationen.";
const observedEvidenceDump = "Eigenerklärungen, Eignungsnachweise, Nachweispflichten und Formblätter nach VHB.";
const observedFormalDirectory = "Sehr geehrte Damen und Herren. Anlagenverzeichnis: 1. Anlage 1 Formblatt 1; 2. Anlage 2 Formblatt 2; Vertragsbedingungen.";
for (const artifact of [
  observedCosinexPageDump,
  observedDocumentDump,
  observedCoverLetterBoilerplate,
  observedBietercockpitManual,
  observedNoTenderExplanation,
  observedEvidenceDump,
  observedFormalDirectory,
]) {
  if (!isPdfFormBoilerplate(artifact)
    || !isRawPortalDescription(artifact)
    || normalizePublicDisplayCandidate(artifact) !== null) {
    throw new Error(`Beobachtetes Dokumentartefakt wurde akzeptiert: ${artifact}`);
  }
}
for (const pageOnly of ["[Seite 3]", "[Seite 3 von 4]", "[Seite 2/4]"]) {
  if (normalizePublicDisplayCandidate(pageOnly) !== null) {
    throw new Error(`Reiner Seitenmarker wurde akzeptiert: ${pageOnly}`);
  }
}
const invalidAuditedDescriptions: ReadonlyArray<readonly [number, string]> = [
  [27304, "AI-BIETER-COCKPIT Benutzerhandbuch: Es geht nicht um eine konkrete Ausschreibung, sondern um Software; keine Informationen zu einem spezifischen öffentlichen Auftrag."],
  [24247, "AI Bieter Cockpit Benutzerhandbuch: NICHT um eine konkrete Ausschreibung mit Auftragsgegenstand, sondern um eine Softwareanleitung."],
  [24242, "AI-BIETER-COCKPIT: kein Ausschreibungstext; Keine Ausschreibungsdetails vorhanden. Allgemeine Bauleistungen werden erläutert."],
  [24246, "AI Bieter-Cockpit Anleitung: Es sind keine konkreten Ausschreibungsdetails enthalten. Leistungsverzeichnisse und Software werden nur erklärt."],
  [13412, "Diese Seite enthält ausschließlich das Benutzerhandbuch AI BIETER COCKPIT und keine konkrete Ausschreibung. Allgemeine Bauleistungen werden nur beispielhaft erwähnt."],
  [22808, "AI-BIETER-COCKPIT: kein Ausschreibungstext und keine konkreten Ausschreibungsdetails extrahiert; keine Informationen zu einem spezifischen öffentlichen Auftrag."],
  [24232, "Benutzerhandbuch"],
  [22157, "☒ alle Lose ☐ mehrere Lose ☐ nur Lose. Beschränkung der Zahl der Lose. Formular 311a EU."],
  [7763, "☐ mehrere Lose. Beschränkung der zu vergebenden Lose. Formular 311a EU."],
  [28757, "☒ nur Lose. Formular 311a EU: Beschränkung der Zahl der Lose."],
  [28989, "☒ alle Lose; Beschränkung der Anzahl der Lose im Formular 311a EU."],
  [27997, "[Seite 3] Auftragsbekanntmachung © Ausgabe 03/2020 Seite 3 von 3 ... Telefon ..."],
  [18257, "Vorinformationen zu aktuellen Ausschreibungen: Die Plattform ermöglicht die digitale Teilnahme, Einsicht in die Vergabeunterlagen und die elektronische Angebotsabgabe über Bietercockpit. Allgemeine Bauleistungen werden auf der Plattform erläutert."],
  [1283, "Cookie-Einstellungen: Eigenerklärung zur Eignung; Formblatt 1."],
  [4734, "Source error: Eignungsnachweis und Formblatt 1."],
];
for (const [id, invalid] of invalidAuditedDescriptions) {
  if (normalizePublicDisplayCandidate(invalid) !== null) {
    throw new Error(`Audit-Kandidat ${id} wurde als öffentliche Beschreibung akzeptiert: ${invalid}`);
  }
}
const explicitNoTenderWithScope = "Dies ist keine konkrete Ausschreibung, sondern eine allgemeine Anleitung zu Software und Bauleistungen.";
if (normalizePublicDisplayCandidate(explicitNoTenderWithScope) !== null) {
  throw new Error("Explizite No-Tender-Erklärung mit generischem Scope wurde akzeptiert");
}
const validFormMention = "Für die Bewerbung ist das Formular 412a gemeinsam mit dem Eignungsnachweis einzureichen; ausgeschrieben ist die Betreuung von Auszubildenden.";
if (normalizePublicDisplayCandidate(validFormMention) !== validFormMention) {
  throw new Error("Legitime Beschreibung mit bloßer Formular-Erwähnung wurde verworfen");
}
const validBietercockpitMention = "Die ausgeschriebene Lieferung von Schulungsleistungen erfolgt über das AI Bietercockpit; die Eigenerklärung und der Eignungsnachweis sind mit dem Angebot einzureichen.";
if (isPdfFormBoilerplate(validBietercockpitMention)
  || normalizePublicDisplayCandidate(validBietercockpitMention) !== validBietercockpitMention) {
  throw new Error("Legitime Ausschreibung mit Bietercockpit-/Eignungs-Erwähnung wurde verworfen");
}
const validRequirementMention = "Bei der ausgeschriebenen Leistung sind Eigenerklärung und Formblatt mit dem Angebot einzureichen; die Wartung der Heizungsanlage ist Gegenstand des Auftrags.";
if (normalizePublicDisplayCandidate(validRequirementMention) !== validRequirementMention) {
  throw new Error("Legitime Ausschreibung mit Eigenerklärungs-/Formblatt-Erwähnung wurde verworfen");
}
const validProcedureAndNoticeMention = "Die Vergabeart ist das offene Verfahren; die Bekanntmachungs-ID 12345 gehört zur Ausschreibung über die Lieferung von Schulungsmaterial.";
if (normalizePublicDisplayCandidate(validProcedureAndNoticeMention) !== validProcedureAndNoticeMention) {
  throw new Error("Legitime Vergabeart-/Bekanntmachungs-ID-Erwähnung wurde verworfen");
}
const validPageDescription = "[Seite 2] Die Lieferung von Schulungsmaterial an mehrere Standorte ist beschrieben.";
if (normalizePublicDisplayCandidate(validPageDescription) !== validPageDescription) {
  throw new Error("Legitime Beschreibung mit unkritischem Seitenmarker wurde verworfen");
}
const validNumberedScope = "1. Reinigung der Gebäude, 2. Wartung der Anlagen. Das Formblatt 1 ist mit dem Angebot einzureichen.";
if (normalizePublicDisplayCandidate(validNumberedScope) !== validNumberedScope) {
  throw new Error("Normale nummerierte Leistungsbeschreibung wurde als Anlagenverzeichnis verworfen");
}
const validAuditedDescriptions: ReadonlyArray<readonly [number, string]> = [
  [19254, "Die Durchführung von Praxistagen ist Gegenstand des Auftrags; die Eigenerklärung ist mit dem Angebot einzureichen."],
  [19807, "Die Wartung der Heizungsanlage erfolgt über das Bietercockpit; die elektronische Angebotsabgabe ist vorgesehen."],
  [23311, "Die Beschaffung von Schulungsmaterial umfasst Lieferung und Einrichtung; das Formblatt ist beizufügen."],
  [21633, "Die Lieferung von Möbeln für Schulen ist ausgeschrieben; Eigenerklärungen sind mit dem Angebot einzureichen."],
  [24582, "Die Sanierung des Verwaltungsgebäudes umfasst die Erneuerung der Fenster; das Formblatt ist vorzulegen."],
  [28582, "Die Lieferung von Schulungsmaterial ist Gegenstand der Ausschreibung; die elektronische Angebotsabgabe erfolgt über das Bietercockpit."],
  [9166, "Die Reinigung mehrerer Gebäude wird ausgeschrieben; Einsicht in die Vergabeunterlagen und die Angebotsabgabe erfolgen über das Bietercockpit."],
];
for (const [id, valid] of validAuditedDescriptions) {
  if (normalizePublicDisplayCandidate(valid) !== valid) {
    throw new Error(`Legitimer Audit-Gegenkandidat ${id} wurde verworfen: ${valid}`);
  }
}
const validPortalProcedureMention = "Die Lieferung von Schulungsmaterial ist Gegenstand der Ausschreibung; die elektronische Angebotsabgabe erfolgt über das Bietercockpit.";
const validPortalAccessMention = "Die Reinigung mehrerer Gebäude wird ausgeschrieben; Einsicht in die Vergabeunterlagen und die Angebotsabgabe erfolgen über das Bietercockpit.";
for (const valid of [validPortalProcedureMention, validPortalAccessMention]) {
  if (normalizePublicDisplayCandidate(valid) !== valid) {
    throw new Error(`Konkrete Bietercockpit-Ausschreibung wurde verworfen: ${valid}`);
  }
}
const deutscheEvergabeDashboardArtifacts: ReadonlyArray<readonly [number, string]> = [
  [21437, "Dashboard der Deutschen eVergabe"],
  [21464, "Allgemeine Plattform / Hauptnavigation – keine konkreten Ausschreibungsdaten."],
  [21469, "Keine konkreten Ausschreibungsdetails/Verfahrensinformationen; es handelt sich nicht um eine spezifische Ausschreibung."],
];
for (const [id, artifact] of deutscheEvergabeDashboardArtifacts) {
  if (!isPdfFormBoilerplate(artifact)
    || !isRawPortalDescription(artifact)
    || normalizePublicDisplayCandidate(artifact) !== null) {
    throw new Error(`Deutsche-eVergabe-Dashboard-Artefakt ${id} wurde akzeptiert: ${artifact}`);
  }
}
const validDashboardFallback = "Die Lieferung von Schulungsmaterial für kommunale Bildungsstandorte umfasst Versand und Einrichtung.";
const projectedDashboardFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: {
    summary: deutscheEvergabeDashboardArtifacts[1][1],
    description: deutscheEvergabeDashboardArtifacts[2][1],
  },
  metadata: { description: validDashboardFallback },
});
if (projectedDashboardFallback.description !== validDashboardFallback
  || projectedDashboardFallback.summary !== validDashboardFallback) {
  throw new Error("Gültiger Metadata-Kandidat wird nach verworfenen Dashboard-Summary-/Description-Werten nicht verwendet");
}
if (normalizePublicDisplayCandidate("Die konkrete Ausschreibung betrifft Bauleistungen; die Plattform dient nur der elektronischen Angebotsabgabe.") === null) {
  throw new Error("Konkreter Ausschreibungstext mit normalen Plattform-/Bauleistungswörtern wurde verworfen");
}
if (!isPdfFormBoilerplate("Formular — Auftragsbekanntmachung für Dienstleistungen")) {
  throw new Error("Offensichtlicher Formular-Dump wurde nicht erkannt");
}
for (const formDump of ["Formular 121 — Auftragsbekanntmachung DE 5", "Formular Nr. 121: Auftragsbekanntmachung", "Formular 121 Auftragsbekanntmachung"]) {
  if (!isPdfFormBoilerplate(formDump) || normalizePublicDisplayCandidate(formDump) !== null) {
    throw new Error(`Nummerierter Formular-Dump wurde akzeptiert: ${formDump}`);
  }
}
if (normalizePublicDisplayCandidate("Das Formular 121 beschreibt die Auftragsbekanntmachung für das Verfahren.") === null) {
  throw new Error("Legitime deutsche Prosa wurde als Formular-Dump verworfen");
}
const structuredVhbFallback = "Das Auswahlverfahren richtet sich an Bewerbende für Ausbildung und Studium ab dem Einstellungsjahr 2027.";
const projectedVhbFallback = projectPublicTenderRecord({
  title: "Auswahlverfahren Ausbildung / Studium ab EJ 2027",
  metadata: JSON.stringify({ description: observedVhbNrwFormDump }),
  structured: JSON.stringify({ summary: structuredVhbFallback }),
});
if (projectedVhbFallback.description !== structuredVhbFallback
  || projectedVhbFallback.summary !== structuredVhbFallback) {
  throw new Error("Gültiger structured.summary-Fallback wurde nach verworfener Metadata-Description nicht verwendet");
}
const projectedVhbWithoutFallback = projectPublicTenderRecord({
  title: "Auswahlverfahren Ausbildung / Studium ab EJ 2027",
  metadata: JSON.stringify({ description: observedVhbNrwFormDump }),
});
if (projectedVhbWithoutFallback.description !== null || projectedVhbWithoutFallback.summary !== null) {
  throw new Error("Verworfener VHB-NRW-Formulartext blieb ohne gültigen Fallback öffentlich sichtbar");
}
const metadataDescriptionFallback = "Die Lieferung von Schulungsmaterial für kommunale Bildungsstandorte umfasst Versand und Einrichtung.";
const projectedMetadataDescriptionFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: JSON.stringify({ summary: observedCosinexPageDump }),
  metadata: JSON.stringify({ description: metadataDescriptionFallback }),
});
if (projectedMetadataDescriptionFallback.description !== metadataDescriptionFallback
  || projectedMetadataDescriptionFallback.summary !== metadataDescriptionFallback) {
  throw new Error("Gültiger Metadata-Fallback wurde nach verworfenem structured.summary nicht verwendet");
}
const accessDescriptionFallback = "Für „Lieferung von Schulungsmaterial“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Auftraggeber: Stadt Mainz; Angebotsfrist: 03.08.2026 08:00; Leistungsort: Mainz; Leistungsumfang: Lieferung von Schulungsmaterial. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal derzeit nicht öffentlich verfügbar.";
const projectedAccessDescriptionFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: JSON.stringify({ summary: observedBietercockpitManual }),
  metadata: JSON.stringify({ access_limited: true, description: accessDescriptionFallback }),
});
if (projectedAccessDescriptionFallback.description !== accessDescriptionFallback
  || projectedAccessDescriptionFallback.summary !== accessDescriptionFallback) {
  throw new Error("Gültiger Access-Fallback wurde nach verworfenem structured.summary nicht verwendet");
}
const projectedAuditedFallback = projectPublicTenderRecord({
  title: "Lieferung von Möbeln für Schulen",
  structured: JSON.stringify({ summary: invalidAuditedDescriptions.find(([id]) => id === 1283)?.[1] }),
  metadata: JSON.stringify({ description: validAuditedDescriptions.find(([id]) => id === 21633)?.[1] }),
});
if (projectedAuditedFallback.description !== validAuditedDescriptions.find(([id]) => id === 21633)?.[1]
  || projectedAuditedFallback.summary !== validAuditedDescriptions.find(([id]) => id === 21633)?.[1]) {
  throw new Error("Gültiger Metadata-Kandidat wird nach verworfenem structured Eignungsnachweis nicht verwendet");
}
const noTenderWithScope = invalidAuditedDescriptions.find(([id]) => id === 27304)?.[1];
const projectedNoTenderFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: JSON.stringify({ summary: noTenderWithScope }),
  metadata: JSON.stringify({ description: validPortalProcedureMention }),
});
if (projectedNoTenderFallback.description !== validPortalProcedureMention
  || projectedNoTenderFallback.summary !== validPortalProcedureMention) {
  throw new Error("Gültiger Fallback wird nach verworfenem AI-Bietercockpit-No-Tender-Text nicht verwendet");
}
const projectedNoTenderWithoutFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: JSON.stringify({ summary: noTenderWithScope }),
});
if (projectedNoTenderWithoutFallback.description !== null || projectedNoTenderWithoutFallback.summary !== null) {
  throw new Error("AI-Bietercockpit-No-Tender-Text blieb ohne Fallback öffentlich sichtbar");
}
const observed24246DerivedManual = "Benutzerhandbuch beschreibt gesamten Funktionsumfang Software BIETER COCKPIT, einschließlich Vergaberecherche, Bearbeitung Vergabeunterlagen, Erstellung Abgabe digitaler Angebote, Leistungsverzeichnisverwaltung, flexible Eignungsprüfung, digitale Signaturverfahren ..., Mantelbogenverfahren Teilnahmeanträge.";
if (normalizePublicDisplayCandidate(observed24246DerivedManual) !== null) {
  throw new Error("Tender 24246: abgeleiteter Bietercockpit-Handbuchrest wurde als Beschreibung akzeptiert");
}
const structured24246DerivedManual = {
  summary: "## Bekanntmachung",
  description: "## Kurzinfo",
  decision_relevant: { scope: [observed24246DerivedManual] },
};
const projected24246WithoutFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: structured24246DerivedManual,
});
if (projected24246WithoutFallback.description !== null || projected24246WithoutFallback.summary !== null) {
  throw new Error("Tender 24246: verschachtelter Handbuchrest blieb ohne Metadata-Fallback öffentlich sichtbar");
}
const projected24246WithFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: structured24246DerivedManual,
  metadata: { description: metadataDescriptionFallback },
});
if (projected24246WithFallback.description !== metadataDescriptionFallback
  || projected24246WithFallback.summary !== metadataDescriptionFallback) {
  throw new Error("Tender 24246: gültiger Metadata-Fallback wurde nach verworfenem Handbuchrest nicht verwendet");
}
const structured24246TokenizedManual = {
  summary: observed24246DerivedManual,
  description: observed24246DerivedManual,
  decision_relevant: { scope: observed24246DerivedManual.split(/\s+/u) },
};
const projected24246TokenizedWithoutFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: structured24246TokenizedManual,
});
if (projected24246TokenizedWithoutFallback.description !== null
  || projected24246TokenizedWithoutFallback.summary !== null) {
  throw new Error("Tender 24246: tokenisierte Handbuchfragmente blieben ohne Metadata-Fallback öffentlich sichtbar");
}
const projected24246TokenizedWithFallback = projectPublicTenderRecord({
  title: "Lieferung von Schulungsmaterial",
  structured: structured24246TokenizedManual,
  metadata: { description: metadataDescriptionFallback },
});
if (projected24246TokenizedWithFallback.description !== metadataDescriptionFallback
  || projected24246TokenizedWithFallback.summary !== metadataDescriptionFallback) {
  throw new Error("Tender 24246: gültiger Metadata-Fallback wurde nach verworfenen tokenisierten Handbuchfragmenten nicht verwendet");
}
const projectedMeaningfulScopeArray = projectPublicTenderRecord({
  structured: {
    summary: "## Bekanntmachung",
    decision_relevant: {
      scope: ["Lieferung von Schulungsmaterial", "Einrichtung und Wartung"],
    },
  },
});
if (projectedMeaningfulScopeArray.description !== "Lieferung von Schulungsmaterial Einrichtung und Wartung"
  || projectedMeaningfulScopeArray.summary !== projectedMeaningfulScopeArray.description) {
  throw new Error("Sinnvolle strukturierte Summary-Phrasen wurden nicht als gemeinsamer Fallback projiziert");
}
if (normalizePublicDisplayCandidate("94469 Deggendorf Bayern Karte anschauen Hinweis: service.bund.de ist nur die Veröffentlichungsplattform für Ausschreibungen") !== null) {
  throw new Error("Service-Bund-Footer wurde als Standort akzeptiert");
}
if (normalizePublicDisplayCandidate("Öffentliche Ausschreibung für Bauleistungen") !== "Öffentliche Ausschreibung für Bauleistungen") {
  throw new Error("Gültiger deutscher Kandidat wurde verändert");
}
if (pickValidatedPublicCandidate("## Kurzinfo", "-", "Dokumentierte Bauleistungen in Mainz") !== "Dokumentierte Bauleistungen in Mainz") {
  throw new Error("Validierter Fallback wählt keinen gültigen Kandidaten");
}
const sourceBackedDescription = "Die Lieferung und Montage umfasst neue Fenster für die Grundschule.";
const sourceBackedEvidence = `Leistungsumfang: ${sourceBackedDescription}`;
if (pickSourceBackedPublicCandidate(
  sourceBackedEvidence,
  "## Kurzinfo",
  "Eine nicht belegte, aber formal saubere Beschreibung.",
  sourceBackedDescription,
) !== sourceBackedDescription) {
  throw new Error("Ungueltige oder nicht quellengestuetzte Kandidaten blockieren keinen spaeteren belegten Summary-Fallback");
}
if (pickSourceBackedPublicCandidate(sourceBackedEvidence, undefined, "## Bekanntmachung") !== "") {
  throw new Error("Leere oder ungueltige Metadaten duerfen nicht zu unvalidiertem Beschreibungstext fuehren");
}
if (pickValidatedPublicCandidate("Anmelden", "Dokumentierte Bauleistungen in Mainz") !== "Dokumentierte Bauleistungen in Mainz"
  || pickValidatedPublicCandidate("Formblatt 1", "Die Stadt beauftragt die Ausführung von Wegebauarbeiten im öffentlichen Raum.") !== cleanText) {
  throw new Error("Ungültiger kurzer Summary-Kandidat blockiert keinen gültigen Fallback");
}
if (pickValidatedPublicClient("Anmelden erforderlich, um Zugriff zu erhalten", "Stadt Mainz") !== "Stadt Mainz") {
  throw new Error("Validierter Auftraggeber-Fallback wählt keinen gültigen Kandidaten");
}
if (pickValidatedPublicLocationForTender("Erneuerung Energiezentrale in Bautzen", "Stadt Bautzen", "Erneuerung Energiezentrale in Bautzen") !== "") {
  throw new Error("Ausschreibungstitel wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Messung in Bonn", "Bundesministerium", "53113 Bonn zu richten.") !== "") {
  throw new Error("Postalische Anweisung wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Wetterwarte Görlitz", "Bundesrepublik Deutschland, Deutscher Wetterdienst", "Deutscher Wetterdienst") !== "") {
  throw new Error("Auftraggeber wurde als Standort übernommen");
}
if (pickValidatedPublicLocationForTender("Erneuerung Energiezentrale in Bautzen", "Stadt Bautzen", "Erneuerung Energiezentrale in Bautzen", "02625 Bautzen") !== "02625 Bautzen") {
  throw new Error("Ungültiger erster Standortkandidat blockiert keinen gültigen Fallback");
}
for (const invalidLocation of [
  "00023 Anzahl Lose",
  "85435 NUTS-3-Code",
  "Ort der Leistungserbringung ist Dessau-Roßlau. 6.",
  "94469 Deggendorf Bayern Karte anschauen Hinweis: service.bund.de",
  "hat die Postleitzahl 30625.",
  "Postleitzahl 30625",
]) {
  if (pickValidatedPublicLocation(invalidLocation) !== "") {
    throw new Error(`Ungültiger Standort wurde akzeptiert: ${invalidLocation}`);
  }
}
const postalCodeFallbackFacts = extractPublicPortalFacts("Der Leistungsort hat die Postleitzahl 30625.");
const postalCodeFallbackProjection = projectPublicDisplayFields({
  location: [postalCodeFallbackFacts.location, "30625"],
});
if (postalCodeFallbackFacts.location !== null || postalCodeFallbackProjection.location !== "30625") {
  throw new Error("Postleitzahl-Fallbackphrase wurde als Standort angezeigt statt den belegten Postleitzahlwert zu verwenden");
}
if (pickValidatedPublicLocation("00023 NUTS-3-Code", "55116 Mainz") !== "55116 Mainz") {
  throw new Error("Standort-Fallback wählt keinen gültigen Kandidaten");
}
if (pickValidatedPublicLocation("Alle Ausschreibungen", "55116 Mainz") !== "55116 Mainz") {
  throw new Error("Ungültiger kurzer Standort-Kandidat blockiert keinen gültigen Fallback");
}
const portalActionLabels = ["Login", "Log in", "Sign in", "Anmeldung", "Registrieren", "Registrierung"];
for (const label of portalActionLabels) {
  const projectedLabelFallback = projectPublicDisplayFields({
    summary: [label, cleanText],
    location: [label, "55116 Mainz"],
  });
  if (normalizePublicDisplayCandidate(label) !== null
    || pickValidatedPublicCandidate(label, cleanText) !== cleanText
    || pickValidatedPublicLocation(label, "55116 Mainz") !== "55116 Mainz"
    || projectedLabelFallback.summary !== cleanText
    || projectedLabelFallback.location !== "55116 Mainz") {
    throw new Error(`Portalaktion wurde als Zusammenfassung/Standort akzeptiert oder blockiert den Fallback: ${label}`);
  }
}
const inlineMarkdownCandidates = [
  "[Lieferung von Schulungsmaterial](https://example.test)",
  "**Lieferung von Schulungsmaterial**",
  "*Lieferung von Schulungsmaterial*",
  "`Lieferung von Schulungsmaterial`",
];
for (const markdownCandidate of inlineMarkdownCandidates) {
  const projectedMarkdownFallback = projectPublicDisplayFields({
    summary: [markdownCandidate, cleanText],
    location: [markdownCandidate, "55116 Mainz"],
  });
  if (normalizePublicDisplayCandidate(markdownCandidate) !== null
    || pickValidatedPublicCandidate(markdownCandidate, cleanText) !== cleanText
    || pickValidatedPublicLocation(markdownCandidate, "55116 Mainz") !== "55116 Mainz"
    || projectedMarkdownFallback.summary !== cleanText
    || projectedMarkdownFallback.location !== "55116 Mainz") {
    throw new Error(`Inline-Markdown wurde als Zusammenfassung/Standort akzeptiert oder blockiert den Fallback: ${markdownCandidate}`);
  }
}
const genuineRegistrationProse = "Die Bieter registrieren sich vor Teilnahme am Vergabeverfahren; ausgeschrieben ist die Lieferung von Schulungsmaterial.";
if (normalizePublicDisplayCandidate(genuineRegistrationProse) !== genuineRegistrationProse) {
  throw new Error("Legitime deutsche Ausschreibungsprosa mit Registrierungsbezug wurde als Portalaktion verworfen");
}
if (normalizePublicDisplayCandidate("Auftraggeber / Ausschreibende Stelle Stadt Mainz") !== "Auftraggeber / Ausschreibende Stelle Stadt Mainz") {
  throw new Error("Gültiger Beschreibungstext wurde unerwartet verändert");
}
const normalizedMeta = readPublicTenderMeta({
  client: "Auftraggeber / Ausschreibende Stelle Stadt Mainz",
  location: "Erfüllungsort: 55116 Mainz",
  description: cleanText,
  descriptionMarkdown: "## Ungeprüfte Beschreibung",
}, { title: "Sanierung in Mainz", source: "dtvp" });
if (normalizedMeta.client !== "Stadt Mainz" || normalizedMeta.location !== "55116 Mainz" || normalizedMeta.description !== cleanText) {
  throw new Error("Öffentliche Metadaten wurden nicht einheitlich normalisiert");
}
if (normalizedMeta.descriptionMarkdown !== "") {
  throw new Error("Ungeprüftes Meta-Markdown wurde übernommen");
}

const surfaceFixture = {
  metadataDescription: "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -",
  structuredSummary: "Sanierung der Turnhalle in Mainz",
  metadataLocation: "##",
  structuredLocation: "55116 Mainz",
};
const listSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.metadataDescription, surfaceFixture.structuredSummary),
  location: pickValidatedPublicCandidate(surfaceFixture.metadataLocation, surfaceFixture.structuredLocation),
};
const modalSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.metadataDescription, surfaceFixture.structuredSummary),
  location: pickValidatedPublicCandidate(surfaceFixture.metadataLocation, surfaceFixture.structuredLocation),
};
const detailSurface = {
  description: pickValidatedPublicCandidate(surfaceFixture.structuredSummary, surfaceFixture.metadataDescription),
  location: pickValidatedPublicCandidate(surfaceFixture.structuredLocation, surfaceFixture.metadataLocation),
};
if (JSON.stringify(listSurface) !== JSON.stringify(modalSurface)
  || JSON.stringify(modalSurface) !== JSON.stringify(detailSurface)) {
  throw new Error("Listenansicht, Modal und Detailseite wählen keine konsistenten Anzeige-Fallbacks");
}

const projectedDisplay = projectPublicDisplayFields({
  title: ["## Bekanntmachung", "Erneuerung Energiezentrale in Bautzen"],
  client: ["Anmelden erforderlich, um Zugriff zu erhalten", "Stadt Bautzen"],
  location: ["Erneuerung Energiezentrale in Bautzen", "02625 Bautzen"],
  summary: ["- Verfahren - - - Lose - Ergebnisse - Verträge - - - -", "Dokumentierte Bauleistungen in Bautzen"],
  descriptionMarkdown: ["## Ungeprüft", "- **Zusammenfassung:** Dokumentierte Bauleistungen in Bautzen"],
});
if (projectedDisplay.title !== "Erneuerung Energiezentrale in Bautzen"
  || projectedDisplay.client !== "Stadt Bautzen"
  || projectedDisplay.location !== "02625 Bautzen"
  || projectedDisplay.summary !== "Dokumentierte Bauleistungen in Bautzen"
  || projectedDisplay.description !== "Dokumentierte Bauleistungen in Bautzen"
  || projectedDisplay.descriptionMarkdown !== "- **Zusammenfassung:** Dokumentierte Bauleistungen in Bautzen") {
  throw new Error("Gemeinsame öffentliche Anzeigeprojektion verwirft ungültige Kandidaten nicht konsistent");
}

if (pickValidatedPublicCandidate("- - -", "Dokumentierte Bauleistungen in Mainz") !== "Dokumentierte Bauleistungen in Mainz") {
  throw new Error("Ein nach Bereinigung leerer Kandidat blockiert keinen gültigen Fallback");
}
if (pickPublicTenderDescription({ rawText: "Nur internes Analyse-Korpus ohne öffentliche Freigabe" }) !== "") {
  throw new Error("Internes raw_text wurde als öffentlicher Beschreibungskandidat verwendet");
}

const sharedTenderSource = {
  title: "Sanierung der Turnhalle in Mainz",
  metadata: JSON.stringify({
    description: "## Bekanntmachung",
    client: "Anmelden erforderlich, um Zugriff zu erhalten",
    city: "##",
  }),
  structured: JSON.stringify({
    summary: "Dokumentierte Bauleistungen in Mainz",
    hardFacts: { buyer: "Stadt Mainz", location: "55116 Mainz" },
  }),
};
const recordListSurface = projectPublicTenderRecord(sharedTenderSource);
const recordModalSurface = projectPublicDisplayFields({
  title: sharedTenderSource.title,
  client: ["Anmelden erforderlich, um Zugriff zu erhalten", "Stadt Mainz"],
  location: ["##", "55116 Mainz"],
  summary: ["## Bekanntmachung", "Dokumentierte Bauleistungen in Mainz"],
});
const recordDetailSurface = projectPublicTenderRecord(sharedTenderSource);
const projectedSurfaces = [recordListSurface, recordModalSurface, recordDetailSurface];
if (projectedSurfaces.some((surface) => JSON.stringify(surface) !== JSON.stringify(projectedSurfaces[0]))) {
  throw new Error("Listenansicht, Modal und SSR nutzen nicht dieselbe öffentliche Projektion");
}
if (projectedSurfaces[0].client !== "Stadt Mainz"
  || projectedSurfaces[0].location !== "55116 Mainz"
  || projectedSurfaces[0].description !== "Dokumentierte Bauleistungen in Mainz") {
  throw new Error("Verschachtelte/JSON-stringifizierte Structured-Daten wurden nicht projiziert");
}

const historicalAccessSummary = "Für „Praxistage im Ökolandbau“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Auftraggeber: Ministerium für Landwirtschaft, Weinbau, Umwelt und Forsten; Verfahren: zugänglich..; Angebotsfrist: 08.08.2026 23:59; Leistungsort: Mainz; Leistungsumfang: Durchführung von Praxistagen. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.";
const normalizedHistoricalAccessSummary = normalizePublicDisplayCandidate(historicalAccessSummary);
if (!normalizedHistoricalAccessSummary
  || normalizedHistoricalAccessSummary.includes("Verfahren: zugänglich")
  || normalizedHistoricalAccessSummary.includes("zugänglich..")
  || !normalizedHistoricalAccessSummary.includes("Auftraggeber: Ministerium für Landwirtschaft, Weinbau, Umwelt und Forsten")
  || !normalizedHistoricalAccessSummary.includes("Angebotsfrist: 08.08.2026 23:59")
  || !normalizedHistoricalAccessSummary.includes("Leistungsort: Mainz")
  || !normalizedHistoricalAccessSummary.includes("Leistungsumfang: Durchführung von Praxistagen")
  || !normalizedHistoricalAccessSummary.includes("Die vollständige Leistungsbeschreibung")) {
  throw new Error("Historischer Zugangstext wurde nicht eng und faktenwahrend normalisiert");
}
const projectedHistoricalAccess = projectPublicDisplayFields({ summary: historicalAccessSummary });
if (!projectedHistoricalAccess.summary || projectedHistoricalAccess.summary.includes("Verfahren: zugänglich")) {
  throw new Error("Gemeinsame Anzeigeprojektion liefert weiterhin ein ungültiges Zugangsverfahren");
}
const accessFallbackWithoutProcedure = "Für „Sanierung in Mainz“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Auftraggeber: Stadt Mainz; Angebotsfrist: 03.08.2026 08:00; Leistungsort: 55116 Mainz; Leistungsumfang: Sanierung der Turnhalle. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.";
if (!normalizePublicDisplayCandidate(accessFallbackWithoutProcedure)) {
  throw new Error("Gültiger Access-Fallback ohne Verfahren wurde verworfen");
}
const accessFallbackWithProcedure = accessFallbackWithoutProcedure.replace("Angebotsfrist:", "Verfahren: Offenes Verfahren; Angebotsfrist:");
if (!normalizePublicDisplayCandidate(accessFallbackWithProcedure)?.includes("Verfahren: Offenes Verfahren")) {
  throw new Error("Gültiges offenes Verfahren wurde aus dem Access-Fallback entfernt");
}
const accessFallbackWithPortalProcedure = accessFallbackWithoutProcedure.replace(
  "Angebotsfrist:",
  "Verfahren: Offenes Verfahren (sangaben); Angebotsfrist:",
);
const normalizedAccessFallbackWithPortalProcedure = normalizePublicDisplayCandidate(accessFallbackWithPortalProcedure);
if (!normalizedAccessFallbackWithPortalProcedure
  || !normalizedAccessFallbackWithPortalProcedure.includes("Verfahren: Offenes Verfahren")
  || normalizedAccessFallbackWithPortalProcedure.includes("sangaben")) {
  throw new Error("Bekanntes Portalfragment im Access-Fallback wurde nicht entfernt");
}
const accessFallbackWithTruncatedProcedure = accessFallbackWithoutProcedure.replace(
  "Angebotsfrist:",
  "Verfahren: Verhandlungsverfahren mit; Angebotsfrist:",
);
const normalizedAccessFallbackWithTruncatedProcedure = normalizePublicDisplayCandidate(accessFallbackWithTruncatedProcedure);
if (!normalizedAccessFallbackWithTruncatedProcedure
  || !normalizedAccessFallbackWithTruncatedProcedure.includes("Verfahren: Verhandlungsverfahren")
  || normalizedAccessFallbackWithTruncatedProcedure.includes("Verfahren: Verhandlungsverfahren mit")) {
  throw new Error("Abgeschnittenes Verfahren wurde im Access-Fallback nicht auf den Fakten-Basiswert reduziert");
}

const repairedAccessFields = repairPublicDescriptionFields({
  description: historicalAccessSummary,
  summary: historicalAccessSummary,
});
const repairedDescription = repairedAccessFields.record.description;
const repairedSummary = repairedAccessFields.record.summary;
if (typeof repairedDescription !== "string"
  || typeof repairedSummary !== "string"
  || repairedDescription.includes("Verfahren: zugänglich")
  || repairedSummary.includes("zugänglich..")) {
  throw new Error("Backfill repariert den historischen Zugangs-Text nicht faktenwahrend");
}
const unchangedPublicFields = repairPublicDescriptionFields({
  description: "Offenes Verfahren",
  summary: "Die Stadt beauftragt die Ausführung von Wegebauarbeiten im öffentlichen Raum.",
});
if (unchangedPublicFields.descriptionChanged || unchangedPublicFields.summaryChanged
  || unchangedPublicFields.record.description !== "Offenes Verfahren"
  || unchangedPublicFields.record.summary !== cleanText) {
  throw new Error("Backfill überschreibt gültige öffentliche Felder unnötig");
}
const summaryFallback = repairPublicDescriptionFields({
  description: "## Bekanntmachung",
  summary: "Dokumentierte Bauleistungen in Mainz",
});
if (!summaryFallback.descriptionChanged
  || summaryFallback.record.description !== "Dokumentierte Bauleistungen in Mainz"
  || summaryFallback.record.summary !== "Dokumentierte Bauleistungen in Mainz") {
  throw new Error("Backfill verwendet keinen gültigen Summary-Fallback");
}

const existingCanonicalMarkdown = buildTenderDescriptionMarkdown({ summary: "Bisherige kanonische Markdown-Beschreibung." });
const generatedCanonicalMarkdown = buildTenderDescriptionMarkdown({ summary: "Aktualisierte kanonische Markdown-Beschreibung." });
if (selectPublicDescriptionMarkdown(
  { descriptionMarkdown: existingCanonicalMarkdown },
  generatedCanonicalMarkdown,
  false,
) !== existingCanonicalMarkdown) {
  throw new Error("Unveränderte öffentliche Felder überschreiben kein vorhandenes kanonisches Markdown");
}
if (selectPublicDescriptionMarkdown(
  { descriptionMarkdown: existingCanonicalMarkdown },
  generatedCanonicalMarkdown,
  summaryFallback.descriptionChanged || summaryFallback.summaryChanged,
) !== generatedCanonicalMarkdown) {
  throw new Error("Reparierte öffentliche Felder aktualisieren das kanonische Markdown nicht");
}
for (const invalidMarkdown of [undefined, "## Ungeprüfte Beschreibung"]) {
  if (selectPublicDescriptionMarkdown(
    { descriptionMarkdown: invalidMarkdown },
    generatedCanonicalMarkdown,
    false,
  ) !== generatedCanonicalMarkdown) {
    throw new Error("Fehlendes oder ungültiges Markdown wird nicht kanonisch neu generiert");
  }
}
if (!shouldSyncPublicDescriptionBackfillMeili(false, true)
  || shouldSyncPublicDescriptionBackfillMeili(true, true)
  || shouldSyncPublicDescriptionBackfillMeili(false, false)) {
  throw new Error("Expliziter Meilisearch-Sync wird nicht unabhängig von Änderungen oder im Dry-Run korrekt ausgewertet");
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
if (!isCanonicalPublicDescriptionMarkdown(markdown)) {
  throw new Error("Generiertes Markdown wird nicht als kanonische Anzeige erkannt");
}
const escapedMarkdown = buildTenderDescriptionMarkdown({ client: "Stadt < 5 `A` ~~B~~" });
if (!escapedMarkdown.includes("Stadt \\< 5 \\`A\\` \\~\\~B\\~\\~")
  || !isCanonicalPublicDescriptionMarkdown(escapedMarkdown)) {
  throw new Error("Markdown-Sonderzeichen werden nicht sicher und kanonisch escaped");
}
const oddEscapeMarkdown = buildTenderDescriptionMarkdown({ client: "Stadt * Mainz" });
if (!oddEscapeMarkdown.includes("Stadt \\* Mainz") || !isCanonicalPublicDescriptionMarkdown(oddEscapeMarkdown)) {
  throw new Error("Builder-erzeugtes Markdown mit ungeradem Escape-Backslash wurde verworfen");
}
const evenEscapeMarkdown = String.raw`- **Zusammenfassung:** \\*ungeprüfte Formatierung\\*`;
if (isCanonicalPublicDescriptionMarkdown(evenEscapeMarkdown)) {
  throw new Error("Gerade Backslash-Folge wurde fälschlich als Escape vor Markdown-Emphasis akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("## Ungeprüfte Beschreibung\n- Rohdaten")) {
  throw new Error("Ungeprüftes Markdown wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** ... Dienstleistungen ## CPV-Codes ...")) {
  throw new Error("Inline-Markdown-Rest wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** **ungeprüfte Formatierung**")) {
  throw new Error("Unescaped Markdown-Formatierung wurde als kanonisch akzeptiert");
}
if (isCanonicalPublicDescriptionMarkdown("- **Zusammenfassung:** ~~ungeprüfte Formatierung~~")) {
  throw new Error("Unescaped Markdown-Durchstreichung wurde als kanonisch akzeptiert");
}

const groundedSource = "**Auftraggeber:** Stadt Mainz\n**Angebotsfrist:** 14.08.2026, 10:00 Uhr\n**Erfüllungsort:** 55116&nbsp;Mainz\nLeistungsgegenstand: Lieferung von Schulungsmaterial\nfür Schulen.";
const groundedFacts = groundPublicTenderFields({
  title: "Lieferung von Schulungsmaterial für Schulen",
  client: "Stadt Mainz",
  deadline: "2026-08-14",
  description: "Lieferung von Schulungsmaterial für Schulen.",
  scope: "Lieferung von Schulungsmaterial für Schulen.",
  location: "55116 Mainz",
  requirements: ["Lieferung von Schulungsmaterial für Schulen.", "Mindestens 10 Jahre Erfahrung"],
}, groundedSource);
if (groundedFacts.title !== "Lieferung von Schulungsmaterial für Schulen"
  || groundedFacts.client !== "Stadt Mainz"
  || groundedFacts.deadline !== "2026-08-14"
  || groundedFacts.description !== "Lieferung von Schulungsmaterial für Schulen."
  || groundedFacts.scope !== "Lieferung von Schulungsmaterial für Schulen."
  || groundedFacts.location !== "55116 Mainz"
  || JSON.stringify(groundedFacts.requirements) !== JSON.stringify(["Lieferung von Schulungsmaterial für Schulen."])) {
  throw new Error("Explizite Quellfakten mit Whitespace-/Entity-Normalisierung wurden nicht erhalten");
}
const unsupportedFacts = groundPublicTenderFields({
  title: "Sanierung des Rathauses in Berlin",
  client: "Landeshauptstadt Berlin",
  deadline: "2026-08-28",
  description: "Die Stadt Mainz plant eine umfassende Beschaffung von Schulungsmaterial für alle Schulen.",
  scope: "Die Lieferung umfasst außerdem Installation und langfristige Wartung.",
  location: "10115 Berlin",
  requirements: ["Mindestens 10 Jahre Erfahrung"],
}, groundedSource);
if (unsupportedFacts.title !== ""
  || unsupportedFacts.client !== ""
  || unsupportedFacts.deadline !== null
  || unsupportedFacts.description !== ""
  || unsupportedFacts.scope !== ""
  || unsupportedFacts.location !== null
  || JSON.stringify(unsupportedFacts.requirements) !== "[]") {
  throw new Error("Nicht belegte LLM-Fakten wurden nicht sicher in leere Werte zurückgewiesen");
}
const unsafeCanonicalHints = [
  "SERVICE.BUND.DE - Aktuelle Ausschreibungen",
  "Haupt-Navigations-Menü",
  "Meta-Navigation",
  "Andere Ausschreibungen im Bereich",
  "VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift",
  "Anmelden erforderlich, um Zugriff zu erhalten",
  "<p>Portaltext</p>",
  "�ffentliche Ausschreibung Ã–ffentliche Straße",
];
for (const hint of unsafeCanonicalHints) {
  if (isCanonicalPublicDescriptionMarkdown(`- **Hinweis:** ${hint}`)) {
    throw new Error(`Ungeprüfter Hinweis wurde als kanonisches Markdown akzeptiert: ${hint}`);
  }
}
const safeHintMarkdown = "- **Hinweis:** Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal derzeit nicht öffentlich verfügbar.";
const hintMarkdownFallback = projectPublicDisplayFields({
  descriptionMarkdown: [
    "- **Hinweis:** Andere Ausschreibungen im Bereich",
    safeHintMarkdown,
  ],
});
if (!isCanonicalPublicDescriptionMarkdown(safeHintMarkdown)
  || hintMarkdownFallback.descriptionMarkdown !== safeHintMarkdown) {
  throw new Error("Kanonischer Hinweis-Fallback verwirft gute Prosa oder übernimmt Navigation");
}

const accessFacts = extractPublicPortalFacts(
  "Auftraggeber / Ausschreibende Stelle Stadt Mainz Vergabeart Offenes Verfahren Abgabefrist 03.08.2026 08:00 Erfüllungsort 55116 Mainz Leistungsgegenstand Softwareentwicklung",
);
const cpvVmpFacts = extractPublicPortalFacts("Leistungsgegenstand: 45000000-7 Bauarbeiten VMP 11.5.2");
if (cpvVmpFacts.subject !== "45000000-7 Bauarbeiten") {
  throw new Error(`Terminale VMP-Version blieb im CPV-Leistungsgegenstand: ${cpvVmpFacts.subject}`);
}
if (extractPublicPortalFacts("Leistungsgegenstand: 45000000-7 Bauarbeiten VMP 11.5.2.").subject !== "45000000-7 Bauarbeiten") {
  throw new Error("Satzzeichen nach der terminalen VMP-Version verhinderten die CPV-Bereinigung");
}
for (const subject of [
  "Bauarbeiten VMP 11.5.2",
  "45000000-7 Bauarbeiten VMP 11.5.2 zusätzlicher Text",
]) {
  if (extractPublicPortalFacts(`Leistungsgegenstand: ${subject}`).subject !== subject) {
    throw new Error(`VMP-Versionstext außerhalb eines terminalen CPV-Suffixes wurde verändert: ${subject}`);
  }
}
const historicalCpvVmpSummary = "Für „Bauarbeiten“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Leistungsgegenstand: 45000000-7 Bauarbeiten VMP 11.5.2. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.";
const projectedHistoricalCpvVmp = projectPublicTenderRecord({
  title: "Bauarbeiten",
  metadata: { access_limited: true, description: historicalCpvVmpSummary },
});
if (projectedHistoricalCpvVmp.description?.includes("VMP 11.5.2")
  || !projectedHistoricalCpvVmp.description?.includes("Leistungsgegenstand: 45000000-7 Bauarbeiten")) {
  throw new Error("Historischer Access-Summary wurde in der normalen Tender-Projektion nicht von der VMP-Version bereinigt");
}
const historicalCpvVmpMeta = readPublicTenderMeta({
  access_limited: true,
  description: historicalCpvVmpSummary,
}, { title: "Bauarbeiten", source: "dtvp" });
if (historicalCpvVmpMeta.description.includes("VMP 11.5.2")
  || !historicalCpvVmpMeta.description.includes("Leistungsgegenstand: 45000000-7 Bauarbeiten")) {
  throw new Error("Historischer Access-Summary wurde beim Lesen der Tender-Metadaten nicht von der VMP-Version bereinigt");
}
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
if (!isCanonicalPublicDescriptionMarkdown(accessMarkdown)) {
  throw new Error("Zugangsbeschränkte Markdown-Beschreibung ist nicht kanonisch");
}

const accessWallFacts = extractPublicPortalFacts(
  "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen. Bestätigen Sie die Teilnahme am Verfahren um folgende Vorteile nutzen zu können. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.",
);
if (accessWallFacts.procedure !== null) {
  throw new Error(`Zugangs-/Teilnahmehinweis wurde als Verfahren publiziert: ${accessWallFacts.procedure}`);
}
const accessWallDescription = buildPublicAccessLimitedDescription("Zugangsbeschränkte Ausschreibung", accessWallFacts);
const accessWallMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Zugangsbeschränkte Ausschreibung", accessWallFacts);
for (const generated of [accessWallDescription, accessWallMarkdown]) {
  if (generated.includes("Verfahren: zugänglich") || generated.includes("zugänglich..")) {
    throw new Error("Generierter Zugangstext enthält einen ungültigen Zugänglichkeitswert");
  }
  if (/Um Zugriff auf dieses Modul|Bestätigen Sie die Teilnahme|müssen Sie am Vergabeverfahren teilnehmen/i.test(generated)) {
    throw new Error("Rohe Teilnahme-/Wall-Prosa wurde in den generierten Zugangstext übernommen");
  }
}
if (accessWallDescription !== `Für „Zugangsbeschränkte Ausschreibung“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal derzeit nicht öffentlich verfügbar.`) {
  throw new Error("Zugangstext ohne verlässliche Fakten ist nicht neutral kanonisch");
}
if (normalizedHistoricalAccessSummary?.includes("erst nach Teilnahme am Verfahren zugänglich")) {
  throw new Error("Historischer Access-Fallback enthält eine nicht belegte Zugangsvoraussetzung");
}
if (!isCanonicalPublicDescriptionMarkdown(accessWallMarkdown)) {
  throw new Error("Zugangsbeschränkte Markdown-Beschreibung ist nach Wall-Bereinigung nicht kanonisch");
}
const validProcedureFacts = extractPublicPortalFacts("Vergabeart: Offenes Verfahren");
if (validProcedureFacts.procedure !== "Offenes Verfahren") {
  throw new Error("Gültiges Verfahren wurde fälschlich verworfen");
}
for (const [raw, expected] of [
  ["Offenes Verfahren (sangaben)", "Offenes Verfahren"],
  ["Offenes Verfahren (Losangaben)", "Offenes Verfahren"],
  ["Offenes Verfahren Angaben zu den Losen", "Offenes Verfahren"],
  ["Offenes Verfahren", "Offenes Verfahren"],
  ["Nichtoffenes Verfahren", "Nichtoffenes Verfahren"],
  ["Nicht offenes Verfahren mit", "Nicht offenes Verfahren"],
  ["Verhandlungsverfahren", "Verhandlungsverfahren"],
  ["Verhandlungsverfahren mit", "Verhandlungsverfahren"],
  ["Verhandlungsverfahren ohne", "Verhandlungsverfahren"],
  ["Verhandlungsverfahren mit Teilnahmewettbewerb", "Verhandlungsverfahren mit Teilnahmewettbewerb"],
] as const) {
  if (normalizePublicProcedureCandidate(raw) !== expected) {
    throw new Error(`Verfahrensnormalisierung verändert ${raw} unerwartet`);
  }
}
const tender29014Title = "Auswahlverfahren Ausbildung / Studium ab EJ 2027";
const tender29014TruncatedProcedure = "Verhandlungsvergabe mit öffentlichem";
const tender29014BaseProcedure = "Verhandlungsvergabe";
const tender29014CompleteProcedure = "Verhandlungsvergabe mit öffentlichem Teilnahmewettbewerb";
if (normalizePublicProcedureCandidate(tender29014TruncatedProcedure) !== tender29014BaseProcedure
  || normalizePublicProcedureCandidate(tender29014CompleteProcedure) !== tender29014CompleteProcedure) {
  throw new Error("Tender 29014: abgeschnittenes Verfahren wurde nicht auf den Basiswert reduziert oder vollständiger Wert verändert");
}
const tender29014Facts = extractPublicPortalFacts(
  `Auftraggeber: Ausbildungswerk Stadt Mainz Vergabeart: ${tender29014TruncatedProcedure} Abgabefrist: 03.08.2026 10:00`,
);
if (tender29014Facts.procedure !== tender29014BaseProcedure) {
  throw new Error(`Tender 29014: Access-Fakten liefern nicht den erwarteten Basiswert: ${tender29014Facts.procedure}`);
}
const tender29014Description = buildPublicAccessLimitedDescription(tender29014Title, tender29014Facts);
const tender29014Markdown = buildPublicAccessLimitedDescriptionMarkdown(tender29014Title, tender29014Facts);
for (const generated of [tender29014Description, tender29014Markdown]) {
  if (!generated.includes(tender29014BaseProcedure)
    || generated.includes(tender29014TruncatedProcedure)
    || generated.includes(tender29014CompleteProcedure)) {
    throw new Error("Tender 29014: abgeschnittenes Verfahren erscheint weiterhin im öffentlichen Access-Fallback");
  }
}
const tender29014GeneratedAccessSummary = `Für „${tender29014Title}“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Verfahren: ${tender29014TruncatedProcedure}; Angebotsfrist: 03.08.2026 10:00. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.`;
const normalizedTender29014GeneratedAccessSummary = normalizePublicDisplayCandidate(tender29014GeneratedAccessSummary);
if (!normalizedTender29014GeneratedAccessSummary
  || !normalizedTender29014GeneratedAccessSummary.includes(`Verfahren: ${tender29014BaseProcedure}`)
  || normalizedTender29014GeneratedAccessSummary.includes(tender29014TruncatedProcedure)
  || normalizedTender29014GeneratedAccessSummary.includes(tender29014CompleteProcedure)) {
  throw new Error("Tender 29014: generierter Access-Summary-Pfad veröffentlicht das abgeschnittene Verfahren");
}
const tender29014Meta = readPublicTenderMeta({
  access_limited: true,
  description: tender29014GeneratedAccessSummary,
  procedure: tender29014TruncatedProcedure,
}, { title: tender29014Title, source: "dtvp" });
if (tender29014Meta.procedure !== tender29014BaseProcedure
  || tender29014Meta.description.includes(tender29014TruncatedProcedure)
  || tender29014Meta.description.includes(tender29014CompleteProcedure)) {
  throw new Error("Tender 29014: Form-/Access-Fallback gibt das abgeschnittene Verfahren öffentlich aus");
}
if (normalizePublicProcedureCandidate("(Losangaben)") !== null
  || normalizePublicProcedureCandidate("mit") !== null
  || pickValidatedPublicProcedure("mit", "Verhandlungsverfahren") !== "Verhandlungsverfahren"
  || pickValidatedPublicProcedure("(Losangaben)", "Verhandlungsverfahren") !== "Verhandlungsverfahren") {
  throw new Error("Ungültiges Portalfragment blockiert keinen späteren gültigen Verfahrenswert");
}
for (const accessOnlyProcedure of ["zugänglich", "verfügbar", "nicht verfügbar"]) {
  if (extractPublicPortalFacts(`Verfahren: ${accessOnlyProcedure}.`).procedure !== null) {
    throw new Error(`Generischer Zugangswert wurde als Verfahren akzeptiert: ${accessOnlyProcedure}`);
  }
}
const punctuationFacts = {
  client: "Stadt Mainz.",
  procedure: "Offenes Verfahren.",
  deadline: null,
  location: null,
  subject: null,
};
const punctuationDescription = buildPublicAccessLimitedDescription("Sanierung in Mainz", punctuationFacts);
const punctuationMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Sanierung in Mainz", punctuationFacts);
if (punctuationDescription.includes("Offenes Verfahren..") || punctuationMarkdown.includes("Offenes Verfahren..")) {
  throw new Error("Abschließende Satzzeichen wurden im Zugangstext verdoppelt");
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
const invalidFirstFacts = extractPublicPortalFacts([
  "Vergabestelle: Anmelden erforderlich, um Zugriff zu erhalten",
  "Auftraggeber / Ausschreibende Stelle",
  "Stadt Mainz",
].join("\n"));
if (invalidFirstFacts.client !== "Stadt Mainz") {
  throw new Error("Ungültiger erster Auftraggeber blockiert keinen gültigen Fallback");
}
const bundMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Generalsanierung Kläranlage", bundFacts);
if (/service\.bund|navigations|andere ausschreibungen/i.test(bundMarkdown)) {
  throw new Error("Service-Bund-Navigation ist in Fakten-Markdown gelangt");
}

const testResponseEncoding = async (): Promise<void> => {
  const windows1252Bytes = Buffer.from([
    ...Buffer.from("Öffentliche Ausschreibung ", "latin1"),
    0x96,
    ...Buffer.from(" Straße ", "latin1"),
    0x80,
  ]);
  const windows1252Text = decodePublicResponseBytes(windows1252Bytes, "text/html; charset=windows-1252");
  if (windows1252Text !== "Öffentliche Ausschreibung – Straße €"
    || windows1252Text.includes("\uFFFD")
    || /[ÃÂ]/u.test(windows1252Text)) {
    throw new Error("Windows-1252-Response wurde als U+FFFD/Mojibake dekodiert");
  }
  const responseText = await readPublicResponseText(new Response(
    Buffer.from("Leistungsbeschreibung für Gebäude", "latin1"),
    { headers: { "content-type": "text/html; charset=ISO-8859-1" } },
  ));
  if (responseText !== "Leistungsbeschreibung für Gebäude") {
    throw new Error("ISO-8859-1-Response wurde nicht korrekt dekodiert");
  }
  if (decodePublicResponseBytes(Buffer.from("UTF-8 fallback"), "text/html; charset=unbekannt") !== "UTF-8 fallback") {
    throw new Error("Unbekanntes Charset verhindert den sicheren UTF-8-Fallback");
  }
  if (normalizePublicDisplayCandidate("�ffentliche Ausschreibung Ã–ffentliche Straße") !== null) {
    throw new Error("U+FFFD/Mojibake wurde als öffentlicher Anzeigetext akzeptiert");
  }
  if (cleanTenderTitle("Strasse Gebaeude Gelaende") !== "Straße Gebäude Gelände") {
    throw new Error("Bekannte deutsche Encoding-Reparatur wurde beschädigt");
  }
  if (!cleanTenderTitle("�ffentliche Ausschreibung").includes("\uFFFD")) {
    throw new Error("Unbekanntes Ersatzzeichen wurde durch Löschen mit dem Folgetext verklebt");
  }
};

testResponseEncoding()
  .then(() => console.log("Public-description tests passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
