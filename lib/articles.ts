// SEO: Static article data for /wissen hub — targets informational keywords like "vergabeverfahren übersicht"

export interface Article {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  content: string;
  relatedCategories: string[];
  // SEO: HowTo step data for HowTo JSON-LD rich snippets — only for step-by-step articles
  howToSteps?: Array<{ name: string; text: string }>;
}

export const ARTICLES: Record<string, Article> = {
  "vergabeverfahren-uebersicht": {
    slug: "vergabeverfahren-uebersicht",
    title: "Vergabeverfahren in Deutschland – Übersicht für Unternehmen",
    description:
      "Alle Vergabeverfahren in Deutschland im Überblick: Offenes, nichtoffenes, Verhandlungsverfahren und mehr. Erfahren Sie, welche Verfahren es gibt und wie Bieter teilnehmen können.",
    datePublished: "2025-01-15",
    dateModified: "2025-01-15",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Planungsleistungen"],
    content: `
## Was sind Vergabeverfahren?

Vergabeverfahren sind die geregelten Prozesse, über die öffentliche Auftraggeber Aufträge an private Unternehmen vergeben. In Deutschland unterliegen sie dem Vergaberecht, das auf EU-Richtlinien basiert und im Gesetz gegen Wettbewerbsbeschränkungen (GWB) sowie in den Vergabeverordnungen (VgV, SektVO, VOB/A, VOL/A) geregelt ist.

## Die wichtigsten Verfahrenstypen

### Offenes Verfahren

Das offene Verfahren ist der Standardfall bei öffentlichen Ausschreibungen. Jedes interessierte Unternehmen kann ein Angebot abgeben. Die Bekanntmachung erfolgt im Bundesanzeiger oder auf TED (Tenders Electronic Daily).

**Merkmale:**
- Keine Teilnahmebeschränkung
- Mindestens 35 Kalendertage Angebotsfrist (EU-Schwellenwert)
- Zwingend objektive Zuschlagskriterien

### Nichtoffenes Verfahren

Beim nichtoffenen Verfahren können nur eingeladene Bieter ein Angebot abgeben. Vorher findet eine Auswahlphase statt, in der der Auftraggeber geeignete Unternehmen identifiziert.

**Merkmale:**
- Zwei-stufig: Auswahl + Angebotsphase
- Mindestens 3 Bewerber müssen eingeladen werden
- Geeignet bei komplexen Leistungen

### Verhandlungsverfahren

Beim Verhandlungsverfahren werden die Vertragsbedingungen mit den Bietern verhandelt. Es gibt Varianten mit und ohne vorherige Bekanntmachung.

**Merkmale:**
- Verhandlungen über Preis und Leistung möglich
- Besonders bei innovativen Leistungen oder unvollständigen Unterlagen
- Mit vorheriger Bekanntmachung: mindestens 3 Bieter

### Wettbewerblicher Dialog

Der wettbewerbliche Dialog wird bei besonders komplexen Projekten eingesetzt, bei denen der Auftraggeber die technischen, rechtlichen oder finanziellen Lösungen nicht im Voraus definieren kann.

### Innovationspartnerschaft

Die Innovationspartnerschaft wurde 2016 eingeführt und ermöglicht die Entwicklung und anschließende Beschaffung innovativer Produkte oder Dienstleistungen.

## Schwellenwerte (2024/2025)

| Bereich | EU-Schwellenwert |
|---------|-----------------|
| Bauaufträge | 5.538.000 € |
| Liefer- und Dienstleistungen (Bund) | 143.000 € |
| Liefer- und Dienstleistungen (Kommunen) | 221.000 € |
| Sektorenaufträge | 452.000 € |

Unterhalb dieser Werte gelten nationale Vergaberegeln mit geringeren Formalanforderungen.

## Tipps für Bieter

1. **Vergabeportale regelmäßig prüfen:** Nutzen Sie Plattformen wie DTVP, TED und evergabe, um neue Ausschreibungen frühzeitig zu erkennen.
2. **Eignungsnachweise vorbereiten:** Halten Sie Referenzen, Bilanzen und Bescheinigungen aktuell.
3. **Fristen im Blick behalten:** Versäumte Fristen sind der häufigste Grund für den Ausschluss.
4. **Nachweise sorgfältig prüfen:** Fehlende oder fehlerhafte Unterlagen führen zur Ablehnung.
5. **AVV und Vergabekriterien genau lesen:** Die Angebots- und Vergabeunterlagen definieren die Anforderungen.
`,
  },

  "vob-vergabe": {
    slug: "vob-vergabe",
    title: "VOB/A Vergabe: Was Bieter über die Vergabe- und Vertragsordnung wissen müssen",
    description:
      "Die VOB/A regelt die Vergabe von Bauaufträgen in Deutschland. Erfahren Sie alles über Verfahren, Zuschlagskriterien und Ihre Rechte als Bieter bei Bauausschreibungen.",
    datePublished: "2025-01-15",
    dateModified: "2025-01-15",
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Planungsleistungen"],
    content: `
## Was ist die VOB/A?

Die Vergabe- und Vertragsordnung für Bauleistungen (VOB) besteht aus drei Teilen:

- **VOB/A** – Allgemeine Bestimmungen für die Vergabe von Bauleistungen
- **VOB/B** – Allgemeine Vertragsbedingungen für die Ausführung von Bauleistungen
- **VOB/C** – Allgemeine Technische Vertragsbedingungen für Bauleistungen

Die VOB/A ist der Teil, der Bieter direkt betrifft, da sie die Regeln für die Vergabe von Bauaufträgen festlegt.

## Geltungsbereich der VOB/A

Die VOB/A gilt für alle öffentlichen Auftraggeber bei der Vergabe von Bauaufträgen und Baukonzessionen. Sie wird durch die Vergabeverordnung (VgV) ergänzt, die EU-Schwellenwerte regelt.

**Unterscheidung:**
- **Unterhalb der EU-Schwellenwerte:** Nationale VOB/A mit vereinfachten Verfahren
- **Oberhalb der EU-Schwellenwerte:** VOB/A in Kombination mit EU-Vorgaben

## Zuschlagskriterien nach VOB/A

Die VOB/A kennt grundsätzlich zwei Zuschlagsmodelle:

### 1. Niedrigstes Angebot (Preis allein)
- Standard bei einfachen, gut definierten Bauleistungen
- Das wirtschaftlichste Angebot gewinnt

### 2. Wirtschaftlichstes Angebot (Preis + Qualität)
- Qualitative, nachhaltige oder funktionale Kriterien werden berücksichtigt
- Beispiel: Preis 70 %, Qualität 20 %, Nachhaltigkeit 10 %

## Typische Eignungsanforderungen

Öffentliche Auftraggeber prüfen die Eignung der Bieter anhand folgender Kriterien:

- **Berufliche Zulassung:** Eintragung in die Handwerksrolle oder vergleichbar
- **Leistungsreferenzen:** Nachweis vergleichbarer Bauleistungen (meist 3 Referenzen)
- **Finanzielle Leistungsfähigkeit:** Jahresabschlüsse, Eigenkapitalquote
- **Technische Ausstattung:** Maschinen, Anlagen, Personal
- **Qualitätssicherung:** Zertifikate wie ISO 9001

## Besonderheiten bei Bauausschreibungen

### Teillosevergabe
Bauaufträge müssen grundsätzlich in Lose aufgeteilt werden, damit auch kleine und mittlere Unternehmen (KMU) teilnehmen können. Ausnahmen sind möglich bei technischer oder wirtschaftlicher Untrennbarkeit.

### Nebenangebote
Nebenangebote sind zulässig, wenn sie in der Ausschreibung nicht ausdrücklich ausgeschlossen sind. Sie müssen das Mindestanforderungserfüllen und klar als Nebenangebot gekennzeichnet sein.

### Ortstermine
Bei komplexen Bauvorhaben werden häufig Ortstermine angeboten. Die Teilnahme ist empfehlenswert, da sie Aufschluss über die tatsächlichen Gegebenheiten gibt.

## Rechte der Bieter

- **Auskunftsrecht:** Nach Zuschlag können Bieter eine Aufklärung über den Verfahrensablauf verlangen
- **Nachprüfungsverfahren:** Bei Vergabeverstößen können Bieter eine Nachprüfung bei der zuständigen Vergabekammer beantragen
- **Wartepflicht:** Der Auftraggeber muss nach Zuschlag 15 Kalendertage warten, bevor der Vertrag geschlossen wird
`,
  },

  "oeffentliche-auftraege-finden": {
    slug: "oeffentliche-auftraege-finden",
    title: "Öffentliche Aufträge finden: 7 Tipps für KMU und Mittelstand",
    description:
      "Wo und wie finden Unternehmen öffentliche Ausschreibungen? 7 praxiserprobte Tipps für KMU, um lukrative Staatsaufträge zu entdecken und erfolgreich zu vergeben.",
    datePublished: "2025-01-15",
    dateModified: "2025-01-15",
    relatedCategories: [
      "Facility Management",
      "Gebaeudereinigung",
      "IT-Dienstleistungen",
      "Lieferung",
    ],
    content: `
## Warum öffentliche Aufträge für KMU interessant sind

Öffentliche Aufträge sind ein stabiler Umsatzkanal: Der deutsche Staat vergibt jährlich Aufträge im Wert von über 500 Milliarden Euro. Besonders für kleine und mittlere Unternehmen (KMU) bieten sie Vorteile:

- **Zahlungssicherheit:** Öffentliche Auftraggeber zahlen zuverlässig
- **Langfristige Verträge:** Rahmenverträge über mehrere Jahre
- **Referenzwirkung:** Staatsaufträge stärken das Unternehmensprofil
- **Faire Wettbewerbsbedingungen:** Vergaberecht schützt vor Bevorzugung

## Tipp 1: Die richtigen Vergabeportale nutzen

In Deutschland gibt es zahlreiche Vergabeplattformen. Die wichtigsten sind:

- **DTVP** (Deutsches Technologievermittlungsportal) – Bund und viele Länder
- **TED** (Tenders Electronic Daily) – EU-weite Ausschreibungen
- **evergabe / evergabe.nrw.de** – Elektronische Vergabe, stark in NRW
- **Bauportal Deutschland** – Spezialisiert auf Bau und Facility Management
- **Vergabe.Niedersachsen** – Landesportal Niedersachsen
- **Bundesimmobilien.de** – Bundesliegenschaften

## Tipp 2: KI-gestützte Suche einsetzen

Manuelle Suche in Vergabeportalen ist zeitaufwendig. Moderne Tools wie Tenderhunter nutzen KI, um:

- Automatisch passende Ausschreibungen zu finden
- Die Relevanz für Ihr Unternehmen zu bewerten (Fit-Score)
- Entscheidende Anforderungen aus Vergabeunterlagen zu extrahieren

## Tipp 3: Eignungsnachweise vorbereiten

Halten Sie folgende Unterlagen immer aktuell:

- Handelsregisterauszug
- Gewerbeanmeldung
- Unbedenklichkeitsbescheinigungen (Finanzamt, Krankenkasse, Berufsgenossenschaft)
- Jahresabschlüsse (letzte 2-3 Jahre)
- Referenzliste mit vergleichbaren Leistungen
- Versicherungsnachweise (Berufshaftpflicht, Betriebshaftpflicht)
- Zertifikate (ISO 9001, ISO 14001 etc.)

## Tipp 4: Auf Fristen achten

Die häufigste Ursache für den Ausschluss: verspätete Angebote. Beachten Sie:

- **EU-Schwellenwert:** Mindestens 35 Kalendertage Angebotsfrist
- **Unterhalb Schwelle:** Meist 10-20 Kalendertage
- **Fristversäumnis = Ausschluss** – Ausnahmen sind extrem selten
- **Elektronische Submission:** Hochladen dauert länger als gedacht – nicht auf die letzte Minute warten

## Tipp 5: Ausschreibungen verstehen, bevor Sie bieten

Lesen Sie die Vergabeunterlagen vollständig:

- Was genau wird gefordert?
- Welche Zuschlagskriterien gelten?
- Welche Formalien müssen erfüllt sein?
- Gibt es Nebenangebote?
- Welche Vertragsbedingungen (VOB/B, BGB) gelten?

## Tipp 6: Netzwerken und Kooperieren

Gerade bei größeren Aufträgen können Bietergemeinschaften (ARGE) oder Nachunternehmer-Strategien sinnvoll sein:

- Kleinere Unternehmen schließen sich zusammen
- Generalunternehmer beziehen spezialisierte Subunternehmer ein
- Erfahrungsaustausch in IHK-Netzwerken und Fachverbänden

## Tipp 7: Aus Absagen lernen

Nicht jedes Angebot führt zum Zuschlag. Nutzen Sie Ablehnungen als Lernchance:

- Fordern Sie eine Aufklärung über den Zuschlagsempfänger an
- Analysieren Sie, woran es lag (Preis, Qualität, Referenzen?)
- Passen Sie Ihre Strategie für zukünftige Ausschreibungen an

## Fazit

Öffentliche Aufträge sind für KMU eine attraktive Umsatzquelle. Mit der richtigen Vorbereitung, den passenden Tools und etwas Gedanzuldigkeit können auch kleine Unternehmen erfolgreich bei Ausschreibungen bestehen.
`,
  },

  "wie-funktioniert-ausschreibung": {
    slug: "wie-funktioniert-ausschreibung",
    title: "Wie funktioniert eine öffentliche Ausschreibung? Schritt für Schritt erklärt",
    description:
      "Öffentliche Ausschreibung einfach erklärt: Von der Bekanntmachung bis zum Zuschlag. Erfahren Sie, wie Vergabeverfahren in Deutschland ablaufen und was Bieter beachten müssen.",
    datePublished: "2025-02-01",
    dateModified: "2025-02-01",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Facility Management"],
    // SEO: HowTo steps extracted from H2 headings — enables HowTo rich snippet in Google SERP
    howToSteps: [
      { name: "Bedarfsfeststellung und Leistungsbeschreibung", text: "Der öffentliche Auftraggeber definiert seinen Bedarf und erstellt eine detaillierte Leistungsbeschreibung mit Umfang, Fristen und Formalien." },
      { name: "Veröffentlichung der Ausschreibung", text: "Die Ausschreibung wird auf DTVP, TED, evergabe oder regionalen Portalen veröffentlicht — inklusive Leistungsbeschreibung, Angebotsfrist und Zuschlagskriterien." },
      { name: "Bieter stellen Fragen", text: "In der Angebotsfrist können Bieter Fragen zur Ausschreibung stellen. Die Vergabestelle beantwortet diese und stellt die Antworten allen Bietern zur Verfügung." },
      { name: "Angebot erstellen und einreichen", text: "Bieter kalkulieren ihren Preis, prüfen Formalien und Eignungsanforderungen und reichen das Angebot elektronisch vor Fristende ein." },
      { name: "Angebotsöffnung und Prüfung", text: "Die Vergabestelle öffnet die Angebote, prüft Formalien und Eignung. Angebote mit formalen Mängeln werden ausgeschlossen." },
      { name: "Zuschlag erteilen", text: "Das wirtschaftlichste Angebot erhält den Zuschlag — entweder nach niedrigstem Preis oder nach dem wirtschaftlichsten Angebot (Preis + Qualität)." },
      { name: "Vertrag schließen und Leistung erbringen", text: "Nach der Wartepflicht (15 Kalendertage bei EU-Vergaben) wird der Vertrag geschlossen und die Leistungserbringung beginnt." },
    ],
    content: `
## Was ist eine öffentliche Ausschreibung?

Eine öffentliche Ausschreibung ist ein geregeltes Verfahren, bei dem öffentliche Auftraggeber (Bund, Länder, Kommunen, öffentliche Unternehmen) Aufträge an private Unternehmen vergeben. Ziel ist es, den Wettbewerb zu sichern und das wirtschaftlichste Angebot zu finden.

## Schritt 1: Bedarfsfeststellung und Leistungsbeschreibung

Alles beginnt mit einem Bedarf: Eine Behörde benötigt eine Leistung — etwa die Sanierung eines Schulgebäudes, die Lieferung von IT-Ausrüstung oder die Reinigung eines Verwaltungsgebäudes.

Die Vergabestelle erstellt eine detaillierte **Leistungsbeschreibung**, die genau festlegt:
- Was genau gefordert wird (Umfang, Qualität, Menge)
- Welche Fristen gelten (Ausführungsfrist, Liefertermin)
- Welche Formalien einzuhalten sind (Angebotsformat, Unterschrift, Nachweise)

**Tipp für Bieter:** Lesen Sie die Leistungsbeschreibung sehr sorgfältig. Fehler oder fehlende Unterlagen führen häufig zum Ausschluss — auch wenn das Angebot inhaltlich gut ist.

## Schritt 2: Veröffentlichung der Ausschreibung

Die Ausschreibung wird auf den relevanten Plattformen veröffentlicht:

- **Unterhalb der EU-Schwellenwerte:** DTVP, evergabe, Bauportal Deutschland oder regionale Portale
- **Oberhalb der EU-Schwellenwerte:** TED (Tenders Electronic Daily) zusätzlich zu den nationalen Portalen

Die Veröffentlichung enthält:
- Die Leistungsbeschreibung und alle Vergabeunterlagen
- Die Angebotsfrist (mindestens 10–20 Kalendertage unterhalb Schwelle, 35 Tage bei EU-Vergaben)
- Die Zuschlagskriterien
- Kontaktdaten der Vergabestelle

## Schritt 3: Bieter stellen Fragen

In der Frist können Bieter Fragen zur Ausschreibung stellen. Die Vergabestelle beantwortet diese — häufig anonymisiert — und stellt die Antworten allen Bietern zur Verfügung.

**Wichtig:** Nutzen Sie diese Möglichkeit! Viele Bieter versäumen es, Fragen zu stellen, und bieten dann ins Blaue hinein.

## Schritt 4: Angebot erstellen und einreichen

Jetzt beginnt die eigentliche Arbeit:

1. **Preis kalkulieren:** Material, Personal, Overhead, Marge — und dabei die öffentlichen Auftraggeber-Erfordernisse (Mindestlohn, Tariftreue) berücksichtigen.
2. **Formalien prüfen:** Welche Nachweise werden gefordert? Berufshaftpflicht, Handelsregister, Referenzen, Bilanzen?
3. **Angebot formatieren:** Viele Vergaben erfolgen elektronisch über evergabe oder DTVP. Achten Sie auf das richtige Format und die korrekte Signatur.
4. **Frist einhalten:** Verspätete Angebote werden ausgeschlossen — Ausnahmen gibt es praktisch nicht.

## Schritt 5: Angebotsöffnung und Prüfung

Nach Ablauf der Frist öffnet die Vergabestelle die Angebote:

- **Öffentliche Angebotsöffnung** (bei offenen Verfahren): Jeder Bieter darf dabei sein
- **Prüfung der Formalien:** Sind alle Nachweise vorhanden? Ist das Angebot vollständig?
- **Prüfung der Eignung:** Erfüllt der Bieter die Eignungsanforderungen (Referenzen, Finanzkraft, Personal)?

Angebote, die formale Mängel haben oder die Eignungsanforderungen nicht erfüllen, werden ausgeschlossen.

## Schritt 6: Zuschlag

Die Vergabestelle wertet die zulässigen Angebote nach den veröffentlichten Zuschlagskriterien aus:

- **Niedrigstes Angebot:** Preis allein entscheidet
- **Wirtschaftlichstes Angebot:** Preis und Qualität (z.B. 70% Preis, 30% Qualität)

Das Angebot mit der besten Bewertung erhält den Zuschlag. Nach der Vergabe informiert die Vergabestelle alle Bieter über das Ergebnis.

## Schritt 7: Vertrag und Ausführung

Nach dem Zuschlag wird der Vertrag geschlossen — frühestens jedoch nach Ablauf der **Wartepflicht** (15 Kalendertage bei EU-Vergaben). Dann beginnt die eigentliche Leistungserbringung.

## Was unterscheidet die verschiedenen Verfahrenstypen?

| Verfahren | Beschreibung | Wann eingesetzt? |
|-----------|-------------|-----------------|
| Offenes Verfahren | Jeder darf bieten | Standard bei klaren Leistungen |
| Nichtoffenes Verfahren | Nur Eingeladene dürfen bieten | Bei komplexen Leistungen |
| Verhandlungsverfahren | Verhandlungen mit Bietern möglich | Bei innovativen Leistungen |
| Wettbewerblicher Dialog | Technische Lösung wird gemeinsam erarbeitet | Bei besonders komplexen Projekten |

## Fazit

Eine öffentliche Ausschreibung folgt klaren Regeln und Schritten. Wer die einzelnen Phasen versteht und die Formalien einhält, hat gute Chancen auf den Zuschlag. Die wichtigsten Erfolgsfaktoren sind: sorgfältige Leistungsbeschreibung, vollständige Unterlagen und pünktliche Einreichung.
`,
  },

  "bietergemeinschaft-gruenden": {
    slug: "bietergemeinschaft-gruenden",
    title: "Bietergemeinschaft gründen: Vorteile, Vorgehen und Tipps für ARGE",
    description:
      "Bietergemeinschaft (ARGE) gründen bei öffentlichen Ausschreibungen: Vorteile, rechtliche Anforderungen, Vertragsgestaltung und Tipps für erfolgreiche Gemeinschaftsangebote.",
    datePublished: "2025-02-01",
    dateModified: "2025-02-01",
    relatedCategories: ["Bauarbeiten", "Tiefbau", "Planungsleistungen"],
    // SEO: HowTo steps for ARGE founding — enables HowTo rich snippet in Google SERP
    howToSteps: [
      { name: "Passende Partner finden", text: "Suchen Sie Unternehmen mit komplementären Leistungen, vergleichbaren Qualitätsstandards und stabiler Finanzkraft. Nutzen Sie IHK-Netzwerke und Fachverbände." },
      { name: "ARGE-Vertrag aufsetzen", text: "Regeln Sie Aufgabenverteilung, Haftung, Gewinnverteilung, Projektleitung und Streitbeilegung schriftlich. Lassen Sie den Vertrag von einem spezialisierten Anwalt prüfen." },
      { name: "Gemeinschaftsangebot erstellen", text: "Benennen Sie alle ARGE-Mitglieder, weisen Sie Leistungsanteile aus und fügen Sie die Eignungsnachweise jedes Mitglieds bei." },
      { name: "Ausführung nach Zuschlag", text: "Die ARGE tritt als Vertragspartner auf. Die Projektleitung koordiniert die Arbeit und die Abrechnung erfolgt über ein gemeinsames Konto." },
    ],
    content: `
## Was ist eine Bietergemeinschaft?

Eine Bietergemeinschaft (auch ARGE — Arbeitsgemeinschaft — genannt) ist ein Zusammenschluss mehrerer Unternehmen, die gemeinsam ein Angebot bei einer öffentliche Ausschreibung abgeben. Das ist besonders bei großen oder komplexen Aufträgen sinnvoll, die ein einzelnes Unternehmen allein nicht bewältigen könnte.

## Wann lohnt sich eine Bietergemeinschaft?

Eine Bietergemeinschaft ist sinnvoll, wenn:

- **Der Auftrag zu groß ist:** Kein einzelnes Unternehmen hat die Kapazität oder die finanzielle Leistungsfähigkeit, den Auftrag allein auszuführen.
- **Spezialwissen benötigt wird:** Ein Bauauftrag erfordert sowohl Tiefbau- als auch TGA-Kompetenz — zwei Unternehmen ergänzen sich ideal.
- **Eignungsanforderungen sonst nicht erfüllt werden:** Referenzen, Bilanzen oder Personalnachweise können nur gemeinsam erbracht werden.
- **Das Risiko geteilt werden soll:** Bei unsicheren Projekten (z.B. Baugrundrisiko) ist die Risikoteilung vorteilhaft.

## Rechtliche Grundlagen

### Zulässigkeit

Bietergemeinschaften sind grundsätzlich zulässig und dürfen nicht von der Teilnahme ausgeschlossen werden. Die Vergabestelle darf allerdings festlegen, ob eine ARGE oder eine Gesellschaft bürgerlichen Rechts (GbR) gewünscht wird.

### Haftung

In der Regel haften die Mitglieder einer Bietergemeinschaft **gesamtschuldnerisch**. Das bedeutet: Jedes Unternehmen haftet für die gesamte Leistung, nicht nur für seinen Anteil. Das ist ein wichtiger Unterschied zu Subunternehmer-Verhältnissen.

### Vergaberechtliche Anforderungen

- Die ARGE muss als solche im Angebot erkennbar sein (Benennung aller Mitglieder)
- Alle Mitglieder müssen die Eignungsanforderungen erfüllen — oder die ARGE erfüllt sie gemeinsam
- Die Leistung muss klar zwischen den Mitgliedern aufgeteilt werden (Arbeitsteilung)

## Schritt-für-Schritt: Bietergemeinschaft gründen

### 1. Partner finden

Suchen Sie Unternehmen, die:
- Komplementäre Leistungen anbieten (z.B. Rohbau + TGA + Fassade)
- Vergleichbare Qualitätsstandards haben
- Finanziell stabil sind (prüfen Sie Bilanzen!)
- Erfahrung mit öffentlichen Aufträgen haben

**Tipp:** Nutzen Sie Netzwerke wie IHK, Fachverbände oder bestehende Subunternehmer-Beziehungen.

### 2. ARGE-Vertrag aufsetzen

Der ARGE-Vertrag regelt die Zusammenarbeit. Wichtige Punkte:

- **Aufgabenverteilung:** Wer macht was? Anteile in Prozent festlegen.
- **Haftung:** Gesamtschuldnerische Haftung oder beschränkte Haftung nach innen?
- **Gewinnverteilung:** Nach Leistungsanteil oder nach Aufwand?
- **Projektleitung:** Wer führt die ARGE nach außen?
- **Streitbeilegung:** Schiedsklausel oder ordentliche Gerichte?
- **Austrittsregelung:** Was passiert, wenn ein Mitglied ausscheiden will?

**Tipp:** Lassen Sie den Vertrag von einem spezialisierten Anwalt prüfen — die Investition lohnt sich.

### 3. Angebot erstellen

Das Gemeinschaftsangebot muss:
- Alle ARGE-Mitglieder benennen
- Die Leistungsanteile klar ausweisen
- Die Eignungsnachweise jedes Mitglieds enthalten
- Von einem bevollmächtigten Vertreter der ARGE unterschrieben sein

### 4. Ausführung nach Zuschlag

Nach dem Zuschlag:
- Die ARGE tritt als Vertragspartner auf (nicht die einzelnen Mitglieder)
- Die Projektleitung koordiniert die Arbeit
- Abrechnung erfolgt über die ARGE (gemeinsames Konto)

## Typische Fehler vermeiden

1. **Unklare Aufgabenverteilung:** Führt zu Streit bei der Ausführung — legen Sie alles vorher schriftlich fest.
2. **Ungleiche Qualitätsstandards:** Wenn ein Mitglied schlecht arbeitet, haften alle — wählen Sie Ihre Partner sorgfältig.
3. **Fehlende Vollmachten:** Der ARGE-Vertreter braucht eine Vollmacht aller Mitglieder — ohne sie ist das Angebot ungültig.
4. **Zu spät gründen:** Beginnen Sie die ARGE-Bildung frühzeitig — die Vertragsverhandlungen dauern oft länger als gedacht.
5. **Vergaberechtliche Fallstricke:** Prüfen Sie, ob die Ausschreibung ARGE-Teilnahme explizit erlaubt — manche Auftraggeber bevorzugen Einzelbieter.

## ARGE vs. Subunternehmer: Was ist besser?

| Kriterium | ARGE | Subunternehmer |
|-----------|------|----------------|
| Haftung | Gesamtschuldnerisch | Nur der Hauptunternehmer haftet |
| Eignung | Gemeinsame Eignungsprüfung | Nur Hauptunternehmer wird geprüft |
| Steuerung | Gemeinsame Projektleitung | Hauptunternehmer steuert |
| Risiko | Geteilt | Beim Hauptunternehmer |
| Vertrag | ARGE-Vertrag + Vergabevertrag | Subunternehmervertrag + Vergabevertrag |

## Fazit

Eine Bietergemeinschaft ist ein mächtiges Instrument, um bei großen öffentlichen Ausschreibungen wettbewerbsfähig zu sein. Die rechtlichen und organisatorischen Anforderungen sind hoch — aber mit sorgfältiger Planung und einem soliden ARGE-Vertrag ist die Zusammenarbeit erfolgreich.
`,
  },
};

export const ALL_ARTICLE_SLUGS = Object.keys(ARTICLES);
