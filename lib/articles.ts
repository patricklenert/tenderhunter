// SEO: Static article data for /wissen hub — targets informational keywords like "vergabeverfahren übersicht"

export interface Article {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  content: string;
  relatedCategories: string[];
  // SEO: Cross-links to related articles for improved crawl depth and PageRank flow
  relatedArticles?: string[];
  relatedGlossaryTerms?: string[];
  sources?: Array<{ title: string; url: string }>;
  lastReviewed?: string;
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
    dateModified: "2026-09-29",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Planungsleistungen"],
    relatedArticles: ["vob-vergabe", "schwellenwerte-vergabe", "wie-funktioniert-ausschreibung", "oeffentliche-auftraege-finden"],
    relatedGlossaryTerms: ["offenes-verfahren", "beschraenktes-verfahren", "verhandlungsverfahren", "teilnahmewettbewerb", "vergabeunterlagen", "e-vergabe", "vgv-vergabeverordnung", "uvgo", "vob-a", "vob-a-eu", "schwellenwerte", "auftragswert", "nachforderung-unterlagen"],
    sources: [
      { title: "§ 119 GWB – Verfahrensarten", url: "https://www.gesetze-im-internet.de/gwb/__119.html" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
      { title: "Bundesanzeiger: EU-Schwellenwerte ab 1. Januar 2026", url: "https://www.bundesanzeiger.de/pub/publication/zDKvMODHbpcIPpDPapc/content/zDKvMODHbpcIPpDPapc/BAnz%20AT%2018.12.2025%20B4.pdf?inline" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "Delegierte Verordnung (EU) 2025/2152", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2152" },
      { title: "Delegierte Verordnung (EU) 2025/2151 für Konzessionen", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2151" },
      { title: "Delegierte Verordnung (EU) 2025/2150 für Sektorenauftraggeber", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2150" },
    ],
    lastReviewed: "2026-09-29",
    content: `
## Was sind Vergabeverfahren?

Vergabeverfahren sind die geregelten Prozesse, über die öffentliche Auftraggeber Aufträge an private Unternehmen vergeben. In Deutschland unterliegen sie dem Vergaberecht, das auf EU-Richtlinien basiert und im Gesetz gegen Wettbewerbsbeschränkungen (GWB) sowie in den einschlägigen Vergabeverordnungen (unter anderem VgV, SektVO, UVgO und VOB/A) geregelt ist.

## Die wichtigsten Verfahrenstypen

### Offenes Verfahren

Das offene Verfahren ermöglicht jedem interessierten Unternehmen, ein Angebot abzugeben. Die Bekanntmachung erfolgt je nach Anwendungsbereich im einschlägigen nationalen Bekanntmachungsmedium oder auf TED (Tenders Electronic Daily).

**Merkmale:**
- Keine Teilnahmebeschränkung
- Die Angebotsfrist richtet sich nach dem anwendbaren Regelwerk; im EU-offenen Verfahren gelten gesetzliche Mindestfristen mit möglichen Ausnahmen
- Zwingend objektive Zuschlagskriterien

### Nichtoffenes Verfahren

Beim nichtoffenen Verfahren können nur ausgewählte Bewerber ein Angebot abgeben. Vorher findet eine Auswahlphase statt, in der der Auftraggeber geeignete Unternehmen identifiziert.

**Merkmale:**
- Zwei-stufig: Auswahl + Angebotsphase
- Die Zahl der einzuladenden Bewerber richtet sich nach dem anwendbaren Regelwerk und der Bekanntmachung
- Geeignet bei komplexen Leistungen

### Verhandlungsverfahren

Beim Verhandlungsverfahren werden die Vertragsbedingungen mit den Bietern verhandelt. Es gibt Varianten mit und ohne vorherige Bekanntmachung.

**Merkmale:**
- Verhandlungen über Preis und Leistung möglich
- Besonders bei innovativen Leistungen oder unvollständigen Unterlagen
- Mit vorheriger Bekanntmachung gelten die Voraussetzungen und Mindestzahlen des jeweils anwendbaren Regelwerks

### Wettbewerblicher Dialog

Der wettbewerbliche Dialog wird bei besonders komplexen Projekten eingesetzt, bei denen der Auftraggeber die technischen, rechtlichen oder finanziellen Lösungen nicht im Voraus definieren kann.

### Innovationspartnerschaft

Die Innovationspartnerschaft wurde 2016 eingeführt und ermöglicht die Entwicklung und anschließende Beschaffung innovativer Produkte oder Dienstleistungen.

## Ausgewählte EU-Schwellenwerte 2026/2027

| Bereich | EU-Schwellenwert |
|---------|-----------------|
| Bauaufträge klassischer öffentlicher Auftraggeber | 5.404.000 € |
| Liefer- und Dienstleistungen zentraler Regierungsbehörden im Sinne von § 106 Absatz 2 Nummer 1 GWB | 140.000 € |
| Liefer- und Dienstleistungen anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU | 216.000 € |
| Sektorenaufträge (Liefer- und Dienstleistungen) | 432.000 € |
| Soziale und andere besondere Dienstleistungen (klassische Auftraggeber) | 750.000 € |
| Konzessionen | 5.404.000 € |

Unterhalb des jeweils einschlägigen Werts gelten die nationalen Regeln des Auftraggebers und Leistungsbereichs. Die Beträge sind keine pauschalen Wertgrenzen für jede Beschaffung: Maßgeblich sind Auftraggeber, Leistungsart und das einschlägige Regelwerk. Für Bauaufträge gilt oberhalb des Schwellenwerts neben VOB/A Abschnitt 2 auch § 2 VgV.

## Tipps für Bieter

1. **Vergabeportale regelmäßig prüfen:** Nutzen Sie Plattformen wie DTVP, TED und evergabe, um neue Ausschreibungen frühzeitig zu erkennen.
2. **Eignungsnachweise vorbereiten:** Halten Sie Referenzen, Bilanzen und Bescheinigungen aktuell.
3. **Fristen im Blick behalten:** Versäumte Fristen sind der häufigste Grund für den Ausschluss.
4. **Nachweise sorgfältig prüfen:** Fehlende oder fehlerhafte Unterlagen führen zur Ablehnung.
5. **Vergabeunterlagen und Vergabekriterien genau lesen:** Die Angebots- und Vergabeunterlagen definieren die Anforderungen.
`,
  },

  "vob-vergabe": {
    slug: "vob-vergabe",
    title: "VOB/A Vergabe: Was Bieter über die Vergabe- und Vertragsordnung wissen müssen",
    description:
      "VOB/A, VOB/B und VOB/C verständlich erklärt: Vergabeverfahren, Bauvertragsbedingungen, technische ATV, Schwellenwerte und wichtige Hinweise für Bieter.",
    datePublished: "2025-01-15",
    dateModified: "2026-10-08",
    lastReviewed: "2026-10-08",
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Planungsleistungen"],
    relatedArticles: ["vergabeverfahren-uebersicht", "schwellenwerte-vergabe", "ausschreibung-muster", "bietergemeinschaft-gruenden"],
    relatedGlossaryTerms: ["vob-a", "vob-b", "vob-c", "vob-a-eu", "schwellenwerte", "auftragswert", "losvergabe", "leistungsbeschreibung", "leistungsverzeichnis", "vgv-vergabeverordnung", "gwb-vergaberecht", "eignungsleihe", "nachforderung-unterlagen"],
    sources: [
      { title: "Bundesanzeiger: VOB/A-Änderung vom 22. Juli 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
      { title: "VOB/A, Bekanntmachung vom 31. Januar 2019 (BAnz AT 19.02.2019 B2)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "§ 97a GWB – Losgrundsatz", url: "https://www.gesetze-im-internet.de/gwb/__97a.html" },
      { title: "§ 134 GWB – Informations- und Wartepflicht", url: "https://www.gesetze-im-internet.de/gwb/__134.html" },
    ],
    content: `
## Was ist die VOB/A?

Die Vergabe- und Vertragsordnung für Bauleistungen (VOB) besteht aus drei Teilen:

- **VOB/A** – Allgemeine Bestimmungen für die Vergabe von Bauleistungen
- **VOB/B** – Allgemeine Vertragsbedingungen für die Ausführung von Bauleistungen
- **VOB/C** – Allgemeine Technische Vertragsbedingungen für Bauleistungen

VOB/A betrifft das Vergabeverfahren. VOB/B und VOB/C können für die spätere Vertragsausführung als Vertragsbestandteile einbezogen werden. Die Teile haben daher unterschiedliche Funktionen und dürfen nicht gleichgesetzt werden.

### VOB/B: Vertragsbedingungen nach dem Zuschlag

Die VOB/B regelt die rechtlichen Bedingungen der Bauausführung, wenn sie wirksam in den Bauvertrag einbezogen wurde. Dazu gehören unter anderem Anordnungen und Änderungen der Leistung, Abnahme, Vergütung und Nachträge, Mängel, Kündigung sowie Ausführungs- und Zahlungsfristen. Sie ist keine Verfahrensart und ersetzt nicht die VOB/A.

### VOB/C: Technische Vertragsbedingungen

Die VOB/C enthält gewerkespezifische Allgemeine Technische Vertragsbedingungen (ATV). Sie unterstützt eine eindeutige Leistungsbeschreibung und beschreibt Anforderungen an Ausführung, Neben- und besondere Leistungen sowie Abrechnung. Das Leistungsverzeichnis konkretisiert dabei die ausgeschriebene Leistung; VOB/C und Leistungsverzeichnis sind deshalb gemeinsam zu lesen.

## Geltungsbereich der VOB/A

Für Bauaufträge unterscheidet die VOB/A drei Abschnitte: Abschnitt 1 für den nationalen Bereich, Abschnitt 2 für den EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Vergaben. Nach § 2 VgV sind bei Bauaufträgen Abschnitt 1 und Abschnitt 2 Unterabschnitt 2 der VgV anzuwenden; im Übrigen gilt VOB/A Teil A Abschnitt 2. Planungsleistungen, die als Los eines Bauauftrags vergeben werden, unterliegen der VgV. Baukonzessionen sind gesondert zu prüfen.

**Unterscheidung:**
- **Unterhalb der EU-Schwellenwerte:** VOB/A Abschnitt 1, ergänzt durch anwendbares Landes- und Haushaltsrecht
- **Oberhalb der EU-Schwellenwerte:** VOB/A Abschnitt 2 zusammen mit GWB und den nach § 2 VgV anwendbaren Vorschriften

## Zuschlagskriterien nach VOB/A

Der Zuschlag wird auf das wirtschaftlichste Angebot erteilt. Das bestimmt sich nach dem besten Preis-Leistungs-Verhältnis; bei geeigneten Bauleistungen kann der Preis dabei das alleinige Zuschlagskriterium sein. Maßgeblich sind die vorab bekannt gemachten Zuschlagskriterien.

## Typische Eignungsanforderungen

Öffentliche Auftraggeber prüfen die Eignung der Bieter anhand der bekannt gemachten Kriterien und Nachweise. Typische Beispiele sind:

- **Berufliche Zulassung:** Eintragung in die Handwerksrolle oder vergleichbar, soweit gefordert
- **Leistungsreferenzen:** Nachweis vergleichbarer Bauleistungen nach den bekannt gemachten Anforderungen
- **Finanzielle Leistungsfähigkeit:** etwa Umsatzangaben, Jahresabschlüsse oder andere zulässige Nachweise
- **Technische Ausstattung:** Maschinen, Anlagen, Personal
- **Qualitätssicherung:** etwa Zertifikate oder Beschreibungen, soweit auftragsbezogen gefordert

### Eignung durch ein anderes Unternehmen (Eignungsleihe)

Kann ein Bieter ein bekannt gemachtes Eignungskriterium nicht allein erfüllen, kann er sich im jeweils anwendbaren Regelwerk unter bestimmten Voraussetzungen auf die Kapazitäten eines anderen Unternehmens stützen. Er muss nachweisen, dass ihm diese Mittel für den konkreten Auftrag tatsächlich zur Verfügung stehen. Bei EU-weiten Bauvergaben regelt § 6d EU VOB/A die Eignungsleihe. § 47 VgV gilt in seinem Anwendungsbereich, etwa für Liefer- und Dienstleistungen sowie Planungsleistungen, die als Los eines Bauauftrags vergeben werden. Für Bauaufträge ordnet § 2 VgV im Übrigen die Anwendung der VOB/A an; § 47 VgV darf daher nicht pauschal zusätzlich auf Bauvergaben übertragen werden.

Werden berufliche Befähigung oder Erfahrung geliehen, muss das andere Unternehmen die Arbeiten ausführen, für die diese Kapazitäten benötigt werden. Eine Eignungsleihe ist weder automatisch eine Bietergemeinschaft noch ein Nachunternehmerverhältnis; dieselbe Firma kann abhängig von der konkreten Rolle aber beides sein. Unterhalb der EU-Schwellenwerte ist das jeweils eingeführte Regelwerk maßgeblich.

## Besonderheiten bei Bauausschreibungen

### Teillosevergabe
Bei Bauvergaben sind die Losregeln des jeweils geltenden Regelwerks maßgeblich. Im Anwendungsbereich des vierten Teils des GWB verlangt § 97a Absatz 1 grundsätzlich die Aufteilung in Teil- und Fachlose; eine Zusammenfassung ist nach Absatz 2 bei erforderlichen wirtschaftlichen oder technischen Gründen möglich. Für nationale Bauvergaben enthält § 5 Absatz 2 VOB/A Abschnitt 1 eine entsprechende Regel, soweit dieser Abschnitt eingeführt ist.

Die aktuelle Fassung des § 97a Absatz 3 GWB erlaubt außerdem aus zeitlichen Gründen eine Zusammenfassung bei bestimmten Infrastrukturvorhaben, wenn der geschätzte Auftragswert mindestens das Doppelte des einschlägigen EU-Schwellenwerts erreicht und die im Gesetz genannten Finanzierungs- oder Infrastrukturvoraussetzungen vorliegen. Das ist keine allgemeine Ausnahme für dringliche Bauprojekte. Für Bieter sind die zulässigen Lose, mögliche Höchstzahlen für Zuschläge und kombinierbare Lose der Bekanntmachung und den Vergabeunterlagen zu entnehmen.

### Nebenangebote
Nebenangebote sind nur zu werten, wenn der Auftraggeber sie zugelassen oder nicht ausgeschlossen hat und die bekannt gemachten Mindestanforderungen eingehalten werden.

### Ortstermine
Bei komplexen Bauvorhaben werden häufig Ortstermine angeboten. Die Teilnahme ist empfehlenswert, da sie Aufschluss über die tatsächlichen Gegebenheiten gibt.

## Rechte der Bieter

- **Information:** Unter den gesetzlichen Voraussetzungen können Bieter Informationen über die Ablehnung und den vorgesehenen Zuschlag verlangen
- **Nachprüfungsverfahren:** Bei Vergabeverstößen können Bieter eine Nachprüfung bei der zuständigen Vergabekammer beantragen
- **Wartepflicht:** Im Anwendungsbereich des § 134 GWB beginnt der Vertrag grundsätzlich erst nach 15 Kalendertagen ab Absendung der Information, bei elektronischer Übermittlung nach 10 Kalendertagen; Ausnahmen und der konkrete Übermittlungsweg sind zu prüfen
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
    relatedArticles: ["wie-funktioniert-ausschreibung", "ausschreibung-gewinnen", "vergabeverfahren-uebersicht"],
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

- **EU-Verfahren:** Die Mindestfrist hängt vom Verfahren ab; im offenen Verfahren nach § 15 VgV beträgt sie regulär 35 Tage, Verkürzungen sind nur unter gesetzlichen Voraussetzungen möglich
- **Unterhalb der Schwellenwerte:** Es gibt keine einheitliche Frist für alle Auftraggeber und Leistungen; maßgeblich sind das einschlägige Regelwerk und die Vergabeunterlagen
- **Fristversäumnis:** Verspätete Angebote werden grundsätzlich nicht gewertet; Ausnahmen richten sich nach den anwendbaren Vorschriften
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
    dateModified: "2026-09-13",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Facility Management"],
     relatedArticles: ["vergabeverfahren-uebersicht", "oeffentliche-auftraege-finden", "ausschreibung-gewinnen"],
    relatedGlossaryTerms: ["vergabeunterlagen", "e-vergabe", "bieterfragen", "leistungsbeschreibung", "angebot", "nachforderung-unterlagen"],
    // SEO: HowTo steps extracted from H2 headings — enables HowTo rich snippet in Google SERP
    howToSteps: [
      { name: "Bedarfsfeststellung und Leistungsbeschreibung", text: "Der öffentliche Auftraggeber definiert seinen Bedarf und erstellt eine detaillierte Leistungsbeschreibung mit Umfang, Fristen und Formalien." },
      { name: "Veröffentlichung der Ausschreibung", text: "Die Ausschreibung wird auf DTVP, TED, evergabe oder regionalen Portalen veröffentlicht — inklusive Leistungsbeschreibung, Angebotsfrist und Zuschlagskriterien." },
      { name: "Bieter stellen Fragen", text: "Bieter können innerhalb der vorgesehenen Frist und über den festgelegten Kommunikationsweg Fragen stellen. Relevante Antworten oder Änderungen werden nach den anwendbaren Vorgaben so bereitgestellt, dass die betroffenen Unternehmen gleich informiert werden." },
      { name: "Angebot erstellen und einreichen", text: "Bieter kalkulieren ihren Preis, prüfen Formalien und Eignungsanforderungen und reichen das Angebot elektronisch vor Fristende ein." },
      { name: "Angebotsöffnung und Prüfung", text: "Die Vergabestelle öffnet die Angebote, prüft Formalien und Eignung. Angebote mit formalen Mängeln werden ausgeschlossen." },
      { name: "Zuschlag erteilen", text: "Das wirtschaftlichste Angebot erhält den Zuschlag — entweder nach niedrigstem Preis oder nach dem wirtschaftlichsten Angebot (Preis + Qualität)." },
      { name: "Vertrag schließen und Leistung erbringen", text: "Soweit § 134 GWB anwendbar ist, wird der Vertrag erst nach Ablauf der dort geregelten Wartefrist geschlossen; anschließend beginnt die Leistungserbringung." },
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
- **Bei unionsrechtlich erforderlichen Bekanntmachungen:** TED (Tenders Electronic Daily) zusätzlich zu den nationalen Portalen

Die Veröffentlichung enthält:
- Die Leistungsbeschreibung und alle Vergabeunterlagen
- Die Angebotsfrist nach den für Auftraggeber, Leistungsart und Verfahren geltenden Vorschriften
- Die Zuschlagskriterien
- Kontaktdaten der Vergabestelle

## Schritt 3: Bieter stellen Fragen

In der Frist können Bieter über den vorgesehenen Kommunikationsweg Fragen zur Ausschreibung stellen. Relevante Antworten oder Änderungen werden nach den anwendbaren Vorgaben so bereitgestellt, dass die betroffenen Unternehmen gleich informiert werden; bei erheblichen Änderungen kann eine Fristverlängerung erforderlich sein.

**Wichtig:** Nutzen Sie diese Möglichkeit! Viele Bieter versäumen es, Fragen zu stellen, und bieten dann ins Blaue hinein.

## Schritt 4: Angebot erstellen und einreichen

Jetzt beginnt die eigentliche Arbeit:

1. **Preis kalkulieren:** Material, Personal, Overhead, Marge — und dabei die öffentlichen Auftraggeber-Erfordernisse (Mindestlohn, Tariftreue) berücksichtigen.
2. **Formalien prüfen:** Welche Nachweise werden gefordert? Berufshaftpflicht, Handelsregister, Referenzen, Bilanzen?
3. **Angebot formatieren:** Viele Vergaben erfolgen elektronisch über evergabe oder DTVP. Achten Sie auf das richtige Format und die korrekte Signatur.
4. **Frist einhalten:** Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht berücksichtigt; maßgeblich sind das konkrete Regelwerk und die Vergabeunterlagen.

## Schritt 5: Angebotsöffnung und Prüfung

Nach Ablauf der Frist öffnet die Vergabestelle die Angebote:

- **Öffnung und Dokumentation:** Die Angebote werden nach Fristablauf nach den Regeln des konkreten Verfahrens geöffnet und erfasst; bei elektronischen Vergaben findet regelmäßig keine öffentliche Bieteröffnung statt
- **Prüfung der Formalien:** Sind die geforderten Angaben und Unterlagen vorhanden? Nachforderungen sind nur im Rahmen der anwendbaren Vorschriften zulässig
- **Prüfung der Eignung:** Erfüllt der Bieter die Eignungsanforderungen (Referenzen, Finanzkraft, Personal)?

Angebote, die nach den anwendbaren Vorschriften zwingende Mängel haben oder deren Bieter die Eignungsanforderungen nicht erfüllen, können beziehungsweise müssen ausgeschlossen werden. Ob Unterlagen nachgefordert oder erläutert werden dürfen, richtet sich nach dem konkreten Regelwerk und den Vergabeunterlagen.

## Schritt 6: Zuschlag

Die Vergabestelle wertet die zulässigen Angebote nach den veröffentlichten Zuschlagskriterien aus:

- **Niedrigstes Angebot:** Preis allein entscheidet
- **Wirtschaftlichstes Angebot:** Preis und Qualität (z.B. 70% Preis, 30% Qualität)

Das Angebot mit der besten Bewertung erhält den Zuschlag. Soweit Informationspflichten nach dem anwendbaren Vergaberecht bestehen, informiert die Vergabestelle die betroffenen Bieter über die Entscheidung.

## Schritt 7: Vertrag und Ausführung

Nach dem Zuschlag wird der Vertrag geschlossen — soweit § 134 GWB anwendbar ist, frühestens nach Ablauf der dort geregelten **Wartepflicht**. Dann beginnt die eigentliche Leistungserbringung.

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
    dateModified: "2026-10-06",
    relatedCategories: ["Bauarbeiten", "Tiefbau", "Planungsleistungen"],
    relatedArticles: ["vob-vergabe", "ausschreibung-gewinnen", "vergabeverfahren-uebersicht"],
    relatedGlossaryTerms: ["bietergemeinschaft", "eignungsleihe", "nachunternehmer"],
    sources: [
      { title: "§ 47 VgV – Eignungsleihe", url: "https://www.gesetze-im-internet.de/vgv_2016/__47.html" },
      { title: "§ 2 VgV – Vergabe von Bauaufträgen", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "VOB/A, Abschnitte 2 und 3, Ausgabe 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
    ],
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

## Bietergemeinschaft oder Eignungsleihe?

Bei einer Bietergemeinschaft geben mehrere Unternehmen gemeinsam ein Angebot ab. Bei der Eignungsleihe bleibt dagegen ein Unternehmen allein Bewerber oder Bieter und weist ein oder mehrere Eignungskriterien mit den Kapazitäten eines anderen Unternehmens nach. Im Anwendungsbereich der VgV gilt § 47 auch für Bietergemeinschaften; bei EU-weiten Bauvergaben ist § 6d EU VOB/A maßgeblich. Für Bauaufträge ist außerdem die Zuordnung in § 2 VgV zu beachten.

Der Kapazitätsgeber muss seine Mittel tatsächlich für den Auftrag bereitstellen. Wird berufliche Befähigung oder Erfahrung geliehen, muss er die entsprechenden Arbeiten ausführen. Er kann zugleich Nachunternehmer sein; die Eignungsleihe allein macht ihn aber nicht automatisch zum Nachunternehmer. Unterhalb der EU-Schwellenwerte kommt es auf das für den Auftraggeber geltende Regelwerk an.

## Fazit

Eine Bietergemeinschaft ist ein mächtiges Instrument, um bei großen öffentlichen Ausschreibungen wettbewerbsfähig zu sein. Die rechtlichen und organisatorischen Anforderungen sind hoch — aber mit sorgfältiger Planung und einem soliden ARGE-Vertrag ist die Zusammenarbeit erfolgreich.
`,
  },

  // SEO: Neue Artikel für Cycle 4 — gezielte Long-Tail-Keywords abdecken
  "schwellenwerte-vergabe": {
    slug: "schwellenwerte-vergabe",
    title: "EU-Schwellenwerte im Vergaberecht 2026 und 2027",
    description:
      "EU-Schwellenwerte für öffentliche Aufträge 2026 und 2027: Bauaufträge, Lieferungen, Dienstleistungen und Konzessionen nach Auftraggeber und Leistungsart eingeordnet.",
    datePublished: "2025-06-01",
    dateModified: "2026-10-11",
    lastReviewed: "2026-10-11",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Lieferung"],
    relatedArticles: ["vergabeverfahren-uebersicht", "vob-vergabe", "eu-vergabe", "ausschreibung-muster"],
    relatedGlossaryTerms: ["schwellenwerte", "auftragswert", "vob-a", "vob-a-eu", "vgv-vergabeverordnung", "gwb-vergaberecht"],
    sources: [
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
      { title: "Bundesanzeiger: EU-Schwellenwerte ab 1. Januar 2026", url: "https://www.bundesanzeiger.de/pub/publication/zDKvMODHbpcIPpDPapc/content/zDKvMODHbpcIPpDPapc/BAnz%20AT%2018.12.2025%20B4.pdf?inline" },
      { title: "Delegierte Verordnung (EU) 2025/2152", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2152" },
      { title: "Delegierte Verordnung (EU) 2025/2151 für Konzessionen", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2151" },
      { title: "Delegierte Verordnung (EU) 2025/2150 für Sektorenauftraggeber", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2150" },
      { title: "Delegierte Verordnung (EU) 2025/2487 für Verteidigung und Sicherheit", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2487" },
    ],
    content: `
## Was sind Schwellenwerte in der Vergabe?

Schwellenwerte legen fest, ab welchem Auftragswert öffentliche Auftraggeber das EU-Vergaberecht anwenden müssen. Oberhalb dieser Werte gelten die Regeln des EU-Oberschwellenbereichs, einschließlich der einschlägigen Bekanntmachungs- und Verfahrensvorgaben. Unterhalb gelten nationale Vergaberegeln. Welche Vorschriften greifen, hängt immer von Auftraggeber, Leistungsart und Anwendungsbereich ab.

Die Schwellenwerte werden regelmäßig angepasst. Die folgenden EU-Werte gelten ab dem 1. Januar 2026 für 2026 und 2027. Sie beziehen sich auf den geschätzten Auftragswert ohne Umsatzsteuer und nur auf den jeweils passenden Auftraggeber- und Leistungsbereich.

## EU-Schwellenwerte 2026/2027

| Auftragsart | EU-Schwellenwert (netto) |
|-------------|--------------------------|
| Bauaufträge klassischer öffentlicher Auftraggeber | 5.404.000 € |
| Liefer- und Dienstleistungen zentraler Regierungsbehörden im Sinne von § 106 Absatz 2 Nummer 1 GWB | 140.000 € |
| Liefer- und Dienstleistungen anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU | 216.000 € |
| Liefer- und Dienstleistungen von Sektorenauftraggebern | 432.000 € |
| Konzessionen | 5.404.000 € |
| Soziale und andere besondere Dienstleistungen (klassische Auftraggeber) | 750.000 € |
| Liefer- und Dienstleistungen im Verteidigungs- und Sicherheitsbereich | 432.000 € |
| Bauaufträge im Verteidigungs- und Sicherheitsbereich | 5.404.000 € |
| Soziale und andere besondere Dienstleistungen von Sektorenauftraggebern | 1.000.000 € |

**Wichtig:** Die Werte gelten netto (ohne Umsatzsteuer) und sind keine allgemeine Wertgrenze für jede Ausschreibung. Bei der Schwellenwertberechnung sind die jeweils einschlägigen Vorschriften zu Optionen, Verlängerungen, Losen und möglichen Aufteilungen zu beachten. Eine künstliche Aufteilung zur Umgehung des EU-Vergaberechts ist unzulässig.

## Was gilt unterhalb der EU-Schwellenwerte?

Unterhalb der EU-Schwellenwerte gelten die nationalen Regeln des jeweils zuständigen Auftraggebers. Bei Liefer- und Dienstleistungen kann auf Bundesebene die UVgO maßgeblich sein; bei Bauleistungen ist grundsätzlich VOB/A Abschnitt 1 relevant. Landesrecht, Haushaltsrecht und interne Wertgrenzen können zusätzliche Vorgaben machen. Es gibt daher keine einheitlichen deutschen Wertgrenzen für jede Unterschwellenvergabe.

## Praxis-Tipps für Bieter

1. **Schwellenwert im Auge behalten:** Prüfen Sie bei jeder Ausschreibung, ob der Auftragswert über oder unter dem EU-Schwellenwert liegt. Daran entscheiden sich Fristen und Formalien.
2. **Unionsweite Bekanntmachung:** Oberhalb des einschlägigen Schwellenwerts ist im passenden Anwendungsbereich regelmäßig eine Bekanntmachung über TED erforderlich. Ausnahmen und besondere Regelwerke müssen anhand der konkreten Ausschreibung geprüft werden. Nutzen Sie Tenderhunter, um auch diese Aufträge zu finden.
3. **Fristen beachten:** Die Mindestfrist hängt vom Verfahren und den anwendbaren Vorschriften ab. Maßgeblich sind Bekanntmachung und Vergabeunterlagen.
4. **Eignungsanforderungen prüfen:** Anforderungen an Referenzen, Bilanzen und Zertifikate müssen aus den konkreten Vergabeunterlagen hervorgehen.
5. **Teillosevergabe:** Die Losbildung ist nach den jeweils anwendbaren Regeln zu prüfen; eine Gesamtvergabe muss sachlich begründet werden, wenn eine Losaufteilung geboten ist.

## Sonderfälle und Ausnahmen

### Kalkulation des Auftragswerts
- Schätzung auf Basis des Gesamtwerts ohne Umsatzsteuer
- Optionen, Verlängerungen, Rahmenvereinbarungen und Lose nach der jeweils einschlägigen Berechnungsvorschrift prüfen
- Die Wertschätzung vor Einleitung des Vergabeverfahrens nachvollziehbar dokumentieren

## Häufige Fragen

**Gilt der Schwellenwert pro Jahr oder pro Auftrag?**
Maßgeblich ist der geschätzte Gesamtwert des konkreten Beschaffungsvorhabens. Optionen, Verlängerungen, Rahmenverträge und Lose dürfen dabei nicht beliebig ausgeklammert werden; eine künstliche Aufteilung zur Umgehung ist unzulässig.

**Was passiert, wenn der Auftragswert knapp unter dem Schwellenwert liegt?**
Es gelten nationale Vergaberegeln. Die Vergabegrundsätze (Wirtschaftlichkeit, Transparenz, Wettbewerb) bleiben trotzdem zu beachten.

**Wer prüft die Einhaltung der Schwellenwerte?**
Die Vergabestelle muss den Auftragswert nachvollziehbar schätzen und dokumentieren. Oberhalb der EU-Schwellenwerte können Bieter unter den gesetzlichen Voraussetzungen ein Nachprüfungsverfahren bei der zuständigen Vergabekammer einleiten.
`,
  },

  "ausschreibung-schreiben": {
    slug: "ausschreibung-schreiben",
    title: "Ausschreibung schreiben: Anleitung für Auftraggeber und Bieter",
    description:
      "Schritt-für-Schritt-Anleitung zum Schreiben einer öffentlichen Ausschreibung. Leistungsbeschreibung, Zuschlagskriterien, Vergabeunterlagen — was Auftraggeber und Bieter wissen müssen.",
    datePublished: "2025-06-01",
    dateModified: "2025-06-01",
    relatedCategories: ["Planungsleistungen", "Facility Management"],
     relatedArticles: ["vergabeverfahren-uebersicht", "vob-vergabe", "oeffentliche-auftraege-finden"],
     relatedGlossaryTerms: ["vergabeunterlagen", "leistungsbeschreibung", "leistungsverzeichnis", "e-vergabe", "zuschlagskriterien"],
    howToSteps: [
      { name: "Bedarf ermitteln", text: "Definieren Sie den genauen Bedarf: Was wird benötigt, in welchem Umfang, bis wann? Klären Sie technische Anforderungen und Rahmenbedingungen." },
      { name: "Leistungsbeschreibung erstellen", text: "Formulieren Sie eine präzise Leistungsbeschreibung mit Spezifikationen, Mengen, Fristen und Qualitätsanforderungen. Nutzen Sie ATV-DIN-Normen bei Bauleistungen." },
      { name: "Vergabeunterlagen zusammenstellen", text: "Erstellen Sie das vollständige Vergabepaket: Leistungsbeschreibung, Entwurfsvertrag, Eignungsanforderungen, Zuschlagskriterien, Angebotsfrist und Formalien." },
      { name: "Bekanntmachung veröffentlichen", text: "Veröffentlichen Sie die Ausschreibung auf den relevanten Portalen (DTVP, TED, evergabe). Beachten Sie die vorgeschriebenen Bekanntmachungsformulare." },
    ],
    content: `
## Wer schreibt öffentliche Ausschreibungen?

Öffentliche Ausschreibungen werden von öffentlichen Auftraggebern geschrieben: Bund, Länder, Kommunen, öffentliche Unternehmen und Einrichtungen des Gesundheitswesens. Aber auch Bieter profitieren davon zu verstehen, wie eine Ausschreibung entsteht — denn nur wer die Anforderungen kennt, kann ein überzeugendes Angebot schreiben.

## Schritt 1: Bedarfsfeststellung

Alles beginnt mit einem konkreten Bedarf. Die Vergabestelle muss präzise definieren:

- **Was** wird benötigt? (Leistungsart, Umfang, Qualität)
- **Wann** wird es benötigt? (Ausführungsfrist, Liefertermin)
- **Wo** wird es benötigt? (Ausführungsort, Einsatzgebiet)
- **Budget:** Welcher geschätzte Auftragswert liegt vor?

**Tipp:** Eine ungenaue Bedarfsdefinition führt zu Nachfragen, Angeboten an der Realität vorbei und Vergabeverzögerungen.

## Schritt 2: Leistungsbeschreibung erstellen

Die Leistungsbeschreibung ist das Herzstück jeder Ausschreibung. Sie muss so formuliert sein, dass alle Bieter die gleiche Leistung anbieten können.

### Grundsätze guter Leistungsbeschreibungen

- **Eindeutig:** Keine Mehrdeutigkeiten, klare Spezifikationen
- **Neutral:** Keine Herstellerangaben oder diskriminierende Anforderungen
- **Vollständig:** Alle geforderten Leistungen sind beschrieben
- **Prüfbar:** Anforderungen sind messbar und nachvollziehbar

### Bauleistungen nach VOB/C

Bei Bauaufträgen verwenden Sie die ATV-DIN-Normen (Allgemeine Technische Vertragsbedingungen) aus dem VOB/C-Teil. Die Leistungsbeschreibung gliedert sich in:

1. **Beschreibung der Baumaßnahme** (Projektbeschreibung)
2. **Technische Anforderungen** (Zeichnungen, Pläne, statische Berechnungen)
3. **Ausführungsfristen und Termine**
4. **Formalien** (Angebotsformat, Nachweise, Unterschrift)

### Liefer- und Dienstleistungen

Bei Liefer- und Dienstleistungen beschreiben Sie:

- **Spezifikationen** (technische Daten, Normen, Qualitätsstandards)
- **Mengen und Einheiten**
- **Liefer- oder Leistungszeitraum**
- **Besondere Anforderungen** (Verpackung, Anlieferung, Abnahme)

## Schritt 3: Zuschlagskriterien festlegen

Die Zuschlagskriterien bestimmen, wie das wirtschaftlichste Angebot ermittelt wird. Zwei Modelle:

### Preis allein (niedrigstes Angebot)
- Standard bei einfachen, gut definierten Leistungen
- Transparent und einfach zu bewerten
- Geeignet bei homogenen Leistungen (Beton, Asphalt, Standard-IT)

### Wirtschaftlichstes Angebot (Preis + Qualität)
- Qualitative Kriterien werden berücksichtigt
- Beispiel: Preis 70 %, Qualität 20 %, Nachhaltigkeit 10 %
- Geeignet bei komplexen Leistungen mit Qualitätsunterschieden

**Wichtig:** Die Zuschlagskriterien und ihre Gewichtung müssen in der Bekanntmachung veröffentlicht werden. Nachträgliche Änderungen sind nicht zulässig.

## Schritt 4: Eignungsanforderungen definieren

Eignungsanforderungen prüfen, ob ein Bieter die Leistung erbringen kann:

| Anforderung | Typisch für |
|-------------|------------|
| Berufliche Zulassung | Bau, Handwerk |
| Leistungsreferenzen | Alle Bereiche |
| Finanzielle Leistungsfähigkeit | Großaufträge |
| Technische Ausstattung | Bau, IT |
| Qualitätssicherung (ISO 9001) | Alle Bereiche |
| Berufshaftpflicht | Planungsleistungen |

**Tipp:** Formulieren Sie Eignungsanforderungen so, dass KMU sie erfüllen können. Überzogene Anforderungen schränken den Wettbewerb ein.

## Schritt 5: Vergabeunterlagen zusammenstellen

Das vollständige Vergabepaket enthält:

1. **Bekanntmachung** (vorgeschriebenes Formular)
2. **Leistungsbeschreibung** mit Anlagen
3. **Entwurfsvertrag** (VOB/B, BGB oder EVB-IT)
4. **Eignungsanforderungen** (Nachweisliste)
5. **Zuschlagskriterien** (Gewichtung)
6. **Angebotsfrist** und Formalien
7. **Ergänzende Unterlagen** (Pläne, Bodengutachten, etc.)

## Schritt 6: Bekanntmachung und Vergabeprozess

### Bekanntmachungsportale
- **Unterhalb EU-Schwellenwert:** DTVP, evergabe, regionale Portale
- **Bei unionsrechtlich erforderlichen Bekanntmachungen:** TED zusätzlich zu nationalen Portalen

### Ablauf
1. Bekanntmachung veröffentlichen
2. Vergabeunterlagen bereitstellen
3. Relevante Bieterfragen nach den Verfahrensvorgaben beantworten und bereitstellen
4. Angebote öffnen und prüfen
5. Zuschlag erteilen und – soweit § 134 GWB anwendbar ist – die Wartepflicht beachten
6. Vertrag schließen

## Fazit

Eine gute Ausschreibung zeichnet sich durch präzise Leistungsbeschreibung, faire Eignungsanforderungen und transparente Zuschlagskriterien aus. Wer als Bieter die Perspektive des Auftraggebers versteht, kann gezielt auf die Anforderungen eingehen und seine Chancen auf den Zuschlag deutlich erhöhen.
`,
  },

  // SEO: Cycle 5 — "Ausschreibung Muster" targets high-volume informational query with zero prior coverage
  "ausschreibung-muster": {
    slug: "ausschreibung-muster",
    title: "Ausschreibung Muster und Vorlage: Aufbau, Inhalte und Beispiel",
    description:
      "Ausschreibung Muster und Vorlage für öffentliche Aufträge: Aufbau einer Leistungsbeschreibung, Pflichtangaben nach VOB/A, Beispieltexte und Checkliste zum Erstellen.",
    datePublished: "2025-07-04",
    dateModified: "2025-07-04",
    relatedCategories: ["Bauarbeiten", "Planungsleistungen", "IT-Dienstleistungen"],
    relatedArticles: ["ausschreibung-schreiben", "vob-vergabe", "wie-funktioniert-ausschreibung"],
    howToSteps: [
      { name: "Bedarf feststellen", text: "Definieren Sie den genauen Beschaffungsbedarf: Was wird benötigt, in welchem Umfang und bis wann? Klären Sie technische Anforderungen und Budgetrahmen." },
      { name: "Leistungsbeschreibung erstellen", text: "Formulieren Sie eine präzise Leistungsbeschreibung mit Spezifikationen, Mengen, Qualitätsanforderungen und Ausführungsfristen. Nutzen Sie ATV-DIN-Normen bei Bauleistungen." },
      { name: "Angebotsfrist und Formalien festlegen", text: "Legen Sie die Angebotsfrist nach dem einschlägigen Verfahren und Regelwerk fest. Definieren Sie außerdem Angebotsformat, Nachweise und Unterschrift." },
      { name: "Bekanntmachung veröffentlichen", text: "Veröffentlichen Sie die Ausschreibung auf den relevanten Portalen (DTVP, TED, evergabe). Beachten Sie die vorgeschriebenen Bekanntmachungsformulare." },
      { name: "Angebote auswerten", text: "Öffnen Sie die Angebote, prüfen Sie Formalien und Eignung. Werten Sie nach den veröffentlichten Zuschlagskriterien aus." },
      { name: "Zuschlag erteilen", text: "Das wirtschaftlichste Angebot erhält den Zuschlag. Soweit § 134 GWB anwendbar ist, muss die dort geregelte Wartefrist vor Vertragsschluss beachtet werden." },
    ],
    content: `
## Was ist eine Ausschreibung?

Eine Ausschreibung ist ein geregeltes Vergabeverfahren, bei dem öffentliche Auftraggeber (Bund, Länder, Kommunen) private Unternehmen auffordern, ein Angebot für eine bestimmte Leistung abzugeben. Ziel ist es, das wirtschaftlichste Angebot bei fairem Wettbewerb zu finden.

In Deutschland unterliegen Ausschreibungen dem Vergaberecht, das im Gesetz gegen Wettbewerbsbeschränkungen (GWB) sowie in den jeweils anwendbaren Regelwerken (unter anderem VgV, VOB/A und UVgO) geregelt ist.

## Aufbau einer Ausschreibung

Jede öffentliche Ausschreibung folgt einem klar definierten Aufbau. Die wichtigsten Bestandteile sind:

### 1. Bekanntmachung
Die Bekanntmachung enthält die Eckdaten der Ausschreibung: Auftragsgegenstand, Vergabestelle, Angebotsfrist, Verfahrensart und Kontaktdaten. Sie wird auf Vergabeportalen (DTVP, TED, evergabe) veröffentlicht.

### 2. Leistungsbeschreibung
Die Leistungsbeschreibung ist das Herzstück der Ausschreibung. Sie beschreibt genau, welche Leistung erwartet wird — einschließlich Umfang, Qualität, Fristen und technischer Anforderungen.

### 3. Vergabeunterlagen
Die Vergabeunterlagen enthalten alle Dokumente, die der Bieter benötigt: Leistungsbeschreibung, Entwurfsvertrag, Eignungsanforderungen, Zuschlagskriterien und Formalien.

### 4. Zuschlagskriterien
Die Zuschlagskriterien legen fest, wie das wirtschaftlichste Angebot ermittelt wird — entweder nach niedrigstem Preis oder nach Preis und Qualität (z.B. 70% Preis, 30% Qualität).

## Wichtige Inhalte einer Ausschreibung nach VOB/A

§ 7 VOB/A enthält vor allem Anforderungen an die Leistungsbeschreibung: Sie muss die Leistung eindeutig, erschöpfend und so beschreiben, dass vergleichbare Angebote möglich sind. Die folgenden Punkte gehören je nach Verfahren und Regelwerk typischerweise in die Vergabeunterlagen; sie sind nicht sämtlich in § 7 VOB/A geregelt:

- **Art und Umfang der Leistung** — präzise Beschreibung der Baumaßnahme
- **Ausführungsfristen** — Beginn, Dauer und Abnahmetermin
- **Angebotsfrist** — nach Verfahren, Leistungsart, Auftraggeber und den einschlägigen Vorschriften
- **Zuschlagskriterien** — transparente Gewichtung von Preis und Qualität
- **Eignungsanforderungen** — Nachweise über Referenzen, Finanzkraft und Personal
- **Formalien** — Angebotsformat, Unterschrift, elektronische Einreichung
- **Nebenangebote** — ob und unter welchen Bedingungen sie zulässig sind
- **Teillosevergabe** — ob der Auftrag in Lose aufgeteilt ist

## Muster: Leistungsbeschreibung

Hier ein vereinfachtes Muster für eine Leistungsbeschreibung:

**Auftragsgegenstand:** Gebäudereinigung für Verwaltungsgebäude

**Leistungsumfang:**
- Tägliche Grundreinigung aller Büroräume (3.200 m²)
- Wöchentliche Glasreinigung (Innenseiten)
- Monatliche Unterhaltsreinigung von Sanitäranlagen
- Halbjährliche Grundreinigung aller Böden

**Qualitätsanforderungen:**
- Reinigung nach DIN EN 13549
- Einsatz umweltfreundlicher Reinigungsmittel (EU-Blume oder vergleichbar)
- Dokumentation jeder Reinigung per Checkliste

**Fristen:**
- Vertragsbeginn: nach den Angaben der konkreten Ausschreibung
- Vertragslaufzeit: 24 Monate mit Option auf Verlängerung

**Eignungsanforderungen:**
- Mindestens 3 Referenzen vergleichbarer Reinigungsaufträge (letzte 3 Jahre)
- Berufshaftpflichtversicherung (mind. 1 Mio. € Deckungssumme)
- Unbedenklichkeitsbescheinigungen (Finanzamt, Krankenkasse, Berufsgenossenschaft)

## Checkliste: Ausschreibung erstellen

- [ ] Bedarf genau definiert (Was, Wann, Wo, Umfang)
- [ ] Leistungsbeschreibung erstellt (eindeutig, neutral, vollständig, prüfbar)
- [ ] Eignungsanforderungen formuliert (angemessen, nicht überzogen)
- [ ] Zuschlagskriterien und Gewichtung festgelegt
- [ ] Angebotsfrist festgelegt (gesetzliche Mindestfristen beachten)
- [ ] Vergabeunterlagen zusammengestellt (inkl. Entwurfsvertrag)
- [ ] Bekanntmachungsformular ausgefüllt
- [ ] Bekanntmachung auf relevanten Portalen veröffentlicht
- [ ] Relevante Bieterfragen nach den Verfahrensvorgaben beantwortet und bereitgestellt
- [ ] Angebote fristgerecht geöffnet und geprüft
- [ ] Zuschlag nach Kriterien erteilt
- [ ] Wartepflicht nach § 134 GWB geprüft und eingehalten, soweit anwendbar

## Häufige Fehler bei Ausschreibungen

1. **Unpräzise Leistungsbeschreibung:** Führt zu Nachfragen und ungleichen Angeboten
2. **Überzogene Eignungsanforderungen:** Schränken den Wettbewerb unnötig ein
3. **Fehlende Zuschlagskriterien:** Macht die Bewertung intransparent
4. **Zu kurze Fristen:** Verstoß gegen Vergaberecht
5. **Diskriminierende Anforderungen:** Herstellerangaben oder regionale Beschränkungen sind unzulässig

## Fazit

Eine gute Ausschreibung zeichnet sich durch präzise Leistungsbeschreibung, faire Eignungsanforderungen und transparente Zuschlagskriterien aus. Das Muster und die Checkliste oben helfen Auftraggebern, eine vergaberechtskonforme Ausschreibung zu erstellen — und Bietern, die Anforderungen richtig zu verstehen.
`,
  },

  // SEO: Cycle 5 — "Ausschreibung gewinnen" targets high-intent informational query for bidders
  "ausschreibung-gewinnen": {
    slug: "ausschreibung-gewinnen",
    title: "Ausschreibung gewinnen: 10 Tipps für erfolgreiche Bieter",
    description:
      "Erfolgreich bei öffentlichen Ausschreibungen: Angebot strategisch gestalten, Eignungsnachweise vorbereiten, Preis-Leistung optimieren und Zuschlag erhalten.",
    datePublished: "2025-07-04",
    dateModified: "2025-07-04",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Facility Management"],
    relatedArticles: ["wie-funktioniert-ausschreibung", "oeffentliche-auftraege-finden", "ausschreibung-muster"],
    howToSteps: [
      { name: "Passende Ausschreibungen finden", text: "Durchsuchen Sie regelmäßig DTVP, TED und evergabe nach passenden Aufträgen. Nutzen Sie KI-Tools wie Tenderhunter, um relevante Ausschreibungen frühzeitig zu erkennen." },
      { name: "Ausschreibungsunterlagen sorgfältig lesen", text: "Lesen Sie die Leistungsbeschreibung vollständig. Prüfen Sie Zuschlagskriterien, Eignungsanforderungen und Formalien — Fehler führen zum Ausschluss." },
      { name: "Eignungsnachweise vorbereiten", text: "Halten Sie alle Nachweise aktuell: Handelsregister, Gewerbeanmeldung, Unbedenklichkeitsbescheinigungen, Referenzen, Bilanzen und Versicherungen." },
      { name: "Angebot strategisch kalkulieren", text: "Kalkulieren Sie den Preis realistisch — zu niedrig wirkt unseriös, zu hoch verliert den Zuschlag. Berücksichtigen Sie Mindestlohn und Tariftreue." },
      { name: "Angebot fristgerecht einreichen", text: "Reichen Sie das Angebot elektronisch und vor Fristende ein. Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht gewertet." },
    ],
    content: `
## Warum gewinnen manche Bieter regelmäßig?

Öffentliche Ausschreibungen folgen klaren Regeln. Bieter, die diese Regeln verstehen und systematisch vorgehen, haben deutlich bessere Chancen auf den Zuschlag. Die wichtigsten Erfolgsfaktoren sind: sorgfältige Vorbereitung, realistische Kalkulation und fehlerfreie Unterlagen.

## Tipp 1: Passende Ausschreibungen frühzeitig erkennen

Der erste Schritt zum Gewinn ist die richtige Ausschreibung. Nicht jeder Auftrag passt zu Ihrem Unternehmen — bewerben Sie sich nur auf Aufträge, die Sie tatsächlich erfüllen können.

- Nutzen Sie Vergabeportale (DTVP, TED, evergabe) für tägliche Recherche
- Setzen Sie KI-gestützte Tools ein, die automatisch passende Ausschreibungen filtern
- Prüfen Sie die Eignungsanforderungen bevor Sie sich bewerben — eine unrealistische Bewerbung kostet nur Zeit

## Tipp 2: Ausschreibungsunterlagen genau lesen

Die häufigste Ursache für den Ausschluss: formale Fehler oder fehlende Unterlagen. Lesen Sie die Vergabeunterlagen vollständig:

- Welche Zuschlagskriterien gelten? (Preis allein oder Preis + Qualität?)
- Welche Formalien sind vorgeschrieben? (Format, Unterschrift, elektronische Einreichung)
- Welche Eignungsnachweise werden gefordert? (Referenzen, Bilanzen, Zertifikate)
- Sind Nebenangebote zulässig?
- Welche Vertragsbedingungen gelten? (VOB/B, BGB, EVB-IT)

## Tipp 3: Eignungsanforderungen vorbereiten

Halten Sie folgende Unterlagen immer aktuell und griffbereit:

- Handelsregisterauszug und Gewerbeanmeldung
- Unbedenklichkeitsbescheinigungen (Finanzamt, Krankenkasse, Berufsgenossenschaft)
- Jahresabschlüsse (letzte 2–3 Jahre)
- Referenzliste mit vergleichbaren Projekten (inkl. Auftraggeber, Volumen, Zeitraum)
- Versicherungsnachweise (Berufshaftpflicht, Betriebshaftpflicht)
- Zertifikate (ISO 9001, ISO 14001, ISO 27001)

**Tipp:** Viele Bieter verlieren Aufträge, weil sie Referenzen nicht aktuell haben oder Nachweise zu spät besorgen. Führen Sie ein Eignungs-Dossier, das Sie bei jeder Ausschreibung aktualisieren.

## Tipp 4: Preis-Leistungs-Verhältnis optimieren

Bei öffentlichen Ausschreibungen entscheidet meist der Preis — aber nicht immer der niedrigste. Zwei Modelle:

### Niedrigstes Angebot (Preis allein)
- Standard bei einfachen, gut definierten Leistungen
- Kalkulieren Sie realistisch: Material, Personal, Overhead, Marge
- Zu niedrige Preise wirken unseriös und können zum Ausschluss führen

### Wirtschaftlichstes Angebot (Preis + Qualität)
- Qualitative Kriterien werden berücksichtigt (z.B. 70% Preis, 30% Qualität)
- Investieren Sie in ein überzeugendes Qualitätskonzept
- Dokumentieren Sie Referenzen, Zertifikate und besondere Qualifikationen

**Tipp:** Bei Preis-Plus-Qualität-Vergaben lohnt es sich, mehr in Qualität zu investieren — der Preisvorteil eines Konkurrenten kann durch bessere Qualität ausgeglichen werden.

## Tipp 5: Referenzen und Nachweise strategisch auswählen

Nicht jede Referenz ist gleich viel wert. Wählen Sie Projekte aus, die:

- **Vergleichbar** sind — ähnliche Leistung, ähnliches Volumen, ähnliche Branche
- **Aktuell** sind — die letzten 3–5 Jahre
- **Erfolgreich** waren — fristgerecht, budgetgerecht, ohne Mängel
- **Nachweisbar** sind — mit Bestätigung des Auftraggebers

## Tipp 6: Formale Fehler vermeiden

Die häufigsten formalen Gründe für den Ausschluss:

1. **Frist versäumt** — Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht gewertet
2. **Unterschrift fehlt** — Elektronische Signatur oder eigenhändige Unterschrift
3. **Nachweise unvollständig** — Fehlende Bescheinigungen oder abgelaufene Zertifikate
4. **Format nicht eingehalten** — PDF statt Word, falsche Seitenzahl, fehlende Anlagen
5. **Nebenangebot nicht gekennzeichnet** — Muss klar als solches erkennbar sein

## Tipp 7: Bieterfragen nutzen

In der vorgesehenen Frage- und Angebotsfrist können Bieter Fragen stellen. Nutzen Sie diese Möglichkeit:

- Stellen Sie Fragen zu unklaren Anforderungen
- Fragen Sie nach technischen Details, die in der Leistungsbeschreibung fehlen
- Relevante Antworten müssen nach dem anwendbaren Vergaberecht gleichbehandlungs- und transparent bereitgestellt werden

## Tipp 8: Nachverhandlungen vorbereiten

Nur in Verhandlungsverfahren oder anderen ausdrücklich dafür vorgesehenen Verfahrenssituationen kann es zu Verhandlungen kommen. Im offenen Verfahren sind Verhandlungen über Angebote und Preise unzulässig. Bereiten Sie sich vor:

- Kennen Sie Ihre Schmerzgrenze beim Preis
- Haben Sie Argumente für Ihre Qualitätsvorteile parat
- Seien Sie offen für Kompromisse bei der Leistungserbringung

## Tipp 9: Aus Absagen lernen

Nicht jedes Angebot führt zum Zuschlag. Nutzen Sie Ablehnungen als Lernchance:

- Fordern Sie eine Aufklärung über den Zuschlagsempfänger an
- Analysieren Sie, woran es lag (Preis, Qualität, Referenzen?)
- Passen Sie Ihre Strategie für zukünftige Ausschreibungen an

## Tipp 10: Netzwerken und Kooperieren

Bei größeren Aufträgen können Bietergemeinschaften (ARGE) oder Subunternehmer-Strategien sinnvoll sein:

- Kleinere Unternehmen schließen sich zusammen, um die Eignungsanforderungen zu erfüllen
- Generalunternehmer beziehen spezialisierte Subunternehmer ein
- Nutzen Sie IHK-Netzwerke und Fachverbände für Kontakte

## Fazit

Ausschreibungen gewinnen ist keine Glückssache — es erfordert Systematik, Vorbereitung und Erfahrung. Wer die Vergabeunterlagen sorgfältig liest, die Eignungsnachweise aktuell hält und ein realistisches Angebot kalkuliert, hat beste Chancen auf den Zuschlag.
`,
  },

  "nachpruefungsverfahren-vergabe": {
    slug: "nachpruefungsverfahren-vergabe",
    title: "Nachprüfungsverfahren bei der Vergabe: Rüge und Rechte der Bieter",
    description:
      "Vergabefehler erkennen, Rüge aussprechen und Nachprüfungsverfahren einleiten. Alle Rechte der Bieter bei Vergabeverstößen — von der Rüge bis zur Vergabekammer.",
    datePublished: "2025-06-01",
    dateModified: "2026-09-17",
    lastReviewed: "2026-09-17",
    relatedCategories: ["Bauarbeiten", "Tiefbau"],
    relatedArticles: ["vob-vergabe", "vergabeverfahren-uebersicht", "ausschreibung-gewinnen"],
    relatedGlossaryTerms: ["nachpruefungsverfahren", "ruege", "vergabekammer", "vergabesenat", "gwb-vergaberecht"],
    sources: [
      { title: "§ 160 GWB – Einleitung, Antrag", url: "https://www.gesetze-im-internet.de/gwb/__160.html" },
      { title: "§ 134 GWB – Informations- und Wartepflicht", url: "https://www.gesetze-im-internet.de/gwb/__134.html" },
      { title: "§ 172 GWB – Frist, Form, Inhalt der sofortigen Beschwerde", url: "https://www.gesetze-im-internet.de/gwb/__172.html" },
      { title: "§ 182 GWB – Kosten des Verfahrens vor der Vergabekammer", url: "https://www.gesetze-im-internet.de/gwb/__182.html" },
    ],
    howToSteps: [
      { name: "Vergabefehler erkennen", text: "Prüfen Sie die Vergabeunterlagen und das Verfahren auf Verstöße gegen Vergaberecht: formale Fehler, inhaltliche Mängel oder Verfahrensverstöße." },
      { name: "Rüge aussprechen", text: "Rügen Sie einen erkannten Vergabeverstoß gegenüber dem Auftraggeber konkret und rechtzeitig. Die gesetzlichen Anforderungen und Fristen des § 160 Abs. 3 GWB sind zu prüfen." },
      { name: "Antrag bei Vergabekammer stellen", text: "Wenn der Auftraggeber nicht abhilft, stellen Sie unter den Voraussetzungen des GWB einen Nachprüfungsantrag bei der zuständigen Vergabekammer. Maßgeblich sind insbesondere Antragsbefugnis und die gesetzlichen Fristen." },
      { name: "Kammer-Entscheidung abwarten", text: "Die Vergabekammer prüft Zulässigkeit und Begründetheit und kann Maßnahmen zur Korrektur des Vergabeverfahrens treffen. Die konkrete Verfahrensdauer hängt vom Fall ab." },
    ],
    content: `
## Was ist ein Nachprüfungsverfahren?

Das Nachprüfungsverfahren ist das vergaberechtliche Instrument, mit dem Unternehmen Verstöße gegen Vergaberegeln geltend machen können. Es ist kein allgemeiner Widerspruch, sondern ein eigenständiges Verfahren nach dem vierten Teil des GWB.

**Wichtig:** Antragsbefugt ist ein Unternehmen, das ein Interesse am konkreten Auftrag oder an der Konzession hat, eine mögliche Rechtsverletzung geltend macht und einen drohenden oder entstandenen Schaden darlegt. Eine bloß allgemeine Kritik ohne eigenes Auftragsinteresse genügt nicht.

## Welche Vergabefehler können gerügt werden?

### Formale Fehler
- Fehlende oder fehlerhafte Bekanntmachung
- Unvollständige Vergabeunterlagen
- Zu kurze Angebotsfristen
- Verstoß gegen die Pflicht zur Teillosevergabe

### Inhaltliche Mängel
- Diskriminierende Eignungsanforderungen
- Unklare oder nachträglich geänderte Zuschlagskriterien
- Unzulässige Produktvorgaben (Herstellerangaben)
- Fehlerhafte Bewertung der Angebote

### Verfahrensverstöße
- Verstoß gegen das Transparenzgebot
- Geheime Verhandlungen mit ausgewählten Bietern
- Zuschlag ohne ordnungsgemäße Bekanntmachung
- Verstoß gegen die Wartepflicht

## Schritt 1: Vergabefehler erkennen

Prüfen Sie systematisch:

1. **Bekanntmachung:** Ist sie ordnungsgemäß veröffentlicht? Stimmen die Angaben?
2. **Vergabeunterlagen:** Sind sie vollständig und widerspruchsfrei?
3. **Eignungsanforderungen:** Sind sie diskriminierungsfrei und angemessen?
4. **Zuschlagskriterien:** Sind sie transparent und nachvollziehbar?
5. **Verfahrensablauf:** Wurden Fristen und Formalien eingehalten?

**Tipp:** Dokumentieren Sie alle Auffälligkeiten sofort mit Datum, Uhrzeit und Quelle. Spätere Nachweise sind schwierig.

## Schritt 2: Rüge aussprechen

Bevor Sie einen Nachprüfungsantrag stellen können, müssen Sie den Vergabefehler beim Auftraggeber rügen (§ 160 Abs. 3 GWB).

### Anforderungen an die Rüge
- **Nachvollziehbar übermitteln:** Nutzen Sie den in den Vergabeunterlagen vorgesehenen Kommunikationsweg; eine dokumentierte elektronische Übermittlung kann je nach Verfahren genügen
- **Konkret:** Benennen Sie den Vergabefehler genau
- **Frist:** Setzen Sie keine pauschale gesetzliche Abhilfefrist voraus; entscheidend sind die Rüge- und Antragsfristen des § 160 Abs. 3 GWB
- **Dokumentation:** Bewahren Sie den Versandnachweis auf

### Musterformulierung
"Hiermit rüge ich den Vergabefehler [konkret beschreiben] im Vergabeverfahren [Aktenzeichen]. Ich bitte um Abhilfe bis zum [Datum]."

**Wichtig:** Ein erkannter Verstoß ist im Anwendungsbereich des § 160 Abs. 3 GWB grundsätzlich innerhalb von zehn Kalendertagen zu rügen. Verstöße, die aus der Bekanntmachung oder den Vergabeunterlagen erkennbar sind, müssen spätestens bis zum Ablauf der dort genannten Bewerbungs- oder Angebotsfrist gerügt werden.

## Schritt 3: Nachprüfungsantrag stellen

Wenn der Auftraggeber nicht abhilft, können Sie einen Nachprüfungsantrag bei der zuständigen Vergabekammer stellen.

### Zuständige Vergabekammer
- **Vergabekammer des Bundes oder eines Landes:** Welche Stelle zuständig ist, richtet sich nach Auftraggeber und Auftrag
- **Zuständigkeit:** Maßgeblich sind die gesetzlichen Zuständigkeitsregeln; der Sitz des Auftraggebers ist ein wichtiger, aber nicht alleiniger Anknüpfungspunkt

### Fristen
Die Fristen richten sich nach § 160 Abs. 3 GWB und hängen davon ab, wann der Verstoß erkannt wurde und ob er aus Bekanntmachung oder Vergabeunterlagen hervorgeht. Ein erkannter Verstoß ist grundsätzlich innerhalb von 10 Kalendertagen zu rügen; Fehler aus Bekanntmachung oder Unterlagen müssen spätestens bis zum Ablauf der Angebots- oder Bewerbungsfrist gerügt werden. Zusätzlich gilt eine gesetzliche Ausschlussfrist nach einer Mitteilung des Auftraggebers, dass er der Rüge nicht abhilft.

### Antragsinhalt
Der Antrag muss enthalten:
1. Bezeichnung des Vergabeverfahrens
2. Konkrete Benennung des Vergabefehlers
3. Antrag auf Abhilfe oder Aufhebung des Vergabeverfahrens
4. Nachweis der Rüge (Kopie der Rüge und Antwort)

## Schritt 4: Verfahren vor der Vergabekammer

### Ablauf
1. **Antragseingang** bei der Vergabekammer
2. **Prüfung der Zulässigkeit** (Fristen, Rügepflicht, Antragsbefugnis)
3. **Anhörung** der Beteiligten (Auftraggeber und betroffene Bieter)
4. **Entscheidung** innerhalb der gesetzlichen Frist

### Entscheidungsmöglichkeiten
- **Antrag abgelehnt:** Kein Vergabefehler festgestellt
- **Antrag stattgegeben:** Auftraggeber muss den Fehler korrigieren
- **Vergabeverfahren aufgehoben:** Neues Verfahren erforderlich
- **Zuschlag untersagt:** Auftraggeber darf keinen Vertrag schließen

### Fristen der Vergabekammer
Die Vergabekammer entscheidet grundsätzlich innerhalb der gesetzlichen Entscheidungsfrist; die konkrete Dauer und mögliche Verlängerungen richten sich nach dem Verfahrensstand und den gesetzlichen Voraussetzungen. Eine pauschale Dauer für jede Vergabe lässt sich daraus nicht ableiten.

## Schritt 5: Rechtsmittel

Gegen die Entscheidung der Vergabekammer können Sie Rechtsmittel einlegen:

### Oberlandesgericht (OLG)
- **Rechtsbehelf:** Sofortige Beschwerde gegen die Entscheidung der Vergabekammer
- **Frist:** Zwei Wochen nach Zustellung der Kammer-Entscheidung
- **Form:** Schriftlich, begründet und grundsätzlich anwaltlich unterzeichnet
- **Weitere Vorlage:** Eine Vorlage an den Bundesgerichtshof kommt nur unter den besonderen gesetzlichen Voraussetzungen in Betracht

### Sofortige Beschwerde
- Sie ist der gesetzliche Rechtsbehelf gegen die Entscheidung der Vergabekammer und nicht nur für besonders eilige Fälle vorgesehen
- Ihre Wirkung und mögliche vorläufige Maßnahmen richten sich nach den §§ 173 ff. GWB

## Kosten des Nachprüfungsverfahrens

### Gebühren der Vergabekammer
Für das Nachprüfungsverfahren fallen grundsätzlich Gebühren an. Höhe und Kostenentscheidung richten sich nach den gesetzlichen Vorschriften und dem konkreten Verfahren; pauschale Gebührenkorridore oder eine automatische Kostenerstattung sollten daher nicht angenommen werden.

### Anwaltskosten
Die notwendigen Aufwendungen und ihre Erstattung richten sich nach dem Ausgang des Verfahrens und den gesetzlichen Vorschriften. Pauschale Kostenangaben sind nicht belastbar; insbesondere können Anwaltskosten, Auslagen, Kammergebühren und gegebenenfalls Kosten eines Beschwerdeverfahrens anfallen.

## Häufige Fragen

**Kann ich nach der Angebotsabgabe noch rügen?**
Das hängt vom Zeitpunkt der Kenntnis und vom betroffenen Fehler ab. Für Fehler aus Bekanntmachung oder Vergabeunterlagen ist regelmäßig die Angebots- oder Bewerbungsfrist maßgeblich; bei später erkannten Verstößen gelten die weiteren Voraussetzungen und Fristen des § 160 Abs. 3 GWB.

**Was passiert, wenn ich zu spät rüge?**
Eine verspätete Rüge kann zur Unzulässigkeit eines späteren Nachprüfungsantrags führen. Welche Frist gilt, muss anhand des konkreten Fehlers und Kenntniszeitpunkts geprüft werden.

**Kann ich Schadensersatz verlangen?**
Schadensersatz ist vom Nachprüfungsverfahren zu unterscheiden. Ob ein Anspruch besteht, hängt von einer eigenen Anspruchsgrundlage und den Umständen des Einzelfalls ab; die Vergabekammer spricht nicht automatisch entgangenen Gewinn zu.

**Muss ich den Auftraggeber vorher informieren?**
Grundsätzlich muss ein erkannter Vergabeverstoß zunächst gegenüber dem Auftraggeber gerügt werden. § 160 Abs. 3 GWB enthält jedoch differenzierte Fristen und Ausnahmen, etwa für bestimmte Feststellungsanträge; der konkrete Fall muss geprüft werden.

## Fazit

Das Nachprüfungsverfahren ist ein starkes Instrument für Bieter bei Vergabefehlern. Entscheidend sind: schnelle Erkennung des Fehlers, ordnungsgemäße Rüge und fristgerechter Antrag. Wer diese Schritte befolgt, hat gute Chancen, Vergabefehler korrigieren zu lassen.
`,
  },

  // SEO: Neue Artikel für Cycle 6 — "Angebot schreiben" targets high-intent informational query
  "angebot-oeffentliche-ausschreibung-schreiben": {
    slug: "angebot-oeffentliche-ausschreibung-schreiben",
    title: "Angebot bei öffentlicher Ausschreibung schreiben: Anleitung und Checkliste",
    description:
      "Angebot bei öffentlichen Ausschreibungen schreiben: Struktur, Preisermittlung, Formblätter, Eignungsnachweise und Checkliste. Schritt-für-Schritt für Bieter bei VOB- und VOL-Vergaben.",
    datePublished: "2026-07-05",
    dateModified: "2026-07-05",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Facility Management", "Lieferung"],
    relatedArticles: ["wie-funktioniert-ausschreibung", "ausschreibung-gewinnen", "vob-vergabe"],
    relatedGlossaryTerms: ["angebot", "vergabeunterlagen", "e-vergabe", "eignungskriterien", "zuschlagskriterien", "nachforderung-unterlagen"],
    howToSteps: [
      { name: "Ausschreibungsunterlagen sorgfältig lesen", text: "Lesen Sie die Leistungsbeschreibung, Vergabeunterlagen und Zuschlagskriterien vollständig. Notieren Sie alle Formalien, Fristen und Eignungsanforderungen." },
      { name: "Eignungsnachweise zusammenstellen", text: "Stellen Sie alle geforderten Nachweise zusammen: Handelsregister, Gewerbeanmeldung, Unbedenklichkeitsbescheinigungen, Referenzen, Bilanzen und Versicherungen." },
      { name: "Preis kalkulieren", text: "Kalkulieren Sie den Preis realistisch: Material, Personal (inkl. Mindestlohn), Lohnnebenkosten, Overhead und Marge. Berücksichtigen Sie Tariftreue und Nachhaltigkeitsanforderungen." },
      { name: "Angebot formatieren und einreichen", text: "Formatieren Sie das Angebot nach den Vorgaben der Ausschreibung. Reichen Sie elektronisch und vor Fristende ein. Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht gewertet." },
    ],
    content: `
## Warum ein gutes Angebot über den Zuschlag entscheidet

Bei öffentlichen Ausschreibungen gewinnt nicht das billigste Angebot — sondern das wirtschaftlichste. Das bedeutet: Wer ein vollständiges, formal korrektes und strategisch kalkuliertes Angebot abgibt, hat die besten Chancen auf den Zuschlag. Dieser Artikel erklärt, wie Sie ein Angebot bei öffentlichen Ausschreibungen Schritt für Schritt erstellen.

## Schritt 1: Die Ausschreibung verstehen

Bevor Sie mit der Angebotserstellung beginnen, müssen Sie die Ausschreibung vollständig verstehen:

### Leistungsbeschreibung studieren
- Was genau wird gefordert? (Umfang, Qualität, Menge)
- Welche technischen Anforderungen gelten? (Normen, Standards)
- Welche Fristen sind vorgegeben? (Ausführungsfrist, Liefertermin)
- Welche Formalien sind einzuhalten? (Format, Unterschrift, Anlagen)

### Zuschlagskriterien analysieren
- **Niedrigstes Angebot:** Preis allein entscheidet
- **Wirtschaftlichstes Angebot:** Preis und Qualität (z.B. 70% Preis, 30% Qualität)

**Tipp:** Bei wirtschaftlichstem Angebot lohnt es sich, mehr in Qualität zu investieren — der Preisvorteil eines Konkurrenten kann durch bessere Qualität ausgeglichen werden.

### Eignungsanforderungen prüfen
- Welche Nachweise werden gefordert?
- Erfüllen Sie alle Anforderungen?
- Können Sie die Nachweise fristgerecht besorgen?

## Schritt 2: Eignungsnachweise zusammenstellen

Halten Sie folgende Unterlagen immer aktuell und griffbereit:

| Nachweis | Gültigkeit | Bezugsquelle |
|----------|-----------|--------------|
| Handelsregisterauszug | Aktuell | Amtsgericht |
| Gewerbeanmeldung | Aktuell | Gewerbeamt |
| Unbedenklichkeitsbescheinigung Finanzamt | Aktuell | Finanzamt |
| Unbedenklichkeitsbescheinigung Krankenkasse | Aktuell | Krankenkasse |
| Berufsgenossenschaft | Aktuell | BG |
| Jahresabschlüsse | Letzte 2-3 Jahre | Steuerberater |
| Referenzliste | Letzte 3-5 Jahre | Intern |
| Berufshaftpflicht | Aktuell | Versicherer |
| ISO-Zertifikate | Gültig | Zertifizierungsstelle |

**Tipp:** Führen Sie ein Eignungs-Dossier, das Sie bei jeder Ausschreibung aktualisieren. Viele Bieter verlieren Aufträge, weil sie Nachweise nicht aktuell haben.

## Schritt 3: Preis kalkulieren

Die Preisermittlung ist der sensibelste Teil der Angebotserstellung. Kalkulieren Sie realistisch:

### Kostenbestandteile
1. **Materialkosten:** Rohstoffe, Verbrauchsgüter, Betriebsstoffe
2. **Personalkosten:** Brutto-Lohn + Lohnnebenkosten (AG-Anteil SV, BG, Urlaubs-/Weihnachtsgeld)
3. **Overhead:** Verwaltung, IT, Miete, Fuhrpark
4. **Marge:** Gewinnzuschlag (üblich: 5-15% je nach Branche)

### Wichtige Hinweise
- **Mindestlohn:** Kalkulieren Sie den jeweils geltenden gesetzlichen Mindestlohn sowie einschlägige tarifliche oder landesrechtliche Vorgaben ein; die konkreten Vergabeunterlagen sind maßgeblich
- **Tariftreue:** Viele Vergabestellen fordern Tariflohn — prüfen Sie die AVR, TVöD oder TV-L
- **Materialpreise:** Bei langfristigen Verträgen (Rahmenvereinbarungen) Preissteigerungen einkalkulieren
- **Nachhaltigkeit:** Zertifizierte Materialien (EU-Blume, Blauer Engel) können Mehrkosten verursachen, aber den Zuschlag sichern

### Preis-Plus-Qualität-Strategie
Bei wirtschaftlichstem Angebot (Preis + Qualität):
- Kalkulieren Sie den Preis nicht zu niedrig — das wirkt unseriös
- Investieren Sie in ein überzeugendes Qualitätskonzept
- Dokumentieren Sie Referenzen, Zertifikate und besondere Qualifikationen

## Schritt 4: Angebot formatieren

Das Angebot muss den Formalien der Ausschreibung entsprechen:

### Typische Formalien
- **Format:** PDF oder Word (vorgegeben)
- **Unterschrift:** Eigenhändig oder elektronisch (QES)
- **Seitenzahl:** Paginierung vorgeschrieben
- **Anlagen:** Nummeriert und referenziert
- **Umschlag:** Bei postalischer Einreichung versiegelt

### Elektronische Einreichung
Viele Vergaben erfolgen elektronisch über evergabe, DTVP oder vergabio:
- Registrieren Sie sich rechtzeitig auf der Plattform
- Testen Sie den Upload-Prozess vor Fristende
- Hochladen dauert länger als gedacht — nicht auf die letzte Minute warten

### Angebotsinhalt
Das Angebot sollte enthalten:
1. **Deckblatt:** Firmenname, Ansprechpartner, Aktenzeichen
2. **Preisübersicht:** Nach Losen oder Leistungspositionen
3. **Eignungsnachweise:** Als Anlagen
4. **Qualitätskonzept:** Bei wirtschaftlichstem Angebot
5. **Referenzliste:** Vergleichbare Projekte
6. **Erklärungen:** Keine Korruption, keine Kartellabsprachen

## Schritt 5: Angebot einreichen

### Frist einhalten
- **EU-Verfahren:** Die Mindestfrist hängt vom Verfahren ab; im offenen Verfahren nach VgV beträgt sie regulär 35 Tage, Verkürzungen sind nur unter gesetzlichen Voraussetzungen möglich
- **Unterhalb der Schwellenwerte:** Es gibt keine einheitliche Frist für alle Auftraggeber und Leistungen; maßgeblich sind das einschlägige Regelwerk und die Vergabeunterlagen
- **Fristversäumnis:** Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht gewertet

### Einreichung prüfen
Vor der Einreichung prüfen:
- [ ] Alle Formalien erfüllt?
- [ ] Alle Nachweise beigefügt?
- [ ] Preis korrekt kalkuliert?
- [ ] Unterschrift vorhanden?
- [ ] Angebot vollständig?

## Typische Fehler vermeiden

1. **Frist versäumt** — Verspätete Angebote werden nach den anwendbaren Vorschriften grundsätzlich nicht gewertet
2. **Unterschrift fehlt** — Elektronische Signatur oder eigenhändige Unterschrift
3. **Nachweise unvollständig** — Fehlende Bescheinigungen oder abgelaufene Zertifikate
4. **Format nicht eingehalten** — PDF statt Word, falsche Seitenzahl, fehlende Anlagen
5. **Nebenangebot nicht gekennzeichnet** — Muss klar als solches erkennbar sein
6. **Preis zu niedrig** — Ein ungewöhnlich niedriges Angebot kann nach den anwendbaren Vorschriften aufgeklärt und bei fehlender tragfähiger Erklärung ausgeschlossen werden (§ 60 VgV im entsprechenden Anwendungsbereich)
7. **Arbeitsbedingungen nicht berücksichtigt** — Prüfen Sie gesetzliche Mindestlöhne, Tariftreue- und sonstige landesrechtliche Vorgaben des konkreten Auftrags

## Checkliste: Angebot erstellen

- [ ] Ausschreibungsunterlagen vollständig gelesen
- [ ] Zuschlagskriterien analysiert
- [ ] Eignungsanforderungen geprüft
- [ ] Eignungsnachweise zusammengestellt
- [ ] Preis realistisch kalkuliert (inkl. Lohnnebenkosten)
- [ ] Angebot nach Formalien formatiert
- [ ] Alle Anlagen beigefügt
- [ ] Angebot auf Vollständigkeit geprüft
- [ ] Unterschrift (eigenhändig oder QES)
- [ ] Elektronische Einreichung getestet
- [ ] Angebot fristgerecht eingereicht

## Fazit

Ein Angebot bei öffentlichen Ausschreibungen zu schreiben erfordert Sorgfalt, Systematik und Erfahrung. Wer die Leistungsbeschreibung genau liest, die Eignungsnachweise aktuell hält und den Preis realistisch kalkuliert, hat beste Chancen auf den Zuschlag. Die Checkliste oben hilft, keine wichtigen Punkte zu übersehen.
`,
  },
  "vergaberecht-leitfaden": {
    slug: "vergaberecht-leitfaden",
    title: "Vergaberecht in Deutschland – Leitfaden für Unternehmen",
    description:
      "Umfassender Leitfaden zum Vergaberecht in Deutschland: Gesetzliche Grundlagen, Zuständigkeiten, Rechtsschutz und praktische Tipps für Unternehmen bei öffentlichen Ausschreibungen.",
    datePublished: "2025-02-01",
    dateModified: "2026-09-13",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Planungsleistungen"],
    relatedArticles: ["vergabeverfahren-uebersicht", "vob-vergabe", "nachpruefungsverfahren-vergabe"],
    content: `
## Was ist Vergaberecht?

Das Vergaberecht regelt, wie öffentliche Aufträge an private Unternehmen vergeben werden. Es soll fairen Wettbewerb garantieren und sicher, dass Steuergelder wirtschaftlich eingesetzt werden. In Deutschland basiert es auf EU-Richtlinien und ist im Gesetz gegen Wettbewerbsbeschränkungen (GWB) verankert.

## Gesetzliche Grundlagen

### Gesetz gegen Wettbewerbsbeschränkungen (GWB)

Das GWB bildet die Grundlage des deutschen Vergaberechts. Der vierte Teil enthält die zentralen Regeln für Vergaben im Oberschwellenbereich, darunter Grundsätze, Anwendungsbereich, Schwellenwerte und Rechtsschutz. Seit der Vergaberechtsreform 2016 wurden die Regeln mehrfach weiterentwickelt.

**Wichtige Paragrafen:**
- § 97 GWB: Grundsätze der Vergabe (Wettbewerb, Transparenz, Gleichbehandlung)
- § 99 GWB: Öffentliche Auftraggeber
- § 100 und § 101 GWB: Sektorenauftraggeber und Tätigkeiten
- § 103 GWB: Auftragsarten (Liefer-, Dienstleistungs-, Bauaufträge)
- § 106 GWB: Schwellenwerte

### Vergabeverordnungen

Die detaillierten Verfahrensregeln stehen in den Vergabeverordnungen:

| Verordnung | Anwendungsbereich |
|-----------|------------------|
| VgV | Vergabe von Liefer- und Dienstleistungen im Anwendungsbereich des EU-Oberschwellenbereichs |
| VOB/A | Vergabe von Bauleistungen |
| UVgO | Liefer- und Dienstleistungen im Unterschwellenbereich, soweit eingeführt |
| SektVO | Vergabe durch Sektorenauftraggeber (Energie, Wasser, Verkehr) |

## Zuständigkeiten

### Vergabekammern

Vergabekammern sind die erste Instanz für vergaberechtliche Nachprüfungsverfahren. Zuständig ist die Vergabekammer des Bundes oder des jeweiligen Landes nach den gesetzlichen Zuständigkeitsregeln.

**Aufgaben der Vergabekammern:**
- Prüfung von Vergabeverfahren auf Rechtmäßigkeit
- Erlass von einstweiligen Anordnungen
- Aufhebung rechtswidriger Vergabeentscheidungen
- Anordnung von Maßnahmen zur Beseitigung festgestellter Vergabeverstöße

### Oberlandesgerichte

Die Vergabesenate der Oberlandesgerichte entscheiden über die sofortige Beschwerde gegen Entscheidungen der Vergabekammern. Das ist ein besonderer vergaberechtlicher Rechtsbehelf und keine gewöhnliche Berufung.

## Rechtsschutz im Vergabeverfahren

### Rügepflicht

Unternehmen müssen erkannte Vergabeverstöße nach Maßgabe des § 160 Abs. 3 GWB rechtzeitig rügen. Für einen erkannten Verstoß gilt grundsätzlich eine Frist von zehn Kalendertagen. Die Rüge muss:
- Schriftlich erfolgen
- Den Verstoß konkret benennen
- Innerhalb von 10 Tagen nach Kenntnis erfolgen

### Nachprüfungsantrag

Wenn die Rüge nicht abhilft, können Unternehmen einen Nachprüfungsantrag bei der Vergabekammer stellen. Voraussetzungen:
- Mögliche Verletzung einer vergaberechtlichen Vorschrift
- Rechtzeitige Rüge
- Antragsfrist: In bestimmten Fällen 15 Kalendertage nach Eingang der Mitteilung, dass der Auftraggeber der Rüge nicht abhelfen will; die weiteren Voraussetzungen des § 160 GWB müssen erfüllt sein

### Einstweilige Anordnung

Bei dringender Eilbedürftigkeit können Unternehmen eine einstweilige Anordnung beantragen, um die Zuschlagserteilung zu verhindern.

## Praktische Tipps für Unternehmen

### Ausschreibungen finden

- **Bundesanzeiger**: Offizielle Plattform für nationale Ausschreibungen
- **TED (Tenders Electronic Daily)**: EU-weite Ausschreibungen
- **DTVP**: Deutsche Vergabeportal
- **evergabe**: Online-Vergabeplattform
- **Tenderhunter**: KI-gestützte Ausschreibungssuche

### Angebotsstellung

1. **Vergabeunterlagen vollständig lesen**: Alle Anforderungen verstehen
2. **Eignungsanforderungen prüfen**: Sicherstellen, dass alle Nachweise vorliegen
3. **Zuschlagskriterien analysieren**: Angebot auf Kriterien ausrichten
4. **Fristen einhalten**: Angebot fristgerecht einreichen
5. **Formalien beachten**: Format, Unterschrift, Anlagen

### Häufige Fehler

- Unvollständige Eignungsnachweise
- Fristversäumnis
- Formale Mängel im Angebot
- Fehlende Unterschrift
- Nichtbeachtung der Zuschlagskriterien

## Aktuelle Entwicklungen

### Digitalisierung

Die Vergabe wird zunehmend digitalisiert. Für viele Verfahren gelten elektronische Kommunikation und elektronische Angebotsabgabe; die konkreten Anforderungen richten sich nach dem Verfahren und den anwendbaren Vorschriften. Das bedeutet:
- Elektronische Einreichung von Angeboten
- Digitale Vergabeunterlagen
- Elektronische Kommunikation

### Nachhaltigkeit

Nachhaltigkeitskriterien gewinnen im Vergaberecht an Bedeutung. Öffentliche Auftraggeber müssen zunehmend ökologische und soziale Aspekte berücksichtigen.

### Künstliche Intelligenz

KI wird im Vergabewesen eingesetzt für:
- Automatische Kategorisierung von Ausschreibungen
- Bewertung von Angeboten
- Erkennung von Vergabeverstößen

## Fazit

Das Vergaberecht ist komplex, aber durchsichtig. Wer die grundlegenden Regeln kennt und die Rechtsschutzmöglichkeiten nutzt, kann erfolgreich an öffentlichen Ausschreibungen teilnehmen. Wichtig ist, Vergabeverstöße frühzeitig zu erkennen und zu rügen.
`,
  },
  "eu-vergabe": {
    slug: "eu-vergabe",
    title: "EU-Vergabe – Ausschreibungen europaweit finden und gewinnen",
    description:
      "EU-Vergabe erklärt: Schwellenwerte, TED-Suche, Vergabeverfahren in der EU, Rechtsschutz und Tipps für deutsche Unternehmen bei europaweiten Ausschreibungen.",
    datePublished: "2025-02-15",
    dateModified: "2026-10-11",
    relatedCategories: ["IT-Dienstleistungen", "Planungsleistungen", "Lieferung"],
    relatedArticles: ["vergabeverfahren-uebersicht", "schwellenwerte-vergabe", "vob-vergabe", "vergaberecht-leitfaden", "oeffentliche-auftraege-finden"],
    relatedGlossaryTerms: ["schwellenwerte", "auftragswert", "vob-a-eu", "vgv-vergabeverordnung", "gwb-vergaberecht", "ted"],
    sources: [
      { title: "Bundesanzeiger: EU-Schwellenwerte ab 1. Januar 2026", url: "https://www.bundesanzeiger.de/pub/publication/zDKvMODHbpcIPpDPapc/content/zDKvMODHbpcIPpDPapc/BAnz%20AT%2018.12.2025%20B4.pdf?inline" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "Delegierte Verordnung (EU) 2025/2152", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2152" },
      { title: "Delegierte Verordnung (EU) 2025/2151 für Konzessionen", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2151" },
      { title: "Delegierte Verordnung (EU) 2025/2150 für Sektorenauftraggeber", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2150" },
      { title: "Delegierte Verordnung (EU) 2025/2487 für Verteidigung und Sicherheit", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2487" },
    ],
    lastReviewed: "2026-10-11",
    content: `
## Was ist EU-Vergabe?

Die EU-Vergabe regelt die Vergabe öffentlicher Aufträge oberhalb bestimmter Schwellenwerte in allen EU-Mitgliedstaaten. Ziel ist ein europaweit einheitlicher Wettbewerb und die Öffnung des Binnenmarktes für Unternehmen aus allen Mitgliedstaaten.

## EU-Schwellenwerte (2026–2027)

| Auftragsart | Schwellenwert (netto) |
|------------|----------------------|
| Bauaufträge klassischer öffentlicher Auftraggeber | 5.404.000 € |
| Liefer- und Dienstleistungen zentraler Regierungsbehörden im Sinne von § 106 Absatz 2 Nummer 1 GWB | 140.000 € |
| Liefer- und Dienstleistungen anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU | 216.000 € |
| Sektorenaufträge (Liefer- und Dienstleistungen) | 432.000 € |
| Soziale und andere besondere Dienstleistungen (klassische Auftraggeber) | 750.000 € |
| Konzessionen | 5.404.000 € |
| Liefer- und Dienstleistungen im Verteidigungs- und Sicherheitsbereich | 432.000 € |
| Bauaufträge im Verteidigungs- und Sicherheitsbereich | 5.404.000 € |
| Soziale und andere besondere Dienstleistungen von Sektorenauftraggebern | 1.000.000 € |

Die Beträge gelten ab dem 1. Januar 2026 für 2026/2027 und beziehen sich auf Deutschland; entscheidend sind stets Auftraggeber, Auftragsart und der passende Anwendungsbereich. Oberhalb des einschlägigen Schwellenwerts gelten das GWB und die jeweils anwendbaren EU-Vergaberegeln, unterhalb die nationalen Regeln.

## Vergabeplattformen in der EU

### TED (Tenders Electronic Daily)

TED ist die offizielle Plattform der EU für unionsrechtlich vorgeschriebene Vergabebekanntmachungen. Bekanntmachungspflichtige Vergaben im EU-Oberschwellenbereich werden dort grundsätzlich veröffentlicht; Ausnahmen und besondere Regelwerke sind anhand des konkreten Verfahrens zu prüfen.

**TED bietet:**
- Volltextsuche nach Aufträgen
- Filter nach Land, CPV-Code, Auftragsart
- E-Mail-Benachrichtigungen
- Statistiken und Analysen

### Nationale Portale

Jedes EU-Land hat eigene Vergabeplattformen:

| Land | Plattform |
|------|----------|
| Deutschland | DTVP, evergabe, TED-DE |
| Österreich | Unternehmensserviceportal |
| Schweiz | Simap |
| Frankreich | BOAMP |
| Niederlande | TenderNed |

## Vergabeverfahren in der EU

### Standardverfahren

Die EU kennt dieselben Verfahrenstypen wie Deutschland:
- Offenes Verfahren
- Nichtoffenes Verfahren
- Verhandlungsverfahren
- Wettbewerblicher Dialog
- Innovationspartnerschaft

### Besondere Verfahren

**Dynamisches Beschaffungssystem (DBS):**
- Elektronisches Verfahren für häufige Beschaffungen
- Jedes qualifizierte Unternehmen kann teilnehmen
- Laufend geöffnet für neue Teilnehmer

**Elektronische Auktion:**
- Preis oder andere quantifizierbare Kriterien werden online versteigert
- Nach vorheriger Qualitätsprüfung der Angebote

## Rechtsschutz in der EU

### EU-Rechtsschutzrichtlinie

Die EU-Rechtsschutzrichtlinie (2007/66/EG) gewährt Unternehmen effektiven Rechtsschutz bei Vergabeverstößen. Sie gilt in allen EU-Mitgliedstaaten.

**Wesentliche Regelungen:**
- Mindeststandards für Nachprüfungsverfahren
- Einstweiliger Rechtsschutz
- Schadensersatz bei rechtswidrigen Vergaben
- Stillhaltefristen vor Zuschlagserteilung

### Nationale Umsetzung

In Deutschland wird die Richtlinie durch das GWB umgesetzt. Die Vergabekammern und Oberlandesgerichte sind zuständig.

## Tipps für Unternehmen

### EU-weit Ausschreibungen finden

1. **TED nutzen**: Täglich neue Ausschreibungen aus allen EU-Ländern
2. **CPV-Codes lernen**: Common Procurement Vocabulary für präzise Suche
3. **Tenderhunter verwenden**: KI-gestützte Suche mit deutschen Filtern
4. **Lokale Partner suchen**: Joint Ventures für ausländische Märkte

### Angebotstellung für EU-Aufträge

- **Sprachkenntnisse**: Angebot in Landessprache oder Englisch
- **Lokale Anforderungen**: Zertifizierungen und Normen des Ziellandes
- **Referenzen**: Internationale Projekte hervorheben
- **Preisgestaltung**: Währungsrisiken und Transportkosten kalkulieren

### Häufige Herausforderungen

- Unterschiedliche Vergabekulturen in den EU-Ländern
- Sprachbarrieren bei Vergabeunterlagen
- Lokale Zertifizierungspflichten
- Unterschiedliche Rechtsschutzmöglichkeiten

## EU-Förderprogramme

Die EU fördert grenzüberschreitende Projekte durch verschiedene Programme:
- **Horizont Europa**: Forschung und Innovation
- **CEF**: Verkehrsinfrastruktur
- **EFRE**: Regionalentwicklung
- **ESF+**: Soziale Projekte

Unternehmen, die EU-Fördermittel beantragen, müssen die EU-Vergaberegeln einhalten.

## Fazit

Die EU-Vergabe bietet deutschen Unternehmen große Chancen. Wer die EU-Schwellenwerte kennt, TED regelmäßig nutzt und die lokalen Anforderungen der Zielländer beachtet, kann erfolgreich europaweit Aufträge gewinnen. Wichtig ist die frühzeitige Vorbereitung und der Aufbau lokaler Partnerschaften.
`,
  },
  "vergabeportal-vergleich": {
    slug: "vergabeportal-vergleich",
    title: "Vergabeportal Vergleich – Welches Portal ist das richtige?",
    description:
      "Vergabeportal Vergleich: DTVP, evergabe, TED und Bauportal im direkten Vergleich. Funktionen, Kosten, Vor- und Nachteile für Unternehmen bei der Ausschreibungssuche.",
    datePublished: "2025-03-01",
    dateModified: "2025-03-01",
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Facility Management"],
     relatedArticles: ["oeffentliche-auftraege-finden", "vergabeverfahren-uebersicht", "vergaberecht-leitfaden"],
     relatedGlossaryTerms: ["e-vergabe", "vergabeunterlagen", "ted", "eforms"],
    content: `
## Warum einen Vergabeportal-Vergleich?

Die Wahl des richtigen Vergabeportals ist entscheidend für den Erfolg bei öffentlichen Ausschreibungen. Jedes Portal hat Stärken und Schwächen. Dieser Vergleich hilft Unternehmen, das passende Portal für ihre Bedürfnisse zu finden.

## Die wichtigsten Vergabeportale

### DTVP (Deutsches Vergabeportal)

**Beschreibung:** Das DTVP ist das führende deutsche Vergabeportal und wird von der Bundesregierung betrieben. Es ist die zentrale Plattform für nationale Ausschreibungen.

**Funktionen:**
- Volltextsuche nach Ausschreibungen
- Filter nach Kategorie, Region, Auftraggeber
- E-Mail-Benachrichtigungen
- Elektronische Angebotstellung
- Vergabeunterlagen downloaden

**Kosten:**
- Suche: Kostenlos
- Angebotstellung: Teilweise gebührenpflichtig
- Premium-Funktionen: Abonnement möglich

**Vorteile:**
- Sehr große Datenbank
- Offizielle Plattform der Bundesregierung
- Zuverlässige und aktuelle Daten
- Gute Suchfunktionen

**Nachteile:**
- Teilweise unübersichtlich
- Nicht alle Auftraggeber nutzen DTVP
- Angebotstellung komplex

### evergabe

**Beschreibung:** evergabe ist eine Online-Vergabeplattform, die von vielen deutschen Auftraggebern genutzt wird. Sie bietet ein einheitliches Verfahren für die Angebotstellung.

**Funktionen:**
- Elektronische Angebotstellung
- Vergabeunterlagen einsehen
- Kommunikation mit Auftraggebern
- Bewertungssystem für Bieter

**Kosten:**
- Registrierung: Kostenlos
- Angebotstellung: Teilweise gebührenpflichtig
- Premium-Funktionen: Abo-Modelle

**Vorteile:**
- Einheitliches Verfahren
- Viele Auftraggeber
- Gute Benutzeroberfläche
- Elektronische Angebotstellung

**Nachteile:**
- Nicht alle Auftraggeber nutzen evergabe
- Teilweise hohe Gebühren
- Begrenzte Suchfunktionen

### TED (Tenders Electronic Daily)

**Beschreibung:** TED ist die offizielle Plattform der EU für unionsrechtlich vorgeschriebene Vergabebekanntmachungen; bekanntmachungspflichtige Verfahren im EU-Oberschwellenbereich werden dort grundsätzlich veröffentlicht.

**Funktionen:**
- Suche nach EU-weiten Ausschreibungen
- Filter nach Land, CPV-Code, Auftragsart
- E-Mail-Benachrichtigungen
- Statistiken und Analysen

**Kosten:**
- Suche: Kostenlos
- Angebotstellung: Kostenlos (aber komplex)

**Vorteile:**
- EU-weite Abdeckung
- Offizielle EU-Plattform
- Sehr große Datenbank
- Detaillierte Filtermöglichkeiten

**Nachteile:**
- Komplexe Benutzeroberfläche
- Viele Ergebnisse erfordern Filterung
- Angebotstellung oft komplex
- Sprachbarrieren

### Bauportal Deutschland

**Beschreibung:** Das Bauportal Deutschland ist spezialisiert auf Bauausschreibungen und wird von der Deutschen Bauindustrie betrieben.

**Funktionen:**
- Spezialisiert auf Bauausschreibungen
- Regionale Filtermöglichkeiten
- E-Mail-Benachrichtigungen
- Fachinformationen zur Bauindustrie

**Kosten:**
- Suche: Kostenlos
- Premium-Funktionen: Abonnement

**Vorteile:**
- Spezialisierung auf Baubranche
- Regionale Abdeckung
- Fachinformationen
- Gute Suchfunktionen

**Nachteile:**
- Nur Bauausschreibungen
- Begrenzte Datenbank
- Weniger Funktionen als DTVP

## Direkter Vergleich

| Kriterium | DTVP | evergabe | TED | Bauportal |
|-----------|------|----------|-----|-----------|
| Abdeckung | Deutschland | Deutschland | EU | Deutschland |
| Spezialisierung | Alle Branchen | Alle Branchen | Alle Branchen | Bau |
| Suchfunktionen | Gut | Mittel | Gut | Gut |
| Angebotstellung | Komplex | Einfach | Komplex | Einfach |
| Kosten | Teilweise | Teilweise | Kostenlos | Teilweise |
| Benutzerfreundlichkeit | Mittel | Gut | Schlecht | Gut |

## Welches Portal für welches Unternehmen?

### Kleine und mittlere Unternehmen (KMU)

**Empfehlung:** DTVP + evergabe

- DTVP für die Suche nach Ausschreibungen
- evergabe für die Angebotstellung
- Kostenlose Registrierung bei beiden Portalen

### Bauunternehmen

**Empfehlung:** DTVP + Bauportal Deutschland

- DTVP für allgemeine Ausschreibungen
- Bauportal für spezialisierte Bauaufträge
- Regionale Filter nutzen

### IT-Dienstleister

**Empfehlung:** DTVP + TED

- DTVP für nationale IT-Aufträge
- TED für EU-weite IT-Projekte
- CPV-Code 72000000 (IT-Dienstleistungen) nutzen

### Exportorientierte Unternehmen

**Empfehlung:** TED + nationale Portale der Zielländer

- TED für EU-weite Aufträge
- Nationale Portale für spezifische Märkte
- Lokale Partner für Angebotstellung

## Tipps für die Portal-Nutzung

### Suchstrategie

1. **Relevante CPV-Codes definieren**: Für die eigene Branche
2. **Regionale Filter setzen**: Aufträge im eigenen Aktionsradius
3. **Benachrichtigungen einrichten**: Tägliche Updates
4. **Suchbegriffe optimieren**: Synonyme und Oberbegriffe nutzen

### Angebotstellung

1. **Vergabeunterlagen vollständig lesen**: Vor der Angebotstellung
2. **Fristen im Auge behalten**: Angebot rechtzeitig einreichen
3. **Formalien beachten**: Format, Unterschrift, Anlagen
4. **Kommunikation nutzen**: Fragen an den Auftraggeber stellen

### Erfolgsfaktoren

- **Regelmäßige Nutzung**: Tägliche Suche nach neuen Ausschreibungen
- **Schnelle Reaktion**: Angebotstellung zügig beginnen
- **Qualität vor Quantität**: Nur passende Aufträge bearbeiten
- **Netzwerk aufbauen**: Mit anderen Bietern und Auftraggebern

## Tenderhunter: Die intelligente Alternative

Tenderhunter bietet eine KI-gestützte Alternative zu herkömmlichen Vergabeportalen:

**Vorteile von Tenderhunter:**
- Automatische Kategorisierung von Ausschreibungen
- Relevante Aufträge werden automatisch erkannt
- Keine manuelle Suche notwendig
- Echtzeit-Benachrichtigungen
- Intelligente Filterung

**Für wen ist Tenderhunter geeignet?**
- Unternehmen, die Zeit bei der Ausschreibungssuche sparen wollen
- Firmen, die ihre Erfolgsquote erhöhen möchten
- Bieter, die keine relevanten Ausschreibungen verpassen wollen

## Fazit

Die Wahl des richtigen Vergabeportals hängt von der Branche, der Unternehmensgröße und den Zielmärkten ab. Für die meisten deutschen Unternehmen empfiehlt sich die Kombination aus DTVP für die Suche und evergabe für die Angebotstellung. Wer EU-weit tätig ist, sollte zusätzlich TED nutzen. Tenderhunter bietet als KI-gestützte Alternative eine intelligente Ergänzung zu den klassischen Portalen.
`,
  },
};

export const ALL_ARTICLE_SLUGS = Object.keys(ARTICLES);
