// SEO: Vergabelexikon — focused glossary entries targeting long-tail queries
// Competitor vergabe24.de has 100+ entries; this is our foundation set.
// Categories: Rechtsgrundlagen, Verfahren, Prozess, Eignung, Nachprüfung, Technik, Akteure

export interface GlossaryEntry {
  slug: string;
  term: string;
  category: "Rechtsgrundlagen" | "Verfahren" | "Vergabeprozess" | "Eignung & Zuschlag" | "Schwellenwerte" | "Nachprüfung" | "Technik & Standards" | "Akteure" | "Sonderbereiche";
  shortDefinition: string;
  definition: string[];
  keyPoints: string[];
  faq: Array<{ question: string; answer: string }>;
  relatedTerms?: string[];
  relatedCategories?: string[];
  relatedArticles?: string[];
  sources?: ContentSource[];
  lastReviewed?: string;
}

export interface ContentSource {
  title: string;
  url: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  // === RECHTSGRUNDLAGEN ===
  {
    slug: "gwb-vergaberecht",
    term: "GWB (Gesetz gegen Wettbewerbsbeschränkungen)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Das GWB ist das zentrale Wettbewerbsgesetz Deutschlands. Teil 4 enthält die zentralen Regeln für öffentliche Aufträge und Konzessionen im dort geregelten Anwendungsbereich.",
    definition: [
      "Das Gesetz gegen Wettbewerbsbeschränkungen (GWB) ist die rechtliche Grundlage für die öffentliche Auftragsvergabe in Deutschland. Sein vierter Teil enthält die zentralen vergaberechtlichen Vorschriften, die für öffentliche Auftraggeber im jeweiligen Anwendungsbereich bindend sind.",
      "Das GWB regelt unter anderem die Anwendungsbereiche des Vergaberechts, die vergabeverfahrensrechtlichen Prinzipien (Transparenz, Wettbewerb, Gleichbehandlung), die Schwellenwerte und das Nachprüfungsverfahren. Es implementiert die europäischen Vergaberichtlinien in nationales Recht.",
      "Teil 4 GWB greift grundsätzlich bei öffentlichen Aufträgen und Konzessionen ab dem jeweils einschlägigen EU-Schwellenwert. Für Unterschwellenvergaben gelten je nach Auftraggeber, Leistungsart und Einführung UVgO, VOB/A oder landesspezifische und haushaltsrechtliche Vorschriften.",
    ],
    keyPoints: [
      "Teil 4 GWB = Kern des deutschen Vergaberechts",
      "Teil 4 gilt im jeweils einschlägigen EU-Oberschwellenbereich",
      "Regelt Transparenz-, Wettbewerbs- und Gleichbehandlungsprinzip",
      "Grundlage für das Nachprüfungsverfahren vor Vergabekammern",
    ],
    faq: [
      {
        question: "Was regelt das GWB im Vergaberecht?",
        answer: "Das GWB regelt in seinem vierten Teil die öffentliche Auftragsvergabe in Deutschland. Es definiert Grundprinzipien wie Transparenz, Wettbewerb und Gleichbehandlung, regelt den Anwendungsbereich über Schwellenwerte und ermöglicht unter den gesetzlichen Voraussetzungen die Nachprüfung durch Vergabekammern.",
      },
      {
        question: "Für welche Aufträge gilt Teil 4 GWB?",
        answer: "Teil 4 GWB gilt grundsätzlich für öffentliche Aufträge und Konzessionen, deren geschätzter Wert den jeweils einschlägigen EU-Schwellenwert erreicht oder überschreitet und die in seinen Anwendungsbereich fallen. Auftraggeber, Leistungsart und Sonderregelungen müssen dabei geprüft werden.",
      },
      {
        question: "Wo finde ich den vollständigen Text des GWB?",
        answer: "Den vollständigen Text des GWB finden Sie auf gesetze-im-internet.de unter der offiziellen Veröffentlichung des Bundesministeriums der Justiz. Für die Einordnung sind insbesondere die Vorschriften des vierten Teils und die jeweils aktuelle Fassung maßgeblich.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "uvgo", "vob-a", "vob-a-eu", "schwellenwerte", "nachpruefungsverfahren"],
    relatedArticles: ["vergaberecht-leitfaden", "schwellenwerte-vergabe", "vob-vergabe"],
    sources: [
      { title: "§ 97 GWB – Grundsätze der Vergabe", url: "https://www.gesetze-im-internet.de/gwb/__97.html" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "§ 160 GWB – Einleitung, Antrag", url: "https://www.gesetze-im-internet.de/gwb/__160.html" },
    ],
    lastReviewed: "2026-09-13",
  },
  {
    slug: "vgv-vergabeverordnung",
    term: "VgV (Vergabeverordnung)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VgV regelt vor allem die Vergabe öffentlicher Liefer- und Dienstleistungsaufträge oberhalb der EU-Schwellenwerte und enthält Sonderregeln für bestimmte Bau- und Planungsaufträge.",
    definition: [
      "Die Vergabeverordnung (VgV) ist die zentrale Rechtsverordnung für die Vergabe öffentlicher Liefer- und Dienstleistungsaufträge oberhalb der EU-Schwellenwerte. Sie konkretisiert die Vorgaben des vierten Teils des GWB und setzt die europäischen Vergaberichtlinien in deutsches Recht um.",
      "Die VgV regelt detailliert die Durchführung der verschiedenen Vergabeverfahren (offenes Verfahren, beschränktes Verfahren, Verhandlungsverfahren, wettbewerblicher Dialog, Innovationspartnerschaft), die Anforderungen an die Auftragsbekanntmachung, die Fristen und die Eignungsprüfung.",
      "Bei Bauaufträgen ist § 2 VgV maßgeblich: Für sie gelten Abschnitt 1 und Abschnitt 2 Unterabschnitt 2 der VgV; im Übrigen ist VOB/A Teil A Abschnitt 2 anzuwenden. Für als Los eines Bauauftrags vergebene Planungsleistungen gilt die VgV.",
    ],
    keyPoints: [
      "Gilt vor allem für Liefer- und Dienstleistungsaufträge oberhalb der EU-Schwellenwerte",
      "Regelt 5 Vergabeverfahren: Offen, Beschränkt, Verhandelt, Dialog, Innovation",
      "Enthält detaillierte Vorgaben zu Bekanntmachung, Fristen und Eignungsprüfung",
      "Bei Bauaufträgen gilt die besondere Zuordnung nach § 2 VgV",
    ],
    faq: [
      {
        question: "Was ist die VgV?",
        answer: "Die VgV (Vergabeverordnung) regelt die Vergabe öffentlicher Liefer- und Dienstleistungsaufträge oberhalb der EU-Schwellenwerte in Deutschland. Sie konkretisiert das GWB und setzt die EU-Vergaberichtlinien um.",
      },
      {
        question: "Was ist der Unterschied zwischen VgV und UVgO?",
        answer: "Die VgV gilt grundsätzlich für Liefer- und Dienstleistungen oberhalb der EU-Schwellenwerte, die UVgO grundsätzlich für Liefer- und Dienstleistungen darunter. Bei Bauaufträgen bestimmt § 2 VgV, welche VgV-Regeln neben VOB/A Abschnitt 2 gelten.",
      },
      {
        question: "Wo gilt die VgV nicht?",
        answer: "Für Sektorenauftraggeber und Konzessionen gelten regelmäßig besondere Regelwerke. Bei Bauaufträgen gilt nicht pauschal ein vollständiger Ausschluss der VgV: § 2 VgV ordnet die Anwendung bestimmter VgV-Teile an und verweist im Übrigen auf VOB/A Abschnitt 2.",
      },
    ],
    relatedTerms: ["uvgo", "vob-a", "vob-a-eu", "gwb-vergaberecht", "sektvo", "konzvgv"],
    relatedCategories: ["Planungsleistungen", "IT-Dienstleistungen", "Lieferung"],
    sources: [
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "VgV – vollständige amtliche Fassung", url: "https://www.gesetze-im-internet.de/vgv_2016/" },
    ],
    lastReviewed: "2026-09-17",
  },
  {
    slug: "uvgo",
    term: "UVgO (Unterschwellenvergabeordnung)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die UVgO regelt die Vergabe öffentlicher Liefer- und Dienstleistungsaufträge unterhalb der EU-Schwellenwerte. Sie löste 2017 die VOL/A ab.",
    definition: [
      "Die Unterschwellenvergabeordnung (UVgO) ist eine zentrale Vergabevorschrift für öffentliche Auftraggeber bei Liefer- und Dienstleistungsaufträgen unterhalb der EU-Schwellenwerte. Sie löste den Teil A der VOL in diesem Bereich ab; verbindlich wird sie durch die jeweilige haushalts- oder landesrechtliche Einführung.",
      "Die UVgO zielt darauf ab, den Wettbewerb bei Unterschwellenvergaben zu stärken, den Mittelstand zu fördern und die Bürokratie zu reduzieren. Sie ermöglicht flexiblere Verfahren und kürzere Fristen als die VgV, wahrt aber die Grundprinzipien von Transparenz, Wettbewerb und Gleichbehandlung.",
      "Ein Instrument der UVgO ist die freiwillige Vergabebekanntmachung, die Auftraggebern eine zusätzliche Veröffentlichung auch unterhalb der Schwellenwerte ermöglicht.",
    ],
    keyPoints: [
      "Gilt für Liefer- und Dienstleistungen unter EU-Schwellenwerten",
      "Löste 2017 die VOL/A in diesem Bereich ab",
      "Ermöglicht flexiblere Verfahren und kürzere Fristen",
      "Fördert den Mittelstand und regionalen Wettbewerb",
    ],
    faq: [
      {
        question: "Was ist die UVgO?",
        answer: "Die UVgO (Unterschwellenvergabeordnung) regelt die Vergabe öffentlicher Liefer- und Dienstleistungsaufträge unterhalb der EU-Schwellenwerte, soweit sie im jeweiligen Geltungsbereich eingeführt ist. Sie löste 2017 die VOL/A ab.",
      },
      {
        question: "Ab welchem Betrag gilt die UVgO?",
        answer: "Die UVgO betrifft grundsätzlich Liefer- und Dienstleistungen unterhalb der EU-Schwellenwerte. Die konkrete Verbindlichkeit und mögliche landesrechtliche Besonderheiten richten sich nach der Einführung im jeweiligen Geltungsbereich; für Bauleistungen ist grundsätzlich die VOB/A einschlägig.",
      },
      {
        question: "Gilt die UVgO auch für Bauleistungen?",
        answer: "Die UVgO ist grundsätzlich keine allgemeine Bauvergabeordnung. Für Bauleistungen im nationalen Bereich ist grundsätzlich VOB/A Abschnitt 1 einschlägig; die konkrete Anwendung richtet sich zusätzlich nach dem maßgeblichen Landes- und Haushaltsrecht.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "vob-a", "vol-a"],
    relatedCategories: ["IT-Dienstleistungen", "Lieferung", "Planungsleistungen"],
  },
  {
    slug: "vob-a",
    term: "VOB/A (Vergabe- und Vertragsordnung für Bauleistungen, Teil A)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VOB/A enthält die Vergaberegeln für öffentliche Bauaufträge: Abschnitt 1 für den nationalen Bereich, Abschnitt 2 für den EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Vergaben.",
    definition: [
      "Die Vergabe- und Vertragsordnung für Bauleistungen, Teil A (VOB/A, auch „VOB A“ geschrieben) regelt den vergaberechtlichen Teil öffentlicher Bauaufträge. Sie unterscheidet zwischen Abschnitt 1 für den nationalen Unterschwellenbereich, Abschnitt 2 für den EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Aufträge.",
      "Bei Bauaufträgen oberhalb der EU-Schwellenwerte ist die VOB/A Abschnitt 2 nicht isoliert zu lesen. Nach § 2 VgV sind Abschnitt 1 und Abschnitt 2 Unterabschnitt 2 der VgV anzuwenden; im Übrigen gilt VOB/A Teil A Abschnitt 2. Planungsleistungen, die als Los eines Bauauftrags vergeben werden, unterliegen nach § 2 VgV der VgV.",
      "Die VOB/A betrifft das Vergabeverfahren, etwa Leistungsbeschreibung, Eignung, Angebote und Zuschlag. Die VOB/B regelt dagegen Vertragsbedingungen für die Ausführung, die VOB/C technische Vertragsbedingungen und Abrechnungsgrundlagen.",
    ],
    keyPoints: [
      "Abschnitt 1 = nationale Vergabe von Bauleistungen",
      "Abschnitt 2 = EU-Oberschwellenbereich bei Bauaufträgen",
      "Abschnitt 3 = verteidigungs- und sicherheitsspezifische Vergaben",
      "Regelt das Verfahren, nicht die späteren Bauvertragsbedingungen",
    ],
    faq: [
      {
        question: "Was ist die VOB/A?",
        answer: "Die VOB/A (Vergabe- und Vertragsordnung für Bauleistungen, Teil A) regelt die Vergabe öffentlicher Bauaufträge. Sie besteht aus Abschnitt 1 für nationale Vergaben, Abschnitt 2 für den EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Vergaben.",
      },
      {
        question: "Wann gilt VOB/A und wann UVgO?",
        answer: "Die VOB/A gilt für Bauleistungen. Die UVgO betrifft grundsätzlich Liefer- und Dienstleistungen unterhalb der EU-Schwellenwerte. Bei Bauaufträgen im EU-Oberschwellenbereich sind neben VOB/A Abschnitt 2 die in § 2 VgV genannten Teile der VgV zu beachten.",
      },
      {
        question: "Was ist der Unterschied zwischen VOB/A und VgV?",
        answer: "Die VOB/A regelt die Vergabe von Bauleistungen. Die VgV regelt grundsätzlich Liefer- und Dienstleistungen oberhalb der EU-Schwellenwerte; § 2 VgV bestimmt aber auch ihre Anwendung bei Bauaufträgen und bei bestimmten Planungsleistungen. Deshalb ist keine pauschale Entweder-oder-Aussage richtig.",
      },
    ],
    relatedTerms: ["vob-b", "vob-c", "vob-a-eu", "schwellenwerte", "auftragswert", "leistungsbeschreibung", "leistungsverzeichnis", "losvergabe", "vgv-vergabeverordnung", "gwb-vergaberecht", "eignungsleihe", "nachforderung-unterlagen", "praequalifikation-pq-vob"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe", "schwellenwerte-vergabe"],
    sources: [
        { title: "Bundesanzeiger: VOB/A-Änderung vom 22. Juli 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
       { title: "VOB/A, Bekanntmachung vom 31. Januar 2019 (BAnz AT 19.02.2019 B2)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
    ],
    lastReviewed: "2026-09-29",
  },
  {
    slug: "vob-b",
    term: "VOB/B (Allgemeine Vertragsbedingungen für die Ausführung von Bauleistungen)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VOB/B enthält allgemeine Vertragsbedingungen für die Ausführung von Bauleistungen. Sie ist keine Vergabeordnung, sondern wird als Vertragsbestandteil vereinbart.",
    definition: [
      "Die VOB/B regelt das Verhältnis zwischen Auftraggeber und Auftragnehmer nach Abschluss eines Bauvertrags. Sie behandelt unter anderem Ausführung, Anordnungen, Abnahme, Vergütung, Änderungen und Nachträge, Mängel, Kündigung, Fristen und Zahlungen.",
      "Die VOB/B gilt nicht automatisch allein deshalb, weil ein öffentlicher Bauauftrag vorliegt. Sie wird Bestandteil des Vertrags, wenn sie wirksam vereinbart und in den Vergabeunterlagen einbezogen wird. Maßgeblich sind außerdem die konkrete Vertragsgestaltung und zwingendes Gesetzesrecht.",
      "Für Bieter ist die VOB/B wichtig, weil ihre Regelungen bereits bei der Kalkulation berücksichtigt werden müssen. Änderungen, Abnahmen, Mängelansprüche und Zahlungsbedingungen können erhebliche Auswirkungen auf Preis und Ausführungsrisiko haben.",
    ],
    keyPoints: ["Vertragsbedingungen für die Bauausführung", "Nicht mit VOB/A als Vergabeverfahrensordnung verwechseln", "Regelt unter anderem Abnahme, Vergütung, Änderungen, Mängel und Kündigung", "Einbeziehung in den Bauvertrag muss aus den Vergabeunterlagen hervorgehen"],
    faq: [
      { question: "Was ist der Unterschied zwischen VOB/A und VOB/B?", answer: "VOB/A regelt das Vergabeverfahren für Bauleistungen. VOB/B enthält Vertragsbedingungen für die Ausführung eines Bauvertrags nach dem Zuschlag." },
      { question: "Gilt die VOB/B automatisch bei öffentlichen Bauaufträgen?", answer: "Nein. Die VOB/B muss grundsätzlich als Vertragsbestandteil vereinbart und in den Vergabeunterlagen eindeutig einbezogen werden." },
      { question: "Welche Themen regelt die VOB/B?", answer: "Die VOB/B betrifft unter anderem Ausführung und Fristen, Abnahme, Vergütung, Änderungen und Nachträge, Mängel sowie Kündigung. Entscheidend bleiben die wirksame Einbeziehung und der konkrete Vertrag." },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "vob-c", "nachunternehmer", "leistungsbeschreibung", "leistungsverzeichnis"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [
      { title: "VOB/A, Abschnitt 1, § 8a (Einbeziehung von VOB/B und VOB/C)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
    ],
    lastReviewed: "2026-09-17",
  },
  {
    slug: "vob-c",
    term: "VOB/C (Allgemeine Technische Vertragsbedingungen für Bauleistungen)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VOB/C bündelt Allgemeine Technische Vertragsbedingungen und ATV für Bauleistungen. Sie konkretisiert technische Anforderungen, Ausführung und Abrechnung.",
    definition: [
      "Die VOB/C besteht aus Allgemeinen Technischen Vertragsbedingungen (ATV), die für verschiedene Gewerke technische Anforderungen beschreiben. Sie unterstützt eine eindeutige Leistungsbeschreibung und legt Regeln für Ausführung, Nebenleistungen, besondere Leistungen und Abrechnung fest.",
      "Im Vergabeverfahren hilft die VOB/C dabei, die geschuldete Bauleistung technisch eindeutig zu beschreiben. Im Bauvertrag kann sie als technische Vertragsbedingung einbezogen werden; die konkrete Ausschreibung und die vereinbarten Vertragsunterlagen bleiben entscheidend.",
      "VOB/C ist von VOB/A abzugrenzen: VOB/A betrifft die Auswahl und Beauftragung, VOB/C die technischen Vertragsbedingungen. VOB/B regelt die allgemeinen rechtlichen Vertragsbedingungen der Ausführung.",
    ],
    keyPoints: ["ATV und technische Vertragsbedingungen für Bauleistungen", "Hilft bei Leistungsbeschreibung, Ausführung und Abrechnung", "VOB/A = Vergabeverfahren, VOB/B = Vertragsbedingungen, VOB/C = Technik", "Gewerkespezifische ATV müssen passend zu den ausgeschriebenen Leistungen herangezogen werden"],
    faq: [
      { question: "Was regelt die VOB/C?", answer: "Die VOB/C regelt technische Anforderungen und Abrechnungsgrundlagen für unterschiedliche Bauleistungen, insbesondere über die jeweiligen ATV." },
      { question: "Was ist der Unterschied zwischen VOB/B und VOB/C?", answer: "VOB/B enthält allgemeine rechtliche Vertragsbedingungen für die Bauausführung. VOB/C enthält technische, gewerkespezifische Vertragsbedingungen." },
      { question: "Ist die VOB/C eine Vergabeordnung?", answer: "Nein. Die VOB/C beschreibt technische Vertragsbedingungen und ATV. Das Vergabeverfahren steht in VOB/A; allgemeine Ausführungsbedingungen enthält VOB/B." },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "vob-b", "leistungsbeschreibung", "leistungsverzeichnis"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [
      { title: "VOB/A, Abschnitt 1, § 8a (Einbeziehung von VOB/B und VOB/C)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
    ],
    lastReviewed: "2026-09-17",
  },
  {
    slug: "vob-a-eu",
    term: "VOB/A EU (VOB/A Abschnitt 2)",
    category: "Rechtsgrundlagen",
    shortDefinition: "VOB/A EU bezeichnet Abschnitt 2 der VOB/A für Bauaufträge im EU-Oberschwellenbereich. Sie gilt zusammen mit den nach § 2 VgV anwendbaren Vorschriften und dem GWB.",
    definition: [
      "VOB/A EU (auch VOB/A-EU geschrieben) ist die gebräuchliche Bezeichnung für VOB/A Abschnitt 2. Dieser Abschnitt enthält die besonderen Vergaberegeln für öffentliche Bauaufträge oberhalb des einschlägigen EU-Schwellenwerts, darunter Vorgaben zu Bekanntmachung, Verfahren, Fristen, Eignung, Angeboten und Zuschlag.",
      "Neben „VOB/A EU“ sind „VOB A EU“ und „VOB/A-EU“ gebräuchliche Schreibweisen; gelegentlich finden sich auch die umgestellten Formen „EU VOB/A“ und „EU-VOB/A“ sowie „VOB Teil A EU“.",
      "Die Einordnung beginnt mit dem geschätzten Auftragswert ohne Umsatzsteuer und dem konkreten Auftraggeber- und Leistungsbereich. Für Bauaufträge ordnet § 2 VgV an, dass Abschnitt 1 und Abschnitt 2 Unterabschnitt 2 der VgV sowie im Übrigen VOB/A Teil A Abschnitt 2 anzuwenden sind. Planungsleistungen, die als Los eines Bauauftrags vergeben werden, unterliegen nach § 2 VgV der VgV.",
      "Für Bauaufträge klassischer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU beträgt der EU-Schwellenwert 2026 und 2027 5.404.000 Euro netto. Dieser Wert ist nicht pauschal auf jede Bauvergabe übertragbar: Auftraggeber, Auftragsart und mögliche Sonderregelungen müssen mitgeprüft werden.",
      "VOB/A EU ist daher weder eine eigene vierte VOB noch ein vollständiger Ersatz für GWB und VgV. Abschnitt 1 der VOB/A bleibt der nationale Bereich; Abschnitt 3 betrifft verteidigungs- und sicherheitsspezifische Vergaben.",
    ],
    keyPoints: ["VOB/A EU = VOB/A Abschnitt 2", "Für Bauaufträge im EU-Oberschwellenbereich", "Für klassische öffentliche Auftraggeber nach Richtlinie 2014/24/EU: 5.404.000 Euro netto in 2026/2027", "GWB und die nach § 2 VgV anwendbaren VgV-Regeln sind mitzudenken", "Nicht mit VOB/A Abschnitt 1 oder Abschnitt 3 gleichsetzen"],
    faq: [
      { question: "Ab wann gilt VOB/A EU?", answer: "VOB/A EU kommt bei Bauaufträgen im EU-Oberschwellenbereich zur Anwendung, wenn der geschätzte Auftragswert ohne Umsatzsteuer den einschlägigen EU-Schwellenwert erreicht oder überschreitet und keine Sonderregel greift." },
      { question: "Ist VOB/A EU dasselbe wie VgV?", answer: "Nein. VOB/A EU ist Abschnitt 2 der VOB/A. Bei Bauaufträgen gelten daneben die in § 2 VgV genannten VgV-Vorschriften sowie der vierte Teil des GWB." },
      { question: "Welcher EU-Schwellenwert gilt für Bauaufträge?", answer: "Für Bauaufträge klassischer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU liegt der Schwellenwert 2026 und 2027 bei 5.404.000 Euro netto. Das ist kein pauschaler Wert für jede Bauvergabe: Auftraggeber, Auftragsart, die Berechnung des geschätzten Auftragswerts und mögliche Sonderregeln müssen geprüft werden." },
    ],
    relatedTerms: ["vob-a", "vob-b", "vob-c", "schwellenwerte", "auftragswert", "losvergabe", "vgv-vergabeverordnung", "gwb-vergaberecht", "offenes-verfahren", "beschraenktes-verfahren", "nachforderung-unterlagen", "praequalifikation-pq-vob"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe", "schwellenwerte-vergabe"],
    sources: [
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "Bundesanzeiger: VOB/A-Änderung vom 22. Juli 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
      { title: "VOB/A, Abschnitt 2, Bekanntmachung vom 31. Januar 2019", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "Delegierte Verordnung (EU) 2025/2152 – Schwellenwerte 2026/2027", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2152" },
    ],
    lastReviewed: "2026-10-18",
  },
  {
    slug: "vol-a",
    term: "VOL/A (Verordnung für Leistungen)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VOL/A war bis 2017 die Vergabevorschrift für Liefer- und Dienstleistungen. Sie wurde im Unterschwellenbereich durch die UVgO abgelöst.",
    definition: [
      "Die Vergabe- und Vertragsordnung für Leistungen, Teil A (VOL/A) war bis zum 30. April 2017 die zentrale Vergabevorschrift für öffentliche Liefer- und Dienstleistungsaufräge. Mit Inkrafttreten der UVgO am 1. Mai 2017 wurde die VOL/A im Unterschwellenbereich weitgehend abgelöst.",
      "Im Oberschwellenbereich wurde die VOL/A bereits 2016 durch die VgV abgelöst. Heute hat die VOL/A nur noch eine untergeordnete Bedeutung. Lediglich bei bestimmten landesrechtlichen Verordnungen und bei Altvergaben kann die VOL/A noch relevant sein.",
      "Die VOL/A kannte ähnliche Verfahren wie die heutige UVgO, unterschied aber stärker zwischen offenen und nicht offenen Verfahren und hatte längere Fristen.",
    ],
    keyPoints: [
      "Bis 2017 zentrale Vergabevorschrift für Liefer- und Dienstleistungen",
      "Im Unterschwellenbereich durch UVgO abgelöst",
      "Im Oberschwellenbereich bereits 2016 durch VgV ersetzt",
      "Heute nur noch bei Altvergaben oder landesrechtlich relevant",
    ],
    faq: [
      {
        question: "Ist die VOL/A noch gültig?",
        answer: "Die VOL/A wurde 2017 im Unterschwellenbereich durch die UVgO abgelöst. Im Oberschwellenbereich war sie bereits 2016 durch die VgV ersetzt worden. Die VOL/A ist heute nur noch in Ausnahmefällen (Altvergaben, landesrechtliche Vorschriften) relevant.",
      },
      {
        question: "Was hat die VOL/A ersetzt?",
        answer: "Die VOL/A wurde im Unterschwellenbereich durch die UVgO und im Oberschwellenbereich durch die VgV ersetzt. Beide Nachfolgeregeln sind moderner, flexibler und an die EU-Vergaberichtlinien angepasst.",
      },
    ],
    relatedTerms: ["uvgo", "vgv-vergabeverordnung"],
  },
  {
    slug: "sektvo",
    term: "SektVO (Sektorenverordnung)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die SektVO regelt die Vergabe von Sektorenauftraggebern (Energie, Wasser, Verkehr) oberhalb der EU-Schwellenwerte.",
    definition: [
      "Die Sektorenverordnung (SektVO) regelt die Vergabe öffentlicher Aufträge durch sogenannte Sektorenauftraggeber im Oberschwellenbereich. Sektorenauftraggeber sind Unternehmen, die in den Bereichen Gas, Wärme, Elektrizität, Wasser, Eisenbahndienste und Hafenanlagen tätig sind oder deren Leistungen auf besonderen Rechten beruhen.",
      "Die SektVO enthält besondere Vorschriften für diese Auftraggeber, die von den allgemeinen VgV-Regeln abweichen können. Dies liegt an der besonderen Marktsituation in den Sektorenbereichen, in denen oft nur wenige Anbieter existieren.",
      "Sektorenauftraggeber können zwischen verschiedenen Verfahren wählen und haben erweiterte Möglichkeiten zur Auftragsvergabe ohne förmliches Verfahren, wenn die Bedingungen der SektVO dies zulassen.",
    ],
    keyPoints: [
      "Gilt für Sektorenauftraggeber (Energie, Wasser, Verkehr, Hafen)",
      "Regelt Vergaben oberhalb der EU-Schwellenwerte",
      "Enthält besondere, flexiblere Vorschriften für Sektorenunternehmen",
      "Setzt die EU-Sektorenrichtlinie um",
    ],
    faq: [
      {
        question: "Was ist die SektVO?",
        answer: "Die SektVO (Sektorenverordnung) regelt die Vergabe von Aufträgen durch Sektorenauftraggeber in den Bereichen Energie, Wasser, Verkehr und Hafen oberhalb der EU-Schwellenwerte. Sie bietet diesen Auftraggebern besondere, flexible Verfahrensregeln.",
      },
      {
        question: "Wer ist ein Sektorenauftraggeber?",
        answer: "Sektorenauftraggeber sind öffentliche Unternehmen oder privatwirtschaftliche Unternehmen mit besonderen Rechten in den Bereichen Gas, Wärme, Elektrizität, Wasser, Eisenbahndienste sowie Hafen- und Flughafenbetreiber. Für sie gelten die besonderen Vorschriften der SektVO.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "konzvgv", "gwb-vergaberecht"],
  },
  {
    slug: "konzvgv",
    term: "KonzVgV (Konzessionsvergabeverordnung)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die KonzVgV regelt die Vergabe von Konzessionen durch öffentliche Auftraggeber.",
    definition: [
      "Die Konzessionsvergabeverordnung (KonzVgV) regelt die Vergabe von Konzessionen durch öffentliche Auftraggeber und Sektorenauftraggeber. Eine Konzession liegt vor, wenn der Auftragnehmer das wirtschaftliche Risiko der Leistungserbringung trägt und als Gegenleistung das Recht erhält, die Leistungen zu nutzen.",
      "Der wesentliche Unterschied zwischen einem gewöhnlichen öffentlichen Auftrag und einer Konzession besteht in der Risikoverteilung: Bei der Konzession trägt der Konzessionär das Marktrisiko und wird durch die Nutzungsrechte entlohnt, nicht durch eine direkte Zahlung des Auftraggebers.",
      "Typische Beispiele für Konzessionen sind der Betrieb von Rastanlagen, Parkhäusern oder Freizeitaktivitäten auf öffentlichem Grund.",
    ],
    keyPoints: [
      "Regelt die Vergabe von Konzessionen",
      "Konzession = Auftragnehmer trägt Marktrisiko, erhält Nutzungsrecht",
      "Andere Entlohnungsstruktur als normale öffentlichen Aufträge",
      "Typisch: Rastanlagen, Parkhäuser, Freizeitaktivitäten",
    ],
    faq: [
      {
        question: "Was ist eine Konzession im Vergaberecht?",
        answer: "Eine Konzession ist ein Vertrag, bei dem der Auftragnehmer das wirtschaftliche Risiko der Leistungserbringung trägt und dafür das Recht erhält, die erbrachten Leistungen zu nutzen (z. B. ein Parkhaus zu betreiben). Die KonzVgV regelt ihre Vergabe.",
      },
      {
        question: "Wann gilt die KonzVgV?",
        answer: "Die KonzVgV gilt für die Vergabe von Dienstleistungskonzessionen und Baukonzessionen durch öffentliche Auftraggeber und Sektorenauftraggeber oberhalb der EU-Schwellenwerte.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "sektvo"],
  },
  {
    slug: "eu-vergaberichtlinien",
    term: "EU-Vergaberichtlinien",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die EU-Vergaberichtlinien sind der rechtliche Rahmen für die öffentliche Auftragsvergabe in der Europäischen Union.",
    definition: [
      "Die EU-Vergaberichtlinien bilden den rechtlichen Rahmen für die grenzüberschreitende öffentliche Auftragsvergabe in Europa. Die wichtigsten Richtlinien sind die Richtlinie 2014/24/EU (klassische Sektoren), die Richtlinie 2014/25/EU (Sektoren) und die Richtlinie 2014/23/EU (Konzessionen).",
      "Diese Richtlinien zielen darauf ab, den Binnenmarkt für öffentliche Aufträge zu öffnen, den Wettbewerb zu stärken und diskriminierungsfreie Vergabeverfahren zu gewährleisten. Sie setzen Mindeststandards fest, die von den Mitgliedstaaten in nationales Recht umgesetzt werden müssen.",
      "In Deutschland wurden die EU-Vergaberichtlinien durch das GWB (Teil 4), die VgV, die UVgO, die SektVO und die KonzVgV umgesetzt.",
    ],
    keyPoints: [
      "Rechtlicher Rahmen für öffentliche Aufträge in der EU",
      "Wichtigste Richtlinien: 2014/24/EU, 2014/25/EU, 2014/23/EU",
      "Ziel: Binnenmarktöffnung, Wettbewerb, Nichtdiskriminierung",
      "Umsetzung in Deutschland: GWB, VgV, UVgO, SektVO, KonzVgV",
    ],
    faq: [
      {
        question: "Was sind die EU-Vergaberichtlinien?",
        answer: "Die EU-Vergaberichtlinien (insb. 2014/24/EU, 2014/25/EU, 2014/23/EU) bilden den rechtlichen Rahmen für die öffentliche Auftragsvergabe in Europa. Sie werden von den EU-Mitgliedstaaten in nationales Recht umgesetzt.",
      },
      {
        question: "Was sind EU-Schwellenwerte?",
        answer: "Die EU-Schwellenwerte sind monetäre Grenzen, ab denen der EU-Oberschwellenbereich greift. Die konkreten Werte hängen von Leistungsart und Auftraggeber ab und werden regelmäßig angepasst; für 2026/2027 gelten beispielsweise 216.000 EUR für bestimmte sonstige Liefer- und Dienstleistungsaufträge und 5.404.000 EUR für Bauaufträge.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "gwb-vergaberecht", "schwellenwerte"],
  },

  // === VERFAHREN ===
  {
    slug: "offenes-verfahren",
    term: "Offenes Verfahren",
    category: "Verfahren",
    shortDefinition: "Das offene Verfahren ist ein Vergabeverfahren, bei dem jedes interessierte Unternehmen ein Angebot abgeben kann. Es gibt keine Teilnahmeantrags-Phase.",
    definition: [
      "Das offene Verfahren ist die transparenteste und wettbewerbsorientierteste Form der Vergabe. Jedes interessierte Unternehmen kann ein Angebot einreichen, ohne dass es einer vorherigen Teilnahmeantrags-Phase bedarf. Die Vergabeunterlagen stehen allen Interessenten zur Verfügung.",
      "Das Verfahren ist stärker reglementiert als andere Verfahrensarten. Im offenen Verfahren nach VgV beträgt die reguläre Angebotsfrist mindestens 35 Tage; gesetzliche Verkürzungen sind unter bestimmten Voraussetzungen möglich. Eine Verhandlung über die Angebote ist ausgeschlossen — der Auftrag wird an das wirtschaftlichste Angebot auf Basis der vorab bekanntgemachten Zuschlagskriterien erteilt.",
      "Das offene Verfahren wird häufig bei standardisierten Leistungen eingesetzt, bei denen eine einfache Bewertung der Angebote möglich ist. Es ist das am häufigsten angewendete Verfahren im öffentlichen Bereich.",
    ],
    keyPoints: [
      "Jedes interessierte Unternehmen kann ein Angebot abgeben",
      "Keine Teilnahmeantrags-Phase, keine Verhandlungen",
      "Reguläre Angebotsfrist nach VgV: mindestens 35 Tage; Verkürzungen sind gesetzlich nur unter Voraussetzungen möglich",
      "Zuschlag auf das wirtschaftlichste Angebot",
    ],
    faq: [
      {
        question: "Was ist das offene Verfahren?",
        answer: "Im offenen Verfahren kann jedes interessierte Unternehmen direkt ein Angebot abgeben, ohne vorher einen Teilnahmeantrag stellen zu müssen. Es ist das transparenteste und häufigste Vergabeverfahren.",
      },
      {
        question: "Wie lange ist die Frist im offenen Verfahren?",
        answer: "Im offenen Verfahren nach VgV beträgt die reguläre Angebotsfrist mindestens 35 Tage ab Absendung der Bekanntmachung. Verkürzungen können unter den Voraussetzungen der VgV möglich sein. Im Unterschwellenbereich richtet sich die Frist nach dem einschlägigen nationalen Regelwerk und den Vergabeunterlagen.",
      },
      {
        question: "Kann im offenen Verfahren verhandelt werden?",
        answer: "Nein, im offenen Verfahren sind Verhandlungen über die Angebote ausgeschlossen. Der Zuschlag wird allein auf Basis der eingereichten Angebote und der vorab bekannt gemachten Zuschlagskriterien erteilt.",
      },
    ],
    relatedTerms: ["beschraenktes-verfahren", "verhandlungsverfahren", "vgv-vergabeverordnung", "vob-a-eu"],
    relatedCategories: ["Bauarbeiten", "Gebaeudereinigung", "Lieferung"],
  },
  {
    slug: "beschraenktes-verfahren",
    term: "Beschränktes Verfahren",
    category: "Verfahren",
    shortDefinition: "Im beschränkten Verfahren können nur ausgewählte Unternehmen ein Angebot abgeben. Es gibt eine Teilnahmeantrags-Phase mit anschließender Eignungsprüfung.",
    definition: [
      "Das beschränkte Verfahren ist ein zweistufiges Vergabeverfahren: Zunächst wird eine Teilnahmeantrags-Phase durchgeführt, in der sich interessierte Unternehmen bewerben können. Anschließend wählt der Auftraggeber aus den Bewerbern eine bestimmte Anzahl von geeignetsten Unternehmen aus, die dann zur Angebotsabgabe aufgefordert werden.",
      "Im Gegensatz zum offenen Verfahren können also nicht alle Interessenten ein Angebot abgeben, sondern nur die vom Auftraggeber ausgewählten Unternehmen. Dies ermöglicht eine fundierte Eignungsprüfung bei komplexeren Vorhaben.",
      "Wie im offenen Verfahren ist auch im beschränkten Verfahren eine Verhandlung über die Angebote ausgeschlossen. Der Zuschlag erfolgt auf das wirtschaftlichste Angebot.",
    ],
    keyPoints: [
      "Zweistufig: Teilnahmeantrag → Eignungsprüfung → Angebotsabgabe",
      "Nur ausgewählte Unternehmen können ein Angebot abgeben",
      "Keine Verhandlungen über die Angebote",
      "Geeignet für komplexere Vorhaben mit vielen Bewerbern",
    ],
    faq: [
      {
        question: "Was ist das beschränkte Verfahren?",
        answer: "Im beschränkten Verfahren gibt es zunächst einen Teilnahmeantrag. Erst nach einer Eignungsprüfung werden ausgewählte Bewerber zur Angebotsabgabe aufgefordert. Nicht jeder Interessent kann also ein Angebot abgeben.",
      },
      {
        question: "Was ist der Unterschied zwischen offenem und beschränktem Verfahren?",
        answer: "Im offenen Verfahren kann jedes Unternehmen direkt ein Angebot abgeben, im beschränkten Verfahren müssen sich Unternehmen erst in einem Teilnahmeantrag bewerben. Im beschränkten Verfahren wählt der Auftraggeber die besten Bewerber aus, die dann ein Angebot abgeben dürfen.",
      },
    ],
    relatedTerms: ["offenes-verfahren", "verhandlungsverfahren", "vob-a-eu"],
    relatedCategories: ["Planungsleistungen", "IT-Dienstleistungen"],
  },
  {
    slug: "verhandlungsverfahren",
    term: "Verhandlungsverfahren",
    category: "Verfahren",
    shortDefinition: "Im Verhandlungsverfahren kann der Auftraggeber mit ausgewählten Bietern über alle Vertragsbestandteile verhandeln.",
    definition: [
      "Das Verhandlungsverfahren ist das flexibelste Vergabeverfahren. Es kann mit oder ohne Teilnahmewettbewerb durchgeführt werden. Der Auftraggeber verhandelt mit den Bietern über alle Aspekte des Vertrages, einschließlich Preise, technische Lösungen und Vertragsbedingungen.",
      "Das Verhandlungsverfahren wird bei besonders komplexen Vorhaben eingesetzt, bei denen eine reine Angebotsabgabe nicht ausreicht, um die beste Lösung zu finden. Es ermöglicht die Anpassung von Anforderungen und Lösungen im Dialog mit den Bietern.",
      "Im Oberschwellenbereich (VgV) ist das Verhandlungsverfahren nur unter bestimmten Voraussetzungen zulässig, etwa wenn das offene oder beschränkte Verfahren zu keinen brauchbaren Ergebnissen geführt hat oder die Beschaffung so komplex ist, dass die Konditionen nicht im Voraus festgelegt werden können.",
    ],
    keyPoints: [
      "Flexibelstes Vergabeverfahren mit Verhandlungsmöglichkeit",
      "Mit oder ohne Teilnahmewettbewerb möglich",
      "Verhandlungen über Preis, Technik und Vertragsbedingungen",
      "Im Oberschwellenbereich nur unter engen Voraussetzungen",
    ],
    faq: [
      {
        question: "Was ist das Verhandlungsverfahren?",
        answer: "Im Verhandlungsverfahren kann der Auftraggeber mit ausgewählten Bietern über alle Aspekte des Auftrags verhandeln — von Preisen über technische Lösungen bis zu Vertragsbedingungen. Es ist das flexibelste Vergabeverfahren.",
      },
      {
        question: "Wann wird das Verhandlungsverfahren angewendet?",
        answer: "Das Verhandlungsverfahren wird bei komplexen Beschaffungen eingesetzt, bei denen eine reine Angebotsabgabe nicht ausreicht. Im Oberschwellenbereich ist es nur zulässig, wenn offene oder beschränkte Verfahren nicht zum Ziel führen oder die Beschaffung besonders komplex ist.",
      },
    ],
    relatedTerms: ["offenes-verfahren", "beschraenktes-verfahren", "wettbewerblicher-dialog"],
    relatedCategories: ["IT-Dienstleistungen", "Planungsleistungen"],
  },
  {
    slug: "wettbewerblicher-dialog",
    term: "Wettbewerblicher Dialog",
    category: "Verfahren",
    shortDefinition: "Der wettbewerbliche Dialog ist ein Vergabeverfahren für besonders komplexe Vorhaben, bei dem Auftraggeber und Bieter im Dialog Lösungen entwickeln.",
    definition: [
      "Der wettbewerbliche Dialog ist ein Vergabeverfahren, das speziell für besonders komplexe Beschaffungen entwickelt wurde. Er ermöglicht einen strukturierten Dialog zwischen dem Auftraggeber und den ausgewählten Bietern, um gemeinsam geeignete Lösungen zu entwickeln, bevor finale Angebote abgegeben werden.",
      "Das Verfahren ist besonders geeignet, wenn der Auftraggeber rechtlich oder finanziell nicht in der Lage ist, die Spezifikationen des Auftrags im Voraus festzulegen, oder wenn die Komplexität so groß ist, dass klassische Vergabeverfahren nicht funktionieren.",
      "Der wettbewerbliche Dialog wird in drei Phasen durchgeführt: Erst Teilnahmeanträge, dann Dialogphasen mit ausgewählten Bietern zur Lösungsentwicklung, dann Angebotsabgabe und Zuschlag.",
    ],
    keyPoints: [
      "Für besonders komplexe Beschaffungen",
      "Strukturierter Dialog zur Lösungsentwicklung",
      "Drei Phasen: Teilnahme → Dialog → Angebot",
      "Setzt voraus, dass Spezifikation nicht vorab festgelegt werden kann",
    ],
    faq: [
      {
        question: "Was ist der wettbewerbliche Dialog?",
        answer: "Der wettbewerbliche Dialog ist ein Vergabeverfahren für besonders komplexe Projekte, bei dem der Auftraggeber mit ausgewählten Bietern in einen Dialog tritt, um gemeinsam Lösungen zu entwickeln, bevor die finalen Angebote abgegeben werden.",
      },
      {
        question: "Wann wird der wettbewerbliche Dialog angewendet?",
        answer: "Der wettbewerbliche Dialog wird angewendet, wenn die Beschaffung so komplex ist, dass der Auftraggeber die Spezifikationen nicht im Voraus festlegen kann. Typische Anwendungsfälle sind große IT-Projekte oder komplexe Infrastrukturvorhaben.",
      },
    ],
    relatedTerms: ["verhandlungsverfahren", "innovationspartnerschaft"],
  },
  {
    slug: "innovationspartnerschaft",
    term: "Innovationspartnerschaft",
    category: "Verfahren",
    shortDefinition: "Die Innovationspartnerschaft ist ein Vergabeverfahren für die Entwicklung innovativer Produkte, Dienstleistungen oder Bauwerke.",
    definition: [
      "Die Innovationspartnerschaft ist das jüngste Vergabeverfahren und wurde mit den EU-Vergaberichtlinien 2014 eingeführt. Sie dient der Entwicklung innovativer Produkte, Dienstleistungen oder Bauwerke, die am Markt noch nicht verfügbar sind.",
      "Der Auftraggeber kann mit einem oder mehreren Partnern eine Innovationspartnerschaft eingehen, um in mehreren Phasen Forschung, Entwicklung und Produktion eines innovativen Produkts zu begleiten. Die Verhandlungen können sich über einen längeren Zeitraum erstrecken.",
      "Das Verfahren richtet sich an Forschungseinrichtungen, Startups und Unternehmen, die hochinnovative Lösungen entwickeln und gemeinsam mit der öffentlichen Hand zur Marktreife bringen wollen.",
    ],
    keyPoints: [
      "Eingeführt 2014 mit den EU-Vergaberichtlinien",
      "Für die Entwicklung innovativer Produkte/Dienstleistungen",
      "Mehrere Phasen: Forschung, Entwicklung, Produktion",
      "Längerfristige Partnerschaft zwischen Auftraggeber und Partner",
    ],
    faq: [
      {
        question: "Was ist eine Innovationspartnerschaft?",
        answer: "Die Innovationspartnerschaft ist ein Vergabeverfahren zur Entwicklung innovativer Produkte, Dienstleistungen oder Bauwerke. Auftraggeber und Partner arbeiten in mehreren Phasen zusammen, um neue Lösungen zur Marktreife zu bringen.",
      },
      {
        question: "Wann wird die Innovationspartnerschaft angewendet?",
        answer: "Die Innovationspartnerschaft wird angewendet, wenn ein Bedarf an innovativen Lösungen besteht, die am Markt noch nicht verfügbar sind. Typische Bereiche sind Forschung, Technologieentwicklung und innovative Infrastruktur.",
      },
    ],
    relatedTerms: ["wettbewerblicher-dialog", "verhandlungsverfahren"],
  },
  {
    slug: "freihändige-vergabe",
    term: "Freihändige Vergabe",
    category: "Verfahren",
    shortDefinition: "Die freihändige Vergabe ist ein Vergabeverfahren im Unterschwellenbereich, bei dem der Auftraggeber mit ausgewählten Unternehmen verhandeln kann.",
    definition: [
      "Die freihändige Vergabe ist die traditionelle Bezeichnung für ein vereinfachtes Unterschwellenverfahren nach VOB/A Abschnitt 1. Bei Liefer- und Dienstleistungen verwendet die UVgO grundsätzlich den Begriff Verhandlungsvergabe. Die konkrete Zulässigkeit und der Ablauf richten sich nach dem jeweils anwendbaren Regelwerk.",
      "Der Auftraggeber wählt die Unternehmen, mit denen er verhandelt, nach pflichtgemäßem Ermessen aus. Die Zahl der Unternehmen muss so groß sein, dass ein echter Wettbewerb gewährleistet ist, in der Regel mindestens drei.",
      "Eine freihändige Vergabe beziehungsweise Verhandlungsvergabe ist nur zulässig, wenn die Voraussetzungen des jeweils anwendbaren Unterschwellenregelwerks erfüllt sind, etwa wegen besonderer Dringlichkeit, fehlender eindeutiger Bestimmbarkeit oder anderer ausdrücklich geregelter Gründe.",
    ],
    keyPoints: [
      "Unterschwellenverfahren (UVgO / § 3 VOB/A)",
      "Verhandlung mit ausgewählten Unternehmen möglich",
      "Mehrere geeignete Unternehmen können beteiligt werden; die konkrete Mindestzahl richtet sich nach dem anwendbaren Regelwerk",
      "Pendant zum Verhandlungsverfahren im Oberschwellenbereich",
    ],
    faq: [
      {
        question: "Was ist die freihändige Vergabe?",
        answer: "Die freihändige Vergabe ist eine traditionelle Bezeichnung für ein vereinfachtes Verfahren im Unterschwellenbereich, insbesondere nach VOB/A Abschnitt 1. Bei Liefer- und Dienstleistungen spricht die UVgO grundsätzlich von Verhandlungsvergabe.",
      },
      {
        question: "Wann ist die freihändige Vergabe zulässig?",
        answer: "Ob eine freihändige Vergabe oder Verhandlungsvergabe zulässig ist, hängt vom einschlägigen Regelwerk und den dort genannten Voraussetzungen ab. Eine feste Zahl angefragter Unternehmen gilt nicht pauschal für jede Konstellation; Wettbewerb und Gleichbehandlung bleiben zu beachten.",
      },
    ],
    relatedTerms: ["verhandlungsverfahren", "uvgo", "vob-a"],
  },
  {
    slug: "de-facto-vergabe",
    term: "De facto Vergabe",
    category: "Verfahren",
    shortDefinition: "Eine de facto Vergabe liegt vor, wenn ein öffentlicher Auftrag ohne förmliches Vergabeverfahren vergeben wird, obwohl die Vorgaben greifen würden.",
    definition: [
      "Eine de facto Vergabe bezeichnet die Vergabe eines öffentlichen Auftrags ohne Einhaltung der vorgeschriebenen Vergabeverfahren. Dies kann durch die direkte Vergabe an einen Anbieter, ohne Bekanntmachung und Wettbewerb geschehen, obwohl die Schwellenwerte überschritten sind und ein Verfahrensfehler vorliegt.",
      "Der Begriff taucht meist im Kontext von Nachprüfungsverfahren auf, bei denen Bieter rügen, dass ein Auftrag ohne ordnungsgemäßes Vergabeverfahren vergeben wurde. In solchen Fällen kann eine Korrektur des Verfahrens oder Schadensersatz verlangt werden.",
      "Um eine de facto Vergabe zu vermeiden, müssen öffentliche Auftraggeber sicherstellen, dass sie die Schwellenwerte beachten und bei Überschreitung ein ordnungsgemäßes Vergabeverfahren durchführen.",
    ],
    keyPoints: [
      "Vergabe ohne vorgeschriebenes Vergabeverfahren",
      "Verstoß gegen Vergaberecht (Verfahrensumgehung)",
      "Kann zu Nachprüfungsverfahren führen",
      "Auftraggeber müssen Schwellenwerte beachten",
    ],
    faq: [
      {
        question: "Was ist eine de facto Vergabe?",
        answer: "Eine de facto Vergabe liegt vor, wenn ein öffentlicher Auftrag ohne das vorgeschriebene förmliche Vergabeverfahren vergeben wird. Dies ist ein Verstoß gegen das Vergaberecht und kann zu Nachprüfungsverfahren führen.",
      },
      {
        question: "Wie kann man eine de facto Vergabe vermeiden?",
        answer: "Um eine de facto Vergabe zu vermeiden, müssen öffentliche Auftraggeber die Schwellenwerte beachten und bei Überschreitung das korrekte Vergabeverfahren durchführen — mit Bekanntmachung, Transparenz und Wettbewerb.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "vgv-vergabeverordnung", "schwellenwerte"],
  },

  // === VERGABEPROZESS ===
  {
    slug: "ausschreibung",
    term: "Ausschreibung",
    category: "Vergabeprozess",
    shortDefinition: "Die Ausschreibung ist das förmliche Verfahren, bei dem öffentliche Auftraggeber Unternehmen auffordern, Angebote für Leistungen einzureichen.",
    definition: [
      "Eine Ausschreibung ist das förmliche Verfahren, bei dem ein öffentlicher Auftraggeber Unternehmen zur Einreichung von Angeboten für die Erbringung von Leistungen auffordert. Die Ausschreibung ist der zentrale Schritt im Beschaffungsprozess und umfasst die Bekanntmachung, die Bereitstellung der Vergabeunterlagen und die Fristsetzung.",
      "Die Ausschreibung kann je nach Verfahrensart unterschiedlich gestaltet sein: Im offenen Verfahren richtet sich die Aufforderung an alle interessierten Unternehmen, im beschränkten Verfahren nur an ausgewählte Bewerber.",
      "Wesentliche Bestandteile einer Ausschreibung sind die Leistungsbeschreibung, die Eignungskriterien, die Zuschlagskriterien, die Vergabebedingungen und die Einreichungsfrist.",
    ],
    keyPoints: [
      "Förmliches Verfahren zur Einholung von Angeboten",
      "Bestandteile: Leistungsbeschreibung, Kriterien, Fristen",
      "Unterscheidung: offene vs. beschränkte Ausschreibung",
      "Grundlage für transparente und wettbewerbliche Vergabe",
    ],
    faq: [
      {
        question: "Was ist eine Ausschreibung?",
        answer: "Eine Ausschreibung ist das förmliche Verfahren, bei dem ein öffentlicher Auftraggeber Unternehmen auffordert, Angebote für die Erbringung von Leistungen einzureichen. Sie umfasst Bekanntmachung, Vergabeunterlagen und Fristsetzung.",
      },
      {
        question: "Was sind die Bestandteile einer Ausschreibung?",
        answer: "Zu den wesentlichen Bestandteilen einer Ausschreibung gehören die Leistungsbeschreibung, die Eignungs- und Zuschlagskriterien, die Vergabebedingungen und die Einreichungsfrist. Diese müssen klar und transparent formuliert sein.",
      },
      {
        question: "Wo findet man öffentliche Ausschreibungen?",
        answer: "Öffentliche Ausschreibungen werden auf verschiedenen Vergabeportalen wie DTVP, TED, evergabe.de und Bauportal Deutschland veröffentlicht. Tenderhunter aggregiert alle diese Quellen und macht sie zentral auffindbar.",
      },
    ],
    relatedTerms: ["leistungsbeschreibung", "leistungsverzeichnis", "losvergabe", "offenes-verfahren"],
    relatedCategories: ["Bauarbeiten", "Gebaeudereinigung", "IT-Dienstleistungen"],
  },
  {
    slug: "ausschreibungsreife",
    term: "Ausschreibungsreife",
    category: "Vergabeprozess",
    shortDefinition: "Die Ausschreibungsreife ist erreicht, wenn alle Bedingungen für eine Vergabe erfüllt sind: Das Projekt ist konkret, finanzierbar und rechtlich zulässig.",
    definition: [
      "Die Ausschreibungsreife ist ein Begriff aus dem Vergaberecht, der den Zeitpunkt beschreibt, ab dem ein öffentlicher Auftrag formell ausgeschrieben werden kann. Sie ist erreicht, wenn alle Voraussetzungen für eine Vergabe erfüllt sind.",
      "Dazu gehören insbesondere: Die Finanzierung ist gesichert, die Leistungsbeschreibung ist konkret genug, um Angebote vergleichbar zu machen, alle Genehmigungen und rechtlichen Voraussetzungen liegen vor, und der Bedarf ist klar definiert.",
      "Eine fehlende Ausschreibungsreife kann zur Unwirksamkeit des Vergabeverfahrens führen. Wenn z.B. die Finanzierung nicht gesichert ist oder die Leistungsbeschreibung zu unbestimmt ist, kann die Ausschreibung von Bietern angegriffen werden.",
    ],
    keyPoints: [
      "Voraussetzung für eine formgerechte Ausschreibung",
      "Finanzierung gesichert, Leistungsbeschreibung konkret",
      "Genehmigungen und rechtliche Voraussetzungen vorhanden",
      "Fehlende Ausschreibungsreife kann Verfahren unwirksam machen",
    ],
    faq: [
      {
        question: "Was bedeutet Ausschreibungsreife?",
        answer: "Ausschreibungsreife bedeutet, dass alle Voraussetzungen für eine formgerechte Ausschreibung erfüllt sind — insbesondere Finanzierung, Leistungsbeschreibung, Genehmigungen und rechtliche Zulässigkeit.",
      },
      {
        question: "Was passiert bei fehlender Ausschreibungsreife?",
        answer: "Bei fehlender Ausschreibungsreife kann das Vergabeverfahren unwirksam sein oder von Bietern angegriffen werden. Die Vergabe muss dann verschoben werden, bis alle Voraussetzungen erfüllt sind.",
      },
    ],
    relatedTerms: ["ausschreibung", "leistungsbeschreibung"],
  },
  {
    slug: "leistungsbeschreibung",
    term: "Leistungsbeschreibung",
    category: "Vergabeprozess",
    shortDefinition: "Die Leistungsbeschreibung definiert die vom Auftragnehmer zu erbringenden Leistungen. Sie ist Kernstück jeder Ausschreibung.",
    definition: [
      "Die Leistungsbeschreibung ist das zentrale Dokument einer jeden Ausschreibung. Sie definiert, welche Leistung vom Auftragnehmer erbracht werden muss und legt die technischen, funktionalen und qualitativen Anforderungen fest.",
      "Eine gute Leistungsbeschreibung ist konkret, eindeutig und vollständig. Sie ermöglicht es den Bietern, die Anforderungen zu verstehen und vergleichbare Angebote zu erstellen. Gleichzeitig lässt sie Raum für innovative Lösungen.",
      "Es werden funktionale Leistungsbeschreibungen (Anforderungen an das Ergebnis) und detaillierte Leistungsbeschreibungen (genaue Vorgaben zur Ausführung) unterschieden. Der Trend geht zur funktionalen Beschreibung, die dem Bieter mehr Gestaltungsfreiheit lässt.",
    ],
    keyPoints: [
      "Definiert die zu erbringenden Leistungen",
      "Kernstück jeder Ausschreibung",
      "Muss konkret, eindeutig und vollständig sein",
      "Funktional vs. detailliert: Trend geht zur funktionalen Beschreibung",
    ],
    faq: [
      {
        question: "Was ist eine Leistungsbeschreibung?",
        answer: "Die Leistungsbeschreibung definiert die vom Auftragnehmer zu erbringenden Leistungen, einschließlich technischer, funktionaler und qualitativer Anforderungen. Sie ist das Kernstück jeder Ausschreibung.",
      },
      {
        question: "Wie wird eine Leistungsbeschreibung erstellt?",
        answer: "Eine Leistungsbeschreibung wird vom Auftraggeber erstellt und muss konkret, eindeutig und vollständig sein. Sie kann funktional (Ergebnisorientiert) oder detailliert (ausführungsorientiert) sein. Oft werden Vorlagen oder Muster verwendet.",
      },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "vob-c", "leistungsverzeichnis", "losvergabe", "ausschreibung", "eigenerklaerung"],
    relatedArticles: ["vob-vergabe", "ausschreibung-schreiben"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA"],
  },
  {
    slug: "leistungsverzeichnis",
    term: "Leistungsverzeichnis (LV)",
    category: "Vergabeprozess",
    shortDefinition: "Das Leistungsverzeichnis ist ein detaillierter Katalog aller Einzelposten einer Bauleistung oder Dienstleistung mit Mengen und Einheiten.",
    definition: [
      "Das Leistungsverzeichnis (LV) ist ein strukturierter Katalog aller Einzelposten, die im Rahmen einer Bauleistung oder Dienstleistung erbracht werden müssen. Es enthält für jeden Posten eine klare Beschreibung, die Einheit (z.B. m², Stück, Stunden), die Menge und oft einen Preisansatz.",
      "Das LV ist Grundlage für die Angebotsabgabe und die spätere Abrechnung. Der Bieter füllt seine Preise in das LV ein, und die Summe ergibt sein Angebot. Nach Zuschlag wird das LV zur Grundlage der Rechnungsstellung und der Leistungsabnahme.",
      "Im Bauwesen wird das LV oft als GAEB-Datei ausgetauscht, einem standardisierten XML-Format, das den Austausch zwischen Auftraggebern und Bietern erleichtert.",
    ],
    keyPoints: [
      "Katalog aller Einzelposten einer Leistung",
      "Enthält Position, Einheit, Menge, Preis",
      "Grundlage für Angebot und Abrechnung",
      "Im Bauwesen oft als GAEB-Datei ausgetauscht",
    ],
    faq: [
      {
        question: "Was ist ein Leistungsverzeichnis?",
        answer: "Ein Leistungsverzeichnis (LV) ist ein detaillierter Katalog aller Einzelposten einer Bauleistung oder Dienstleistung mit Beschreibung, Einheit, Menge und Preis. Es ist Grundlage für Angebot und Abrechnung.",
      },
      {
        question: "Was ist GAEB?",
        answer: "GAEB (Gemeinsamer Ausschuss Elektronik im Bauwesen) ist ein Standard für den elektronischen Austausch von Leistungsverzeichnissen. GAEB-Dateien erleichtern die Kommunikation zwischen Auftraggebern und Bietern.",
      },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "vob-c", "leistungsbeschreibung", "losvergabe", "gaeb", "ausschreibung"],
    relatedArticles: ["vob-vergabe", "ausschreibung-schreiben"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA"],
  },
  {
    slug: "losvergabe",
    term: "Losvergabe (Teil- und Fachlose)",
    category: "Vergabeprozess",
    shortDefinition: "Bei der Losvergabe wird ein öffentlicher Auftrag in eigenständige Teile geteilt: Teillose trennen Mengen, Fachlose unterschiedliche Gewerke oder Fachgebiete.",
    definition: [
      "Ein Los ist ein abgrenzbarer Teil eines Beschaffungsvorhabens. Teillose teilen eine Leistung nach Menge oder Umfang, etwa in regionale Abschnitte. Fachlose trennen Leistungen nach Art oder Fachgebiet, zum Beispiel Rohbau, Elektro und Heizung.",
      "Im Anwendungsbereich des vierten Teils des GWB verlangt § 97a Absatz 1 grundsätzlich die Aufteilung in Teil- und Fachlose. Mehrere Lose dürfen nach Absatz 2 zusammen vergeben werden, wenn wirtschaftliche oder technische Gründe dies erfordern. Für nationale Bauvergaben enthält § 5 Absatz 2 VOB/A Abschnitt 1 eine entsprechende Regel, soweit dieser Abschnitt für den Auftraggeber eingeführt ist.",
      "Die aktuelle Fassung des § 97a Absatz 3 GWB sieht außerdem eine eng begrenzte Zusammenfassung aus zeitlichen Gründen bei bestimmten Infrastrukturvorhaben vor. Dafür muss der geschätzte Auftragswert mindestens das Doppelte des einschlägigen EU-Schwellenwerts erreichen und das Vorhaben entweder aus dem Sondervermögen Infrastruktur und Klimaneutralität finanziert werden oder zu den im Gesetz genannten Verkehrswegen gehören. Das ist keine allgemeine Ausnahme für eilige Bauprojekte. Die VOB/A EU enthält die Regelung in § 5a ebenfalls.",
      "Für Bieter entscheidet die Bekanntmachung, ob sie Angebote für ein, mehrere oder alle Lose einreichen können und ob eine Höchstzahl für Zuschläge gilt. Losbildung bedeutet nicht automatisch, dass der Auftragswert oder Schwellenwert für jedes Los isoliert zu beurteilen ist; dafür gelten eigene Berechnungsregeln.",
    ],
    keyPoints: [
      "Teillos = Aufteilung nach Menge oder Umfang; Fachlos = Trennung nach Gewerk oder Fachgebiet",
      "Im einschlägigen Regelwerk ist die Losvergabe grundsätzlich vorgesehen",
      "Zusammenfassung ist bei wirtschaftlichen oder technischen Gründen möglich; die gesetzliche Infrastruktur-Ausnahme ist eng begrenzt",
      "Bekanntmachung und Vergabeunterlagen regeln, für wie viele Lose Bieter Angebote abgeben und Zuschläge erhalten können",
    ],
    faq: [
      {
        question: "Was ist der Unterschied zwischen Teil- und Fachlosen?",
        answer: "Teillose teilen eine Leistung nach Menge oder Umfang, zum Beispiel nach Bauabschnitten. Fachlose trennen die Leistung nach Art oder Fachgebiet, etwa in Rohbau, Elektro und Heizung.",
      },
      {
        question: "Muss ein öffentlicher Auftrag immer in Lose aufgeteilt werden?",
        answer: "Nein, nicht ausnahmslos. Im jeweils anwendbaren Regelwerk gilt grundsätzlich ein Losgrundsatz; mehrere Lose können insbesondere bei erforderlichen wirtschaftlichen oder technischen Gründen zusammen vergeben werden. Für bestimmte Infrastrukturvorhaben gibt es zusätzlich eine eng begrenzte gesetzliche Ausnahme aus zeitlichen Gründen.",
      },
      {
        question: "Kann ich ein Angebot für nur ein Los abgeben?",
        answer: "Das richtet sich nach der Bekanntmachung und den Vergabeunterlagen. Im Anwendungsbereich der VgV muss der Auftraggeber angeben, ob Angebote für ein, mehrere oder alle Lose zulässig sind; eine Höchstzahl möglicher Zuschläge muss ebenfalls bekannt gemacht werden.",
      },
      {
        question: "Wird der Schwellenwert für jedes Los einzeln berechnet?",
        answer: "Nicht automatisch. Für die Schätzung des Auftragswerts gelten eigene Regeln zu Losen und möglichen Ausnahmen. Die Aufteilung in Lose erlaubt deshalb nicht ohne Weiteres, jedes Los als eigenständige Unterschwellenvergabe zu behandeln.",
      },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "schwellenwerte", "auftragswert", "leistungsbeschreibung", "leistungsverzeichnis", "ausschreibung"],
    relatedArticles: ["vob-vergabe", "schwellenwerte-vergabe"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    sources: [
      { title: "§ 97a GWB – Losgrundsatz", url: "https://www.gesetze-im-internet.de/gwb/__97a.html" },
      { title: "§ 30 VgV – Aufteilung nach Losen", url: "https://www.gesetze-im-internet.de/vgv_2016/__30.html" },
      { title: "VOB/A Abschnitt 1, § 5 – Vergabe nach Losen", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "Bundesanzeiger: VOB/A Abschnitt 2 und 3, Ausgabe 2026", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
      { title: "§ 3 VgV – Schätzung des Auftragswerts", url: "https://www.gesetze-im-internet.de/vgv_2016/__3.html" },
    ],
    lastReviewed: "2026-10-08",
  },
  {
    slug: "bindefrist",
    term: "Bindefrist",
    category: "Vergabeprozess",
    shortDefinition: "Die Bindefrist ist der Zeitraum, während dessen ein Bieter an sein Angebot gebunden bleibt.",
    definition: [
      "Die Bindefrist bezeichnet den Zeitraum, in dem ein Bieter an sein abgegebenes Angebot gebunden bleibt. Ein Zuschlag innerhalb dieser Frist kann den Vertrag nach den Vorgaben des konkreten Verfahrens zustande bringen; die Bindefrist ist keine Pflicht, ein beliebig geändertes Angebot anzunehmen.",
      "Der Auftraggeber legt die Bindefrist in der Bekanntmachung oder den Vergabeunterlagen fest. Sie muss angemessen sein und beginnt bei den einschlägigen VOB/A-Regelungen grundsätzlich mit dem Ablauf der Angebotsfrist, nicht erst mit der Angebotseröffnung. Das konkrete Regelwerk ist maßgeblich.",
      "Nach Ablauf der Bindefrist ist der Bieter grundsätzlich nicht mehr an sein Angebot gebunden. Ein späterer Vertragsschluss setzt dann regelmäßig seine Zustimmung beziehungsweise eine erneute Bindung voraus; der Auftraggeber darf die Bindefrist nicht einseitig verlängern.",
    ],
    keyPoints: [
      "Zeitraum, in dem der Bieter an sein Angebot gebunden ist",
      "Wird vom Auftraggeber festgelegt",
      "Beginnt nach den einschlägigen Vorschriften regelmäßig mit dem Ablauf der Angebotsfrist",
      "Nach Ablauf ist eine weitere Bindung des Bieters nicht selbstverständlich",
    ],
    faq: [
      {
        question: "Was ist die Bindefrist bei einer Ausschreibung?",
        answer: "Die Bindefrist ist der Zeitraum, in dem ein Bieter an sein Angebot gebunden bleibt. Sie wird vom Auftraggeber in den Vergabeunterlagen festgelegt. Nach den einschlägigen Vorschriften beginnt sie regelmäßig mit dem Ablauf der Angebotsfrist; eine pauschale Regel ab Angebotseröffnung gibt es nicht.",
      },
      {
        question: "Wie lange ist eine typische Bindefrist?",
        answer: "Eine allgemeingültige typische Dauer gibt es nicht. Die Bindefrist muss für die Prüfung und Wertung der Angebote angemessen sein und ergibt sich aus der konkreten Bekanntmachung oder den Vergabeunterlagen.",
      },
    ],
    relatedTerms: ["ausschreibung", "zuschlag", "angebot"],
    sources: [
      { title: "VOB/A 2019 – § 10a und § 10b", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "zuschlag",
    term: "Zuschlag",
    category: "Vergabeprozess",
    shortDefinition: "Der Zuschlag ist die Annahme eines Angebots durch den Auftraggeber und führt zum Vertragsabschluss.",
    definition: [
      "Der Zuschlag ist die verbindliche Annahme eines Angebots durch den öffentlichen Auftraggeber. Mit dem Zuschlag kommt der Vertrag zwischen Auftraggeber und Bieter zustande. Die Zuschlagsentscheidung und ihre Mitteilung müssen den jeweils anwendbaren Formvorschriften entsprechen.",
      "Der Zuschlag muss auf Basis der vorab bekannt gemachten Zuschlagskriterien erfolgen. Das wirtschaftlichste Angebot erhält den Zuschlag — das muss nicht zwingend das billigste sein, wenn andere Kriterien wie Qualität, Laufzeit oder Nachhaltigkeit berücksichtigt werden.",
      "Nach erfolgtem Zuschlag müssen die nicht berücksichtigten Bieter informiert werden. Sie können innerhalb bestimmter Fristen den Zuschlag angreifen, wenn sie der Meinung sind, dass das Verfahren fehlerhaft war.",
    ],
    keyPoints: [
      "Verbindliche Annahme eines Angebots",
      "Führt zum Vertragsabschluss",
      "Muss auf Basis der Zuschlagskriterien erfolgen",
      "Nicht berücksichtigte Bieter müssen informiert werden",
    ],
    faq: [
      {
        question: "Was bedeutet Zuschlag bei einer Ausschreibung?",
        answer: "Der Zuschlag ist die verbindliche Annahme eines Angebots durch den Auftraggeber. Mit dem Zuschlag kommt der Vertrag zustande. Der Zuschlag muss auf Basis der vorher bekannt gemachten Zuschlagskriterien erfolgen.",
      },
      {
        question: "Kann der Zuschlag angegriffen werden?",
        answer: "Unter den Voraussetzungen des vierten Teils des GWB können antragsbefugte Unternehmen ein Nachprüfungsverfahren einleiten. Die Fristen richten sich insbesondere nach § 160 Absatz 3 GWB; sie sind nicht pauschal mit der 15- oder 10-tägigen Wartefrist aus § 134 GWB gleichzusetzen.",
      },
    ],
    relatedTerms: ["zuschlagskriterien", "bindefrist", "nachpruefungsverfahren"],
    sources: [
      { title: "§ 127 GWB – Zuschlag", url: "https://www.gesetze-im-internet.de/gwb/__127.html" },
      { title: "§ 134 GWB – Informations- und Wartepflicht", url: "https://www.gesetze-im-internet.de/gwb/__134.html" },
      { title: "§ 160 GWB – Einleitung, Antrag", url: "https://www.gesetze-im-internet.de/gwb/__160.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "angebot",
    term: "Angebot",
    category: "Vergabeprozess",
    shortDefinition: "Das Angebot ist die verbindliche Erklärung eines Bieters, eine Leistung zu bestimmten Bedingungen zu erbringen.",
    definition: [
      "Ein Angebot ist die Erklärung eines Unternehmens, die ausgeschriebene Leistung zu den angebotenen Bedingungen zu erbringen. Es muss die für das konkrete Verfahren geforderten Angaben, Preise und Erklärungen enthalten. Welche Unterlagen einzureichen sind, ergibt sich aus der Bekanntmachung und den Vergabeunterlagen.",
      "Es gibt keine allgemeingültige Liste von Eignungsnachweisen, Anlagen oder Unterschriften für jedes Angebot. Maßgeblich sind die Anforderungen des jeweiligen Auftrags und Loses. Unvollständige oder nicht formgerechte Angebote können je nach Regelwerk und Einzelfall ausgeschlossen werden.",
      "Der Zuschlag richtet sich nach den vorab bekannt gemachten Zuschlagskriterien. Das kann der Preis allein oder das beste Preis-Leistungs-Verhältnis sein. Zusätzliche Referenzen oder Zertifikate sichern keinen Zuschlag, wenn sie nicht verlangt oder nach den Kriterien bewertet werden.",
      "Für Verfahren im Anwendungsbereich der VgV werden Angebote grundsätzlich in Textform mit elektronischen Mitteln übermittelt. Eine fortgeschrittene oder qualifizierte elektronische Signatur kann bei erhöhten Sicherheitsanforderungen verlangt werden. Andere Vergaberegeln können abweichen.",
    ],
    keyPoints: [
      "Inhalt und Form richten sich nach Bekanntmachung und Vergabeunterlagen",
      "Nur die konkret verlangten Formulare, Angaben und Nachweise einreichen",
      "Im Anwendungsbereich der VgV grundsätzlich elektronische Übermittlung in Textform",
      "Signaturanforderungen und Nachforderungen hängen vom konkreten Regelwerk ab",
      "Der Zuschlag richtet sich nach den bekannt gemachten Zuschlagskriterien",
    ],
    faq: [
      {
        question: "Muss ein Angebot bei einer öffentlichen Ausschreibung qualifiziert elektronisch signiert werden?",
        answer: "Nicht pauschal. Im Anwendungsbereich der VgV werden Angebote grundsätzlich in Textform mit elektronischen Mitteln übermittelt. Eine fortgeschrittene oder qualifizierte Signatur beziehungsweise ein Siegel kann die Vergabestelle verlangen, wenn dies wegen erhöhter Sicherheitsanforderungen erforderlich ist. Prüfen Sie immer die konkreten Vergabeunterlagen und das anwendbare Regelwerk.",
      },
      {
        question: "Welche Unterlagen gehören in ein Angebot?",
        answer: "Einzureichen sind die Angaben, Preise, Formulare und Nachweise, die für das konkrete Verfahren und Los verlangt werden. Eine feste Anlagenliste für alle Ausschreibungen gibt es nicht. Maßgeblich sind Bekanntmachung und Vergabeunterlagen.",
      },
      {
        question: "Kann ich fehlende Unterlagen nach der Angebotsfrist nachreichen?",
        answer: "Nicht automatisch. Nach § 56 VgV kann die Vergabestelle unter bestimmten Voraussetzungen Unterlagen nachfordern, sie kann dies aber auch ausschließen. Leistungsbezogene Unterlagen, die die Zuschlagswertung beeinflussen, sind grundsätzlich ausgenommen. Für andere Vergaberegeln gelten deren eigene Vorgaben.",
      },
      {
        question: "Wird immer das günstigste Angebot ausgewählt?",
        answer: "Nein. Der Zuschlag richtet sich nach den bekannt gemachten Zuschlagskriterien. Das kann der Preis allein oder das beste Preis-Leistungs-Verhältnis sein.",
      },
    ],
    relatedTerms: ["zuschlag", "bindefrist", "eignungskriterien", "zuschlagskriterien", "leistungsbeschreibung", "vergabeunterlagen", "e-vergabe", "nachforderung-unterlagen"],
    relatedArticles: ["angebot-oeffentliche-ausschreibung-schreiben", "wie-funktioniert-ausschreibung"],
    sources: [
      { title: "§ 53 VgV – Form und Übermittlung von Angeboten", url: "https://www.gesetze-im-internet.de/vgv_2016/__53.html" },
      { title: "§ 56 VgV – Prüfung und Nachforderung von Unterlagen", url: "https://www.gesetze-im-internet.de/vgv_2016/__56.html" },
      { title: "§ 127 GWB – Zuschlag", url: "https://www.gesetze-im-internet.de/gwb/__127.html" },
    ],
    lastReviewed: "2026-10-20",
  },
  {
    slug: "nachforderung-unterlagen",
    term: "Nachforderung von Unterlagen",
    category: "Vergabeprozess",
    shortDefinition: "Bei der Nachforderung bittet der Auftraggeber einen Bewerber oder Bieter, fehlende, unvollständige oder fehlerhafte Unterlagen nachzureichen oder zu korrigieren. Ob das zulässig ist, hängt vom anwendbaren Vergaberecht und den Vergabeunterlagen ab; ein Angebot darf nicht beliebig nachgebessert werden.",
    definition: [
      "Eine Nachforderung ist eine Aufforderung der Vergabestelle, bestimmte Unterlagen zu übermitteln, zu ergänzen, zu erläutern oder zu korrigieren. Sie kann Teilnahmeanträge und Angebote betreffen. Für Vergaben nach der VgV regelt § 56, dass der Auftraggeber unter Wahrung von Transparenz und Gleichbehandlung fehlende, unvollständige oder fehlerhafte Unterlagen nachfordern kann. Er darf in Bekanntmachung oder Vergabeunterlagen auch festlegen, dass keine Nachforderung erfolgt.",
      "Die Möglichkeit ist begrenzt: Nach § 56 Absatz 3 VgV sind leistungsbezogene Unterlagen, die die Bewertung nach Zuschlagskriterien betreffen, grundsätzlich von der Nachforderung ausgeschlossen. Für bestimmte unwesentliche Preisangaben enthält die Vorschrift eine eng gefasste Ausnahme. Diese Regeln lassen sich nicht pauschal auf jedes Verfahren übertragen.",
      "Bei EU-weiten Bauaufträgen ordnet § 2 VgV die Anwendung bestimmter Teile der VgV an; im Übrigen gilt VOB/A Abschnitt 2, zu dem die VOB/A EU gehört. Deren § 16a enthält eine eigene Regelung zur Nachforderung. Planungsleistungen, die als Los eines Bauauftrags vergeben werden, unterliegen nach § 2 VgV der VgV. Auch im Unterschwellenbereich kommt es auf das für den Auftraggeber geltende Regelwerk und dessen Einführung an.",
      "Für Bieter ist eine Nachforderung keine Einladung, das Angebot frei zu ändern. Entscheidend sind der genaue Inhalt des Schreibens, die gesetzte Frist und der vorgegebene Übermittlungsweg. Prüfen Sie außerdem, ob eine verlangte Unterlage unternehmensbezogen ist oder Angaben zur Leistung beziehungsweise Preiswertung betrifft, und reichen Sie nur das Angeforderte fristgerecht ein.",
    ],
    keyPoints: [
      "Die Zulässigkeit richtet sich nach dem konkreten Vergaberegelwerk und den Vergabeunterlagen",
      "§ 56 VgV erlaubt Nachforderungen unter Wahrung von Transparenz und Gleichbehandlung, schließt aber bestimmte leistungsbezogene Unterlagen aus",
      "Bei EU-weiten Bauvergaben ist die besondere Regelung in § 16a EU VOB/A zusammen mit § 2 VgV zu prüfen",
      "Eine Nachforderung erlaubt keine beliebige Änderung des Angebots; Frist und Übermittlungsweg genau einhalten",
    ],
    faq: [
      {
        question: "Kann der Auftraggeber fehlende Unterlagen immer nachfordern?",
        answer: "Nein. Nach § 56 VgV kann der Auftraggeber bestimmte fehlende, unvollständige oder fehlerhafte Unterlagen nachfordern, darf dies aber in Bekanntmachung oder Vergabeunterlagen ausschließen. Welche Regel gilt und welche Unterlagen betroffen sind, hängt vom Verfahren ab.",
      },
      {
        question: "Darf ich mit der Nachforderung mein Angebot oder den Preis ändern?",
        answer: "Eine Nachforderung ist keine allgemeine Möglichkeit, das Angebot nachträglich zu ändern. § 56 Absatz 3 VgV schließt leistungsbezogene Unterlagen, die die Zuschlagswertung beeinflussen, grundsätzlich aus; für bestimmte unwesentliche Preisangaben gilt eine eng begrenzte Ausnahme. Maßgeblich ist das anwendbare Regelwerk.",
      },
      {
        question: "Gilt § 56 VgV auch für Bauvergaben?",
        answer: "Nicht pauschal. Bei Bauaufträgen bestimmt § 2 VgV, welche Teile der VgV gelten und wann im Übrigen VOB/A Abschnitt 2 anzuwenden ist. Für EU-weite Bauvergaben ist insbesondere § 16a EU VOB/A zu prüfen.",
      },
    ],
    relatedTerms: ["angebot", "vergabeunterlagen", "eignungskriterien", "zuschlagskriterien", "e-vergabe", "teilnahmewettbewerb", "vob-a", "vob-a-eu"],
    relatedArticles: ["angebot-oeffentliche-ausschreibung-schreiben", "wie-funktioniert-ausschreibung", "vob-vergabe"],
    sources: [
      { title: "§ 56 VgV – Nachforderung von Unterlagen", url: "https://www.gesetze-im-internet.de/vgv_2016/__56.html" },
      { title: "§ 2 VgV – Vergabe von Bauaufträgen", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "Bundesanzeiger: VOB/A Abschnitte 2 und 3, Ausgabe 2026", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
      { title: "VOB/A Abschnitt 1 – Bekanntmachung vom 31. Januar 2019", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-10-11",
  },
  {
    slug: "bietergemeinschaft",
    term: "Bietergemeinschaft",
    category: "Vergabeprozess",
    shortDefinition: "Eine Bietergemeinschaft (ARGE) ist ein Zusammenschluss mehrerer Unternehmen, die gemeinsam ein Angebot abgeben.",
    definition: [
      "Eine Bietergemeinschaft, auch Arbeitsgemeinschaft (ARGE) genannt, ist ein Zusammenschluss von zwei oder mehr rechtlich selbstständigen Unternehmen, die sich zusammen an einem Vergabeverfahren beteiligen und ein gemeinsames Angebot abgeben.",
      "Bietergemeinschaften werden oft gebildet, wenn ein einzelnes Unternehmen nicht über die erforderlichen Ressourcen, Fachkompetenzen oder Kapazitäten verfügt, um eine komplexe Leistung allein zu erbringen. Durch die Zusammenarbeit können sich die Unternehmen ergänzen und größere Aufträge abwickeln.",
      "Mitglieder einer Bietergemeinschaft haften gesamtschuldnerisch für die Vertragserfüllung. Das bedeutet, dass der Auftraggeber jedes Mitglied für die gesamte Leistung in Anspruch nehmen kann. Die interne Aufgabenverteilung regeln die Mitglieder untereinander.",
    ],
    keyPoints: [
      "Zusammenschluss mehrerer Unternehmen für ein gemeinsames Angebot",
      "Auch Arbeitsgemeinschaft (ARGE) genannt",
      "Gesamtschuldnerische Haftung für alle Mitglieder",
      "Ermöglicht die Bewältigung großer, komplexer Aufträge",
    ],
    faq: [
      {
        question: "Was ist eine Bietergemeinschaft?",
        answer: "Eine Bietergemeinschaft (ARGE) ist ein Zusammenschluss von zwei oder mehr Unternehmen, die gemeinsam ein Angebot für eine Ausschreibung abgeben. Die Mitglieder haften gesamtschuldnerisch für die Vertragserfüllung.",
      },
      {
        question: "Wann lohnt sich eine Bietergemeinschaft?",
        answer: "Eine Bietergemeinschaft lohnt sich, wenn ein einzelnes Unternehmen die Anforderungen nicht erfüllen kann (z.B. aufgrund fehlender Kapazitäten oder Referenzen) oder wenn durch die Zusammenarbeit Synergieeffekte entstehen, die zu einem besseren Angebot führen.",
      },
    ],
    relatedTerms: ["nachunternehmer", "eignungskriterien", "angebot", "eignungsleihe"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "Facility Management"],
  },
  {
    slug: "nachunternehmer",
    term: "Nachunternehmer",
    category: "Vergabeprozess",
    shortDefinition: "Ein Nachunternehmer ist ein Unternehmen, das im Rahmen eines Vergabevertrags Leistungen für den Hauptauftragnehmer erbringt.",
    definition: [
      "Ein Nachunternehmer (auch Unterauftragnehmer genannt) ist ein Unternehmen, das im Rahmen eines öffentlichen Vergabevertrags bestimmte Leistungen erbringt, ohne selbst Vertragspartner des Auftraggebers zu sein. Der Hauptauftragnehmer bleibt allein verantwortlich für die Vertragserfüllung.",
      "Die Einschaltung von Nachunternehmern muss in der Regel bei der Angebotsabgabe angegeben werden, insbesondere bei Leistungen, die einen wesentlichen Teil des Auftrags ausmachen. Der Auftraggeber kann die Eignung des Nachunternehmers überprüfen.",
      "Aus vergaberechtlicher Sicht ist relevant, dass die Einschaltung von Nachunternehmern nicht zur Umgehung von Tariftreue- oder Vergabepflichten führen darf. Bei bestimmten Vergaben gelten besondere Nachunternehmeregelungen (z.B. VgV sowie einschlägige Tariftreue- oder Vergabegesetze).",
    ],
    keyPoints: [
      "Erbringt Teilleistungen für den Hauptauftragnehmer",
      "Hauptauftragnehmer bleibt verantwortlich für Vertragserfüllung",
      "Muss bei der Angebotsabgabe angegeben werden",
      "Eignung kann durch den Auftraggeber überprüft werden",
    ],
    faq: [
      {
        question: "Was ist ein Nachunternehmer?",
        answer: "Ein Nachunternehmer ist ein Unternehmen, das im Rahmen eines Vergabevertrags Teilleistungen für den Hauptauftragnehmer erbringt. Der Hauptauftragnehmer bleibt alleiniger Vertragspartner des Auftraggebers und trägt die Verantwortung.",
      },
      {
        question: "Müssen Nachunternehmer angegeben werden?",
        answer: "Ja, die Einschaltung von Nachunternehmern für wesentliche Teilleistungen muss in der Regel bei der Angebotsabgabe angegeben werden. Der Auftraggeber kann die Eignung des Nachunternehmers überprüfen und die Einschaltung ablehnen, wenn Bedenken bestehen.",
      },
    ],
    relatedTerms: ["bietergemeinschaft", "eignungskriterien", "angebot", "vob-b", "eignungsleihe"],
  },

  // === EIGNUUNG & ZUSCHLAG ===
  {
    slug: "eignungskriterien",
    term: "Eignungskriterien",
    category: "Eignung & Zuschlag",
    shortDefinition: "Eignungskriterien sind die Kriterien, anhand derer der Auftraggeber beurteilt, ob ein Bieter fachlich, wirtschaftlich und rechtlich zur Auftragsausführung geeignet ist.",
    definition: [
      "Eignungskriterien sind die Maßstäbe, anhand derer der Auftraggeber feststellt, ob ein Bieter die notwendige fachliche, wirtschaftliche und rechtliche Eignung für die Durchführung des Auftrags besitzt. Bieter, die die festgelegten Eignungskriterien nicht erfüllen, sind nach den jeweils anwendbaren Vorschriften nicht für den Zuschlag geeignet.",
      "Die wichtigsten Eignungskriterien sind: Befähigung und Fachkunde (Qualifikationen, Zertifikate), Leistungsfähigkeit (personelle und technische Ausstattung), Zuverlässigkeit (keine Vorstrafen, Steuern/Sozialabgaben), und wirtschaftliche Leistungskraft (Umsatz, Referenzen).",
      "Eignungskriterien müssen transparent, nachvollziehbar und angemessen sein. Sie müssen vorab in der Bekanntmachung oder in den Vergabeunterlagen bekannt gemacht werden und in einem klaren Bezug zur Leistung stehen.",
    ],
    keyPoints: [
      "Maßstäbe für die fachliche, wirtschaftliche und rechtliche Eignung",
      "Umfassen Fachkunde, Leistungsfähigkeit, Zuverlässigkeit, Wirtschaftlichkeit",
      "Müssen transparent und angemessen sein",
      "Vorab in der Bekanntmachung zu definieren",
    ],
    faq: [
      {
        question: "Was sind Eignungskriterien?",
        answer: "Eignungskriterien sind die Kriterien, anhand derer der Auftraggeber beurteilt, ob ein Bieter fachlich, wirtschaftlich und rechtlich für die Durchführung eines Auftrags geeignet ist. Sie umfassen Fachkunde, Leistungsfähigkeit, Zuverlässigkeit und Wirtschaftlichkeit.",
      },
      {
        question: "Wie werden Eignungskriterien festgelegt?",
        answer: "Eignungskriterien müssen vorab in der Bekanntmachung oder den Vergabeunterlagen definiert werden. Sie müssen transparent, nachvollziehbar und im angemessenen Verhältnis zur Leistung stehen. Typische Kriterien sind Referenzen, Zertifikate, Umsatzzahlen und personelle Ausstattung.",
      },
    ],
    relatedTerms: ["zuschlagskriterien", "eigenerklaerung", "referenzen", "eignungsleihe", "nachforderung-unterlagen", "praequalifikation-pq-vob"],
  },
  {
    slug: "praequalifikation-pq-vob",
    term: "Präqualifikation nach PQ-VOB",
    category: "Eignung & Zuschlag",
    shortDefinition: "PQ-VOB ist ein Verfahren zur vorgelagerten, auftragsunabhängigen Prüfung bestimmter Eignungsnachweise von Bauunternehmen. Der Eintrag kann bei öffentlichen Bauvergaben als Eignungsnachweis dienen, ersetzt aber nicht automatisch auftragsbezogene Nachweise oder die Prüfung der konkreten Vergabeunterlagen.",
    definition: [
      "Bei einer Präqualifikation werden festgelegte Eignungsnachweise eines Unternehmens vor und unabhängig von einem einzelnen Vergabeverfahren geprüft. Für Bauunternehmen in Deutschland führt der Verein für die Präqualifikation von Bauunternehmen e. V. das amtliche Verzeichnis PQ-VOB; die Prüfung selbst übernehmen vom Verein beauftragte Präqualifizierungsstellen.",
      "Ein präqualifiziertes Unternehmen kann seine Eintragung und Registriernummer für den Eignungsnachweis in einer Bauvergabe nutzen. Im EU-weiten Bereich nach VOB/A erlaubt § 6b EU VOB/A, den Nachweis ganz oder teilweise über Präqualifizierungssysteme zu führen. Angaben im PQ-VOB-Verzeichnis sollen dort nicht ohne Begründung in Zweifel gezogen werden. Je nach Regelwerk kann die Vergabestelle dennoch zusätzliche Bescheinigungen verlangen, etwa zu Steuern, Abgaben oder Sozialversicherungsbeiträgen.",
      "Die Eintragung ist kein pauschaler Nachweis für jede Anforderung eines konkreten Auftrags. Bieter müssen prüfen, ob die registrierten Leistungsbereiche zu den ausgeschriebenen Arbeiten passen, die Eintragung aktuell ist und welche weiteren auftragsbezogenen Nachweise die Vergabeunterlagen verlangen. Auch besondere technische Anforderungen oder Angaben zur wirtschaftlichen Leistungsfähigkeit können zusätzlich abzufragen sein.",
      "PQ-VOB ist von der Eignungsleihe zu unterscheiden: Bei der Präqualifikation werden Nachweise des eigenen Unternehmens vorab geprüft. Bei einer Eignungsleihe stützt sich ein Bieter für ein bestimmtes Eignungskriterium auf die Kapazitäten eines anderen Unternehmens. Die Präqualifikation ist eine Möglichkeit zum Eignungsnachweis, aber keine Teilnahme- oder Zuschlagspflicht und keine Zuschlagsgarantie.",
    ],
    keyPoints: [
      "Vorgelagerte, auftragsunabhängige Prüfung bestimmter Eignungsnachweise",
      "PQ-VOB ist das amtliche Verzeichnis für präqualifizierte Bauunternehmen in Deutschland",
      "Im EU-Bereich können Präqualifizierungssysteme nach § 6b EU VOB/A ganz oder teilweise zum Nachweis dienen",
      "Auftragsbezogene und besondere Nachweise können weiterhin erforderlich sein",
      "Nicht mit Eignungsleihe oder einer Zuschlagsgarantie gleichzusetzen",
    ],
    faq: [
      {
        question: "Was ist PQ-VOB?",
        answer: "PQ-VOB ist das amtliche Verzeichnis präqualifizierter Bauunternehmen. Die Präqualifikation prüft bestimmte Eignungsnachweise vorab und unabhängig von einem einzelnen Vergabeverfahren; in der Ausschreibung kann die Eintragung als Nachweis dienen.",
      },
      {
        question: "Ist eine Präqualifikation nach PQ-VOB für Bauvergaben verpflichtend?",
        answer: "Nein. Sie ist eine Möglichkeit, bestimmte Eignungsnachweise vorab prüfen zu lassen. Unternehmen können die von der Vergabestelle verlangten Nachweise grundsätzlich auch nach den Vorgaben der konkreten Ausschreibung einreichen.",
      },
      {
        question: "Ersetzt ein PQ-VOB-Eintrag alle Nachweise in einer Ausschreibung?",
        answer: "Nein. Der Eintrag deckt nur die geprüften und hinterlegten Angaben ab. Zusätzliche Bescheinigungen und auftragsbezogene Nachweise können nach dem anwendbaren Regelwerk und den Vergabeunterlagen weiterhin verlangt werden.",
      },
      {
        question: "Garantiert die Präqualifikation den Zuschlag?",
        answer: "Nein. Sie erleichtert den Nachweis bestimmter Eignungsmerkmale, ersetzt aber weder die Prüfung aller Anforderungen des konkreten Auftrags noch die Angebotswertung. Der Zuschlag richtet sich nach den bekannt gemachten Kriterien und dem anwendbaren Vergaberecht.",
      },
    ],
    relatedTerms: ["vob-a", "vob-a-eu", "eignungskriterien", "eignungsleihe", "eigenerklaerung", "referenzen"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [
      { title: "VOB/A – amtliche Bekanntmachung und Fassung", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "Bundesanzeiger: VOB/A Abschnitte 2 und 3, Ausgabe 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
      { title: "PQ-Verein: Informationen für Unternehmen", url: "https://www.pq-verein.de/pq-liste/informationen-fuer-unternehmen" },
      { title: "PQ-Verein: Präqualifizierungsstellen", url: "https://www.pq-verein.de/praequalifizierungsstellen" },
    ],
    lastReviewed: "2026-10-22",
  },
  {
    slug: "eignungsleihe",
    term: "Eignungsleihe",
    category: "Eignung & Zuschlag",
    shortDefinition: "Bei einer Eignungsleihe weist ein Bewerber oder Bieter seine Leistungsfähigkeit mit tatsächlich verfügbaren Kapazitäten eines anderen Unternehmens nach.",
    definition: [
      "Bei der Eignungsleihe stützt sich ein Bewerber oder Bieter für ein bekannt gemachtes Eignungskriterium auf die wirtschaftlichen, technischen oder beruflichen Kapazitäten eines anderen Unternehmens. Das ist grundsätzlich auch möglich, wenn zwischen beiden Unternehmen keine gesellschaftsrechtliche Verbindung besteht. Der Bieter muss aber belegen, dass ihm die benötigten Mittel für den konkreten Auftrag tatsächlich zur Verfügung stehen.",
      "Für Vergaben im Anwendungsbereich der VgV regelt § 47 die Eignungsleihe. Bauaufträge sind wegen § 2 VgV gesondert einzuordnen: Für EU-weite Bauvergaben enthält § 6d EU VOB/A die einschlägigen Vorgaben; die VgV gilt für Planungsleistungen, die als Los eines Bauauftrags vergeben werden. Der Auftraggeber prüft nach dem jeweils anwendbaren Regelwerk die Eignung und mögliche Ausschlussgründe des Kapazitätsgebers und kann beziehungsweise muss dessen Ersetzung verlangen, wenn Anforderungen nicht erfüllt sind oder Ausschlussgründe vorliegen.",
      "Besondere Anforderungen gelten für berufliche Befähigung und Erfahrung: Werden solche Kapazitäten in Anspruch genommen, muss das andere Unternehmen die Arbeiten ausführen, für die diese Fähigkeiten oder Erfahrungen benötigt werden. Bei wirtschaftlicher und finanzieller Leistungsfähigkeit kann eine gemeinsame Haftung für die Auftragsausführung verlangt werden.",
      "Eignungsleihe ist nicht dasselbe wie eine Bietergemeinschaft oder ein Nachunternehmerverhältnis. Bei der Eignungsleihe bleibt das Unternehmen, das die Kapazität nutzt, selbst Bewerber oder Bieter und weist damit seine Eignung nach. Eine Bietergemeinschaft gibt dagegen gemeinsam ein Angebot ab. Ein Kapazitätsgeber kann zugleich Nachunternehmer sein, aber die Rollen sind nicht automatisch deckungsgleich. Unterhalb der EU-Schwellenwerte richten sich Möglichkeit und Anforderungen nach dem jeweils eingeführten Regelwerk; § 47 VgV gilt dort nicht pauschal.",
    ],
    keyPoints: [
      "Kapazitäten anderer Unternehmen können für bestimmte Eignungskriterien genutzt werden",
      "Die tatsächlich verfügbare Ressource muss für den konkreten Auftrag nachgewiesen werden",
      "Bei beruflicher Befähigung oder Erfahrung muss der Kapazitätsgeber die betreffenden Arbeiten ausführen",
      "Nicht mit Bietergemeinschaft oder Nachunternehmerverhältnis gleichzusetzen",
      "Unterhalb der EU-Schwellenwerte gilt das jeweils eingeführte Regelwerk",
    ],
    faq: [
      {
        question: "Was bedeutet Eignungsleihe bei einer Ausschreibung?",
        answer: "Ein Bewerber oder Bieter nutzt die wirtschaftlichen, technischen oder beruflichen Kapazitäten eines anderen Unternehmens, um ein bekannt gemachtes Eignungskriterium zu erfüllen. Er muss nachweisen, dass ihm die nötigen Mittel für den Auftrag tatsächlich zur Verfügung stehen.",
      },
      {
        question: "Kann ich für Referenzen oder Berufserfahrung die Kapazitäten eines anderen Unternehmens nutzen?",
        answer: "Das kann nach den einschlägigen Regeln möglich sein. Wird berufliche Erfahrung oder Befähigung geliehen, muss das andere Unternehmen grundsätzlich die Arbeiten ausführen, für die diese Kapazität benötigt wird. Maßgeblich sind das anwendbare Regelwerk und die Vergabeunterlagen.",
      },
      {
        question: "Ist der Kapazitätsgeber automatisch mein Nachunternehmer?",
        answer: "Nein. Eignungsleihe betrifft den Nachweis der Eignung, ein Nachunternehmerverhältnis die Ausführung von Teilleistungen. Ein Unternehmen kann beide Rollen übernehmen; das folgt aber nicht automatisch aus der Eignungsleihe.",
      },
      {
        question: "Gilt § 47 VgV auch bei Unterschwellenvergaben?",
        answer: "Nicht pauschal. Unterhalb der EU-Schwellenwerte kommt es darauf an, welches Bundes-, Landes- oder Haushaltsregelwerk für den Auftraggeber und die Leistung eingeführt ist.",
      },
    ],
    relatedTerms: ["eignungskriterien", "referenzen", "nachunternehmer", "bietergemeinschaft", "vob-a", "vob-a-eu", "praequalifikation-pq-vob"],
    relatedArticles: ["vob-vergabe", "bietergemeinschaft-gruenden"],
    sources: [
      { title: "§ 47 VgV – Eignungsleihe", url: "https://www.gesetze-im-internet.de/vgv_2016/__47.html" },
      { title: "§ 2 VgV – Vergabe von Bauaufträgen", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "VOB/A, Abschnitte 2 und 3, Ausgabe 2026 (BAnz AT 24.08.2026 B6)", url: "https://www.bundesanzeiger.de/pub/publication/73xO0rpP1jfX5HRt0Ja/content/73xO0rpP1jfX5HRt0Ja/BAnz%20AT%2024.08.2026%20B6.pdf?inline" },
    ],
    lastReviewed: "2026-10-06",
  },
  {
    slug: "zuschlagskriterien",
    term: "Zuschlagskriterien",
    category: "Eignung & Zuschlag",
    shortDefinition: "Zuschlagskriterien sind die Kriterien, anhand derer der Auftraggeber das wirtschaftlichste Angebot ermittelt und den Zuschlag erteilt.",
    definition: [
      "Zuschlagskriterien sind die Maßstäbe, anhand derer der Auftraggeber nach Abschluss der Eignungsprüfung das wirtschaftlichste Angebot ermittelt und den Zuschlag erteilt. Sie entscheiden also darüber, welcher Bieter den Auftrag erhält.",
      "Die wichtigsten Zuschlagskriterien sind: Preis, Qualität, technischer Wert, Ästhetik, Umwelteigenschaften, Laufzeitkosten und Kundenservice. Der Preis ist ein zentrales Kriterium, aber nicht das einzige: Das wirtschaftlichste Angebot ergibt sich aus dem besten Preis-Leistungs-Verhältnis.",
      "Die Zuschlagskriterien und ihre Gewichtung müssen vorab in der Bekanntmachung oder in den Vergabeunterlagen veröffentlicht werden. Die Gewichtung kann als Punkteverteilung oder Prozentanteil erfolgen. Eine nachträgliche Änderung ist nicht zulässig.",
    ],
    keyPoints: [
      "Kriterien für die Ermittlung des wirtschaftlichsten Angebots",
      "Umfassen Preis, Qualität, technischen Wert, Nachhaltigkeit",
      "Müssen vorab veröffentlicht und gewichtet werden",
      "Beste Preis-Leistungs-Verhältnis entscheidet, nicht nur der Preis",
    ],
    faq: [
      {
        question: "Was sind Zuschlagskriterien?",
        answer: "Zuschlagskriterien sind die Maßstäbe, anhand derer der Auftraggeber das wirtschaftlichste Angebot ermittelt. Sie umfassen Preis, Qualität, technischen Wert und andere Aspekte. Die Kriterien und ihre Gewichtung müssen vorab veröffentlicht werden.",
      },
      {
        question: "Bekommt immer das günstigste Angebot den Zuschlag?",
        answer: "Nein, der Zuschlag geht an das wirtschaftlichste Angebot. Das muss nicht das günstigste sein, wenn andere Kriterien wie Qualität, Nachhaltigkeit oder technischer Wert berücksichtigt werden. Die Gewichtung der Kriterien entscheidet.",
      },
    ],
    relatedTerms: ["eignungskriterien", "zuschlag", "angebot", "nachforderung-unterlagen"],
  },
  {
    slug: "eigenerklaerung",
    term: "Eigenerklärung (EEE)",
    category: "Eignung & Zuschlag",
    shortDefinition: "Die Einheitliche Europäische Eigenerklärung (EEE) ist ein Standardformular, das Bieter zur Eignungsprüfung ausfüllen.",
    definition: [
      "Die Einheitliche Europäische Eigenerklärung (EEE) ist ein standardisiertes Formular, das im Rahmen von öffentlichen Vergabeverfahren in der EU verwendet wird. Der Bieter erklärt damit seine Eignung für den Auftrag, ohne im ersten Schritt Nachweise vorlegen zu müssen.",
      "Die EEE umfasst Erklärungen zu Ausschlussgründen sowie zur Befähigung, Fachkunde und Leistungsfähigkeit. Ob sie verwendet werden kann oder verlangt wird, richtet sich nach dem konkreten Verfahren und den anwendbaren Vergabevorschriften.",
      "Der Auftraggeber kann die Richtigkeit der Eigenerklärung jederzeit überprüfen, in der Regel vor der Zuschlagserteilung an den erfolgreichen Bieter. Falsche Angaben können zum Angebotsausschluss führen.",
    ],
    keyPoints: [
      "Standardisiertes Formular zur Eignungsklärung",
      "Standardisierte vorläufige Eigenerklärung im EU-Vergaberecht",
      "Selbsterklärung statt sofortiger Nachweisvorlage",
      "Überprüfbar bei Zuschlagserteilung",
    ],
    faq: [
      {
        question: "Was ist die Einheitliche Europäische Eigenerklärung (EEE)?",
        answer: "Die EEE ist ein standardisiertes Formular, mit dem ein Unternehmen im Rahmen der Eignungsprüfung unter anderem Ausschlussgründe sowie Befähigung, Fachkunde und Leistungsfähigkeit vorläufig erklärt. Die Verwendung richtet sich nach dem konkreten Verfahren.",
      },
      {
        question: "Müssen Nachweise vorgelegt werden?",
        answer: "Die EEE ist eine vorläufige Selbsterklärung. Der Auftraggeber kann Nachweise nach den anwendbaren Vorschriften und den Vergabeunterlagen verlangen; das ist nicht auf einen einzigen Zeitpunkt oder ausschließlich den erfolgreichen Bieter beschränkt.",
      },
    ],
    relatedTerms: ["eignungskriterien", "referenzen", "praequalifikation-pq-vob"],
    sources: [
      { title: "§ 48 VgV – Beleg der Eignung und des Nichtvorliegens von Ausschlussgründen", url: "https://www.gesetze-im-internet.de/vgv_2016/__48.html" },
      { title: "§ 50 VgV – Einheitliche Europäische Eigenerklärung", url: "https://www.gesetze-im-internet.de/vgv_2016/__50.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "referenzen",
    term: "Referenzen",
    category: "Eignung & Zuschlag",
    shortDefinition: "Referenzen sind Nachweise über ähnliche Leistungen, die ein Bieter in der Vergangenheit erbracht hat. Sie sind ein zentrales Eignungskriterium.",
    definition: [
      "Referenzen sind Nachweise über bereits erbrachte Leistungen, die ein Bieter in der Vergangenheit durchgeführt hat. Sie sind ein zentrales Eignungskriterium und dienen dem Auftraggeber als Nachweis, dass der Bieter die fachliche Befähigung für die zu vergebende Leistung besitzt.",
      "Referenzen müssen in der Regel vergleichbare Leistungen mit dem zu vergebenden Auftrag aufweisen (Art, Umfang, Komplexität). Der Bieter muss angeben, für wen, wann und in welchem Umfang die Leistung erbracht wurde, sowie Referenzkontakte.",
      "Die geforderten Referenzen müssen transparent und angemessen sein. Der Auftraggeber kann nicht willkürlich Anforderungen stellen, sondern muss einen klaren Bezug zur zu vergebenden Leistung herstellen. Übermäßige Referenzanforderungen können als Wettbewerbsbarriere angesehen werden.",
    ],
    keyPoints: [
      "Nachweis über ähnliche, bereits erbrachte Leistungen",
      "Zentrales Eignungskriterium",
      "Muss vergleichbar mit dem zu vergebenden Auftrag sein",
      "Anforderungen müssen transparent und angemessen sein",
    ],
    faq: [
      {
        question: "Welche Referenzen werden bei Ausschreibungen verlangt?",
        answer: "Die geforderten Referenzen hängen von der Ausschreibung ab. Generell werden Nachweise über vergleichbare Leistungen (Art, Umfang, Komplexität) verlangt. Der Bieter muss angeben, für wen, wann und in welchem Umfang die Leistung erbracht wurde.",
      },
      {
        question: "Kann man ohne Referenzen an Ausschreibungen teilnehmen?",
        answer: "Referenzen sind in der Regel ein Eignungskriterium. Ohne passende Referenzen kann der Ausschluss drohen. Eine Möglichkeit ist die Beteiligung an einer Bietergemeinschaft mit einem Partner, der die Referenzen mitbringt.",
      },
    ],
    relatedTerms: ["eignungskriterien", "eigenerklaerung", "praequalifikation-pq-vob"],
  },

  // === SCHWELLENWERTE ===
  {
    slug: "schwellenwerte",
    term: "Schwellenwerte",
    category: "Schwellenwerte",
    shortDefinition: "Schwellenwerte sind finanzielle Grenzen, ab denen im jeweils einschlägigen Anwendungsbereich die Regeln des EU-Oberschwellenbereichs greifen.",
    definition: [
      "Schwellenwerte sind zentrale vergaberechtliche Grenzwerte, die bestimmen, ab welchem Auftragswert die vergaberechtlichen Vorschriften des europäischen Vergaberechts (Oberschwellenbereich) gelten. Unterhalb der Schwellenwerte gilt das nationale Vergaberecht (Unterschwellenbereich).",
      "Die Schwellenwerte werden von der Europäischen Kommission alle zwei Jahre überprüft und angepasst. Sie unterscheiden sich nach Auftragsart (Lieferungen, Dienstleistungen, Bauleistungen) und Auftraggeberart (klassische Auftraggeber, Sektorenauftraggeber).",
      "Für 2026/2027 gelten je nach Auftraggeber und Leistungsart unterschiedliche EU-Schwellenwerte. Beispiele sind 140.000 EUR für Liefer- und Dienstleistungsaufträge zentraler Regierungsbehörden im Sinne von § 106 Absatz 2 Nummer 1 GWB, 216.000 EUR für entsprechende Aufträge anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU, 432.000 EUR für Liefer- und Dienstleistungen von Sektorenauftraggebern und 5.404.000 EUR für Bauaufträge klassischer Auftraggeber.",
    ],
    keyPoints: [
      "Grenzwert zwischen Ober- und Unterschwellenbereich",
      "Werden alle 2 Jahre von der EU-Kommission angepasst",
      "2026/2027: 140.000 EUR für die erfassten zentralen Regierungsbehörden, 216.000 EUR für andere Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU",
      "2026/2027: 432.000 EUR für Liefer- und Dienstleistungsaufträge von Sektorenauftraggebern",
      "2026/2027: 5.404.000 EUR für Bauaufträge klassischer Auftraggeber",
    ],
    faq: [
      {
        question: "Welche EU-Schwellenwerte gelten 2026 und 2027?",
        answer: "Für 2026 und 2027 gelten je nach Auftraggeber und Auftragsart unterschiedliche Werte. Die zentralen Kontrollwerte sind 140.000 EUR für Liefer- und Dienstleistungsaufträge zentraler Regierungsbehörden im Sinne von § 106 Absatz 2 Nummer 1 GWB, 216.000 EUR für entsprechende Aufträge anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU, 432.000 EUR für Liefer- und Dienstleistungen von Sektorenauftraggebern sowie 5.404.000 EUR für Bauaufträge klassischer Auftraggeber; Konzessionen liegen ebenfalls bei 5.404.000 EUR.",
      },
      {
        question: "Was passiert bei Überschreitung des Schwellenwerts?",
        answer: "Bei Überschreitung des einschlägigen Schwellenwerts gelten die Regeln des Oberschwellenbereichs. Dazu gehören im jeweiligen Anwendungsbereich die unionsweite Bekanntmachung und die Vorschriften des vierten Teils des GWB. Bei Liefer- und Dienstleistungen ist regelmäßig die VgV maßgeblich; bei Bauaufträgen gelten VOB/A Abschnitt 2 und die nach § 2 VgV anwendbaren Vorschriften. Unter den gesetzlichen Voraussetzungen ist ein Nachprüfungsverfahren nach dem GWB möglich.",
      },
      {
        question: "Wie wird der Auftragswert berechnet?",
        answer: "Der Auftragswert wird nach der jeweils einschlägigen Berechnungsvorschrift als geschätzter Gesamtwert ohne Umsatzsteuer ermittelt. Optionen, Verlängerungen, Lose und wiederkehrende Leistungen können einzubeziehen sein; entscheidend sind Auftragsart, Laufzeit und das anwendbare Regelwerk.",
      },
    ],
    relatedTerms: ["auftragswert", "losvergabe", "vgv-vergabeverordnung", "uvgo", "vob-a", "vob-a-eu", "gwb-vergaberecht", "eu-vergaberichtlinien"],
    relatedArticles: ["schwellenwerte-vergabe", "vob-vergabe"],
    sources: [
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "Bundesanzeiger: EU-Schwellenwerte ab 1. Januar 2026", url: "https://www.bundesanzeiger.de/pub/publication/zDKvMODHbpcIPpDPapc/content/zDKvMODHbpcIPpDPapc/BAnz%20AT%2018.12.2025%20B4.pdf?inline" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
      { title: "Delegierte Verordnung (EU) 2025/2152", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2152" },
      { title: "Delegierte Verordnung (EU) 2025/2151 für Konzessionen", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2151" },
      { title: "Delegierte Verordnung (EU) 2025/2150 für Sektorenauftraggeber", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32025R2150" },
    ],
    lastReviewed: "2026-09-29",
  },
  {
    slug: "auftragswert",
    term: "Auftragswert",
    category: "Schwellenwerte",
    shortDefinition: "Der Auftragswert ist der geschätzte Gesamtwert eines öffentlichen Auftrags. Er entscheidet über die Anwendung ober- oder unterschwelliger Vorschriften.",
    definition: [
      "Der Auftragswert ist der geschätzte Gesamtwert eines öffentlichen Auftrags. Er ist maßgeblich für die Bestimmung, ob die Vorgaben des Ober- oder Unterschwellenbereichs anwendbar sind. Die Berechnung muss nach den für den Auftrag geltenden Vorschriften nachvollziehbar erfolgen.",
      "In die Schätzung können insbesondere Optionen, Verlängerungen, Prämien und Zahlungen einfließen, soweit die einschlägige Vorschrift dies vorsieht. Der Wert wird vor Beginn des Vergabeverfahrens ohne Umsatzsteuer geschätzt und dokumentiert.",
      "Die Berechnungsmethode hängt von Auftragsart, Laufzeit, Losen und dem anwendbaren Regelwerk ab. Bei Bauaufträgen ist nicht pauschal jede Planung einzubeziehen; maßgeblich ist, was zum konkreten Beschaffungsvorhaben und seiner Wertberechnung gehört.",
    ],
    keyPoints: [
      "Geschätzter Gesamtwert eines öffentlichen Auftrags",
      "Entscheidet über Ober- oder Unterschwellenbereich",
      "Optionen und Verlängerungen nach der jeweils einschlägigen Berechnungsvorschrift berücksichtigen",
      "Vorab zu schätzen und zu dokumentieren",
    ],
    faq: [
      {
        question: "Wie wird der Auftragswert berechnet?",
        answer: "Der Auftragswert wird nach der für die Auftragsart geltenden Berechnungsvorschrift geschätzt. Optionen, Verlängerungen, Lose oder andere Bestandteile können einzubeziehen sein. Die Schätzung erfolgt vorab ohne Umsatzsteuer und wird dokumentiert.",
      },
      {
        question: "Warum ist der Auftragswert wichtig?",
        answer: "Der Auftragswert entscheidet darüber, ob die Vorgaben des Ober- oder Unterschwellenbereichs anwendbar sind. Oberhalb des einschlägigen EU-Schwellenwerts gelten im passenden Anwendungsbereich strengere Regeln, etwa unionsweite Bekanntmachungs- und Nachprüfungsvorschriften. Bei Bauaufträgen ist nicht pauschal die VgV anstelle der VOB/A anzuwenden; § 2 VgV ordnet die Kombination der Regelwerke an.",
      },
    ],
    relatedTerms: ["schwellenwerte", "losvergabe", "vgv-vergabeverordnung", "uvgo", "vob-a", "vob-a-eu", "gwb-vergaberecht"],
    relatedArticles: ["schwellenwerte-vergabe"],
    sources: [
      { title: "§ 3 VgV – Schätzung des Auftragswerts", url: "https://www.gesetze-im-internet.de/vgv_2016/__3.html" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
    ],
    lastReviewed: "2026-09-17",
  },

  // === NACHPRÜFUNG ===
  {
    slug: "nachpruefungsverfahren",
    term: "Nachprüfungsverfahren",
    category: "Nachprüfung",
    shortDefinition: "Das Nachprüfungsverfahren erlaubt es Bietern, Verstöße gegen Vergabevorschriften durch öffentliche Auftraggeber zu rügen.",
    definition: [
      "Das Nachprüfungsverfahren ist ein förmliches Verfahren, das antragsbefugten Unternehmen ermöglicht, vermeintliche Verstöße gegen das Vergaberecht durch öffentliche Auftraggeber überprüfen zu lassen. Es ist im vierten Teil des GWB geregelt und betrifft grundsätzlich Vergaben in dessen Anwendungsbereich.",
      "Zuständig für das Nachprüfungsverfahren sind die Vergabekammern des Bundes und der Länder. Gegen Entscheidungen der Vergabekammer kann Beschwerde bei den Vergabesenaten der Oberlandesgerichte eingelegt werden.",
      "Vor einem Nachprüfungsantrag ist ein erkannter Verstoß grundsätzlich gegenüber dem Auftraggeber zu rügen. Für die Zulässigkeit gelten die gesetzlichen Fristen und Anforderungen, insbesondere § 160 Absatz 3 GWB. Zuständig ist die Vergabekammer, nicht ein allgemeiner Vergabenachprüfungsausschuss.",
    ],
    keyPoints: [
      "Förmliches Verfahren zur Rüge von Vergaberechtsverstößen",
      "Geregelt in §§ 155–173 GWB",
      "Zuständig: Vergabekammern von Bund und Ländern",
      "Rügepflicht: Zunächst Rüge im Vergabeverfahren",
    ],
    faq: [
      {
        question: "Was ist ein Nachprüfungsverfahren?",
        answer: "Das Nachprüfungsverfahren ist ein förmliches Verfahren, in dem Unternehmen vermeintliche Verstöße gegen das Vergaberecht durch öffentliche Auftraggeber rügen können. Zuständig sind die Vergabekammern von Bund und Ländern.",
      },
      {
        question: "Wann kann ein Nachprüfungsverfahren eingeleitet werden?",
        answer: "Ein Nachprüfungsverfahren kann eingeleitet werden, wenn ein Bieter einen Verstoß gegen Vergabevorschriften rügt. Voraussetzung ist in der Regel, dass zunächst eine Rüge im Vergabeverfahren selbst versucht wurde und diese erfolglos blieb.",
      },
      {
        question: "Wie lange dauert ein Nachprüfungsverfahren?",
        answer: "Die Dauer hängt vom konkreten Verfahren, der Auslastung und der Komplexität des Falls ab. Gegen die Entscheidung der Vergabekammer kann unter den Voraussetzungen des GWB sofortige Beschwerde beim zuständigen Oberlandesgericht eingelegt werden.",
      },
    ],
    relatedTerms: ["ruege", "vergabekammer", "vergabesenat", "gwb-vergaberecht"],
    sources: [
      { title: "§ 155 GWB – Nachprüfungsbehörden", url: "https://www.gesetze-im-internet.de/gwb/__155.html" },
      { title: "§ 160 GWB – Einleitung, Antrag", url: "https://www.gesetze-im-internet.de/gwb/__160.html" },
      { title: "§ 172 GWB – Frist, Form, Inhalt der sofortigen Beschwerde", url: "https://www.gesetze-im-internet.de/gwb/__172.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "ruege",
    term: "Rüge",
    category: "Nachprüfung",
    shortDefinition: "Die Rüge ist die formelle Beanstandung eines Vergaberechtsverstoßes durch einen Bieter gegenüber dem Auftraggeber.",
    definition: [
      "Die Rüge ist die förmliche Beanstandung eines vermuteten Vergaberechtsverstoßes durch einen Bieter gegenüber dem öffentlichen Auftraggeber. Sie ist Voraussetzung für ein späteres Nachprüfungsverfahren: Erst wenn die Rüge erfolglos bleibt, kann die Vergabekammer angerufen werden.",
      "Für Vergaben im Anwendungsbereich des vierten Teils des GWB muss ein erkannter Verstoß grundsätzlich innerhalb von zehn Kalendertagen gerügt werden. Verstöße, die aus der Bekanntmachung oder den Vergabeunterlagen erkennbar sind, müssen spätestens bis zum Ablauf der dort genannten Bewerbungs- oder Angebotsfrist gerügt werden. Der Bieter sollte den Verstoß klar und nachvollziehbar benennen.",
      "Rügen können sich auf verschiedene Aspekte beziehen: unklare Leistungsbeschreibung, unangemessene Fristen, intransparente Zuschlagskriterien, Diskriminierung von Bietern, falsche Eignungsprüfung oder unzulässige Verhandlung von Angeboten.",
    ],
    keyPoints: [
      "Formelle Beanstandung eines Vergabeverstoßes",
      "Voraussetzung für das Nachprüfungsverfahren",
      "Muss unverzüglich nach Kenntnisnahme erfolgen",
      "Auftraggeber kann den Verstoß korrigieren",
    ],
    faq: [
      {
        question: "Was ist eine Rüge im Vergabeverfahren?",
        answer: "Eine Rüge ist die konkrete Beanstandung eines vermuteten Vergaberechtsverstoßes gegenüber dem Auftraggeber. Im Anwendungsbereich des vierten Teils des GWB gelten dafür insbesondere die Fristen und Anforderungen des § 160 Absatz 3 GWB. Eine erfolglose Rüge ist grundsätzlich Voraussetzung für den späteren Nachprüfungsantrag.",
      },
      {
        question: "Wie muss eine Rüge formuliert sein?",
        answer: "Die Rüge sollte den konkreten Vorgang und den vermuteten Vergaberechtsverstoß nachvollziehbar benennen und über den vorgesehenen Kommunikationsweg übermittelt werden. Eine pauschale Unzufriedenheit reicht nicht aus; ein bestimmtes Antwort- oder Abhilfedatum ist keine allgemeine gesetzliche Voraussetzung.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "vergabekammer"],
    sources: [
      { title: "§ 160 Absatz 3 GWB – Rügefristen", url: "https://www.gesetze-im-internet.de/gwb/__160.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "vergabekammer",
    term: "Vergabekammer",
    category: "Nachprüfung",
    shortDefinition: "Die Vergabekammer ist die zuständige Behörde für die Nachprüfung von Vergabeverfahren bei Streitigkeiten zwischen Bietern und Auftraggebern.",
    definition: [
      "Die Vergabekammer ist eine beim Bundeskartellamt oder bei den Landesbehörden angesiedelte Einrichtung, die für die Nachprüfung von Vergabeverfahren zuständig ist. Sie ist die erste Instanz für Nachprüfungsanträge von Bietern, die sich gegen Entscheidungen von öffentlichen Auftraggebern wehren wollen.",
      "Die Vergabekammer prüft, ob der öffentliche Auftraggeber gegen Vergaberecht verstoßen hat, und kann im Rahmen ihrer gesetzlichen Befugnisse Maßnahmen zur Beseitigung des Verstoßes anordnen. Ein Anspruch auf Schadensersatz ist davon zu unterscheiden und wird nicht durch die Vergabekammer zugesprochen.",
      "Gegen Entscheidungen der Vergabekammer kann unter den gesetzlichen Voraussetzungen sofortige Beschwerde beim zuständigen Oberlandesgericht eingelegt werden. Die Zuständigkeit und das Verfahren ergeben sich aus dem vierten Teil des GWB.",
    ],
    keyPoints: [
      "Zuständig für die Nachprüfung von Vergabeverfahren",
      "Erste Instanz bei Nachprüfungsanträgen",
      "Kann Aufträge aufheben oder neues Verfahren anordnen",
      "Beim Bundeskartellamt oder Landesbehörden angesiedelt",
    ],
    faq: [
      {
        question: "Was ist eine Vergabekammer?",
        answer: "Die Vergabekammer ist die zuständige Behörde für die Nachprüfung von Vergabeverfahren. Sie ist beim Bundeskartellamt oder bei Landesbehörden angesiedelt und entscheidet über Nachprüfungsanträge von Bietern.",
      },
      {
        question: "Wie kann ich die Vergabekammer anrufen?",
        answer: "Die Vergabekammer wird durch einen förmlichen Nachprüfungsantrag angerufen. Voraussetzung ist in der Regel, dass der Bieter zunächst versucht hat, den Verstoß im Vergabeverfahren selbst zu rügen (Rügepflicht). Der Antrag muss innerhalb bestimmter Fristen gestellt werden.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "ruege", "vergabesenat"],
  },
  {
    slug: "vergabesenat",
    term: "Vergabesenat",
    category: "Nachprüfung",
    shortDefinition: "Der Vergabesenat beim Oberlandesgericht entscheidet über die sofortige Beschwerde gegen Entscheidungen der Vergabekammer.",
    definition: [
      "Der Vergabesenat ist beim zuständigen Oberlandesgericht angesiedelt und entscheidet über die sofortige Beschwerde gegen Entscheidungen der Vergabekammer. Der Rechtsbehelf ist keine gewöhnliche Berufung; für Frist, Form und Begründung gelten die besonderen Vorschriften des GWB.",
      "Das Oberlandesgericht kann die Entscheidung der Vergabekammer bestätigen, ändern oder aufheben und die Sache unter den gesetzlichen Voraussetzungen zurückverweisen. Die sofortige Beschwerde ist grundsätzlich binnen zwei Wochen nach Zustellung der Entscheidung einzulegen und muss anwaltlich unterzeichnet sein.",
      "Das Oberlandesgericht ist grundsätzlich die letzte Tatsachen- und Rechtsmittelinstanz. Eine Vorlage an den Bundesgerichtshof kommt insbesondere bei einer beabsichtigten Abweichung von der Entscheidung eines anderen Oberlandesgerichts oder des Bundesgerichtshofs nach den gesetzlichen Voraussetzungen in Betracht.",
    ],
    keyPoints: [
      "Vergaberechtliches Beschwerdegericht beim Oberlandesgericht (OLG)",
      "Entscheidet über die sofortige Beschwerde gegen Vergabekammer-Entscheidungen",
      "Kann Entscheidungen bestätigen, ändern oder aufheben",
      "Weitere Rechtsmittel kommen nur unter den gesetzlichen Voraussetzungen in Betracht",
    ],
    faq: [
      {
        question: "Was ist ein Vergabesenat?",
        answer: "Der Vergabesenat ist die zweite Instanz im Nachprüfungsverfahren, angesiedelt bei den Oberlandesgerichten. Er entscheidet über Beschwerden gegen Entscheidungen der Vergabekammern und kann diese bestätigen, ändern oder aufheben.",
      },
      {
        question: "Kann man gegen Vergabesenatsentscheidungen vorgehen?",
        answer: "Ein weiteres allgemeines Rechtsmittel steht nicht automatisch offen. Eine Vorlage an den Bundesgerichtshof kann unter den besonderen Voraussetzungen des § 179 Absatz 2 GWB erforderlich sein; das hängt von der konkreten Entscheidung und einer möglichen Abweichung in einer Rechtsfrage ab.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "vergabekammer"],
    sources: [
      { title: "§ 172 GWB – Frist, Form, Inhalt der sofortigen Beschwerde", url: "https://www.gesetze-im-internet.de/gwb/__172.html" },
      { title: "§ 179 GWB – Bindungswirkung und Vorlagepflicht", url: "https://www.gesetze-im-internet.de/gwb/__179.html" },
    ],
    lastReviewed: "2026-09-27",
  },

  // === TECHNIK & STANDARDS ===
  {
    slug: "cpv-code",
    term: "CPV-Code",
    category: "Technik & Standards",
    shortDefinition: "Der CPV-Code (Common Procurement Vocabulary) ist ein standardisiertes Klassifizierungssystem für öffentliche Aufträge in der EU.",
    definition: [
      "Der CPV-Code (Common Procurement Vocabulary, Gemeinsames Vokabular für öffentliche Aufträge) ist ein standardisiertes Klassifizierungssystem der Europäischen Union für öffentliche Aufträge. Er ermöglicht eine einheitliche Kategorisierung und Vergleichbarkeit von Ausschreibungen EU-weit.",
      "Der CPV-Code besteht aus einem 8-stelligen numerischen Code (9 Stellen mit Prüfziffer), der die Art der Leistung präzise beschreibt. Die ersten zwei Stellen identifizieren die Abteilung (Division), die nächsten die Gruppe, Klasse und Kategorie. Zusätzlich gibt es ein ergänzendes Vokabular für weitere Spezifizierungen.",
      "CPV-Codes sind für die Erstellung von Vergabebekanntmachungen verpflichtend. Sie ermöglichen es Bietern, gezielt nach für sie relevanten Aufträgen zu suchen und Vergaben europaweit zu vergleichen.",
    ],
    keyPoints: [
      "Standardisiertes Klassifizierungssystem der EU",
      "8-stelliger numerischer Code für Auftragsarten",
      "Verpflichtend für Vergabebekanntmachungen",
      "Ermöglicht EU-weite Vergleichbarkeit von Ausschreibungen",
    ],
    faq: [
      {
        question: "Was ist ein CPV-Code?",
        answer: "Ein CPV-Code (Common Procurement Vocabulary) ist ein 8-stelliges Klassifizierungssystem der EU für öffentliche Aufträge. Er ermöglicht eine einheitliche Kategorisierung und Vergleichbarkeit von Ausschreibungen EU-weit.",
      },
      {
        question: "Wie ist ein CPV-Code aufgebaut?",
        answer: "Der CPV-Code besteht aus 8 Ziffern: Die ersten zwei identifizieren die Abteilung (z.B. 45 = Bauarbeiten), die folgenden Ziffern die Gruppe, Klasse und Kategorie. Zusätzlich gibt es ein ergänzendes Vokabular für genauere Spezifizierungen.",
      },
      {
        question: "Wo finde ich CPV-Codes?",
        answer: "CPV-Codes werden von der EU-Kommission veröffentlicht und auf TED (Tenders Electronic Daily) verwendet. Tenderhunter bietet eine CPV-Code-Suche, mit der Sie die für Ihre Leistungen relevanten Codes schnell finden.",
      },
    ],
    relatedTerms: ["eforms", "eu-vergaberichtlinien", "ted"],
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Lieferung"],
  },
  {
    slug: "eforms",
    term: "eForms",
    category: "Technik & Standards",
    shortDefinition: "eForms ist der EU-Standard für strukturierte elektronische Vergabebekanntmachungen, der seit 2023 für unionsrechtlich erfasste Bekanntmachungen eingesetzt wird.",
    definition: [
      "eForms ist ein neuer, standardisierter elektronischer Standard für Vergabebekanntmachungen in der Europäischen Union. Er löst die bisherigen Formulare (wie die Standardformulare für Bekanntmachungen) ab und soll die Transparenz, Vergleichbarkeit und Auffindbarkeit von Vergabeverfahren verbessern.",
      "eForms basiert auf einem strukturierten XML-Format und ermöglicht die maschinenlesbare Verarbeitung von Bekanntmachungen. Dadurch können Ausschreibungen leichter durchsucht, gefiltert und analysiert werden — ein Vorteil sowohl für Auftraggeber als auch für Bieter.",
      "eForms werden seit dem 25. Oktober 2023 für die unionsrechtlich erfassten Bekanntmachungen eingesetzt. Die konkrete Umsetzung erfolgt über die zuständigen elektronischen Vergabesysteme und die jeweils geltenden Bekanntmachungspflichten.",
    ],
    keyPoints: [
      "Neuer EU-Standard für Vergabebekanntmachungen",
      "Löst bisherige Standardformulare ab",
      "Maschinenlesbares XML-Format",
      "Seit 2023 unionsweit maßgeblicher Bekanntmachungsstandard",
    ],
    faq: [
      {
        question: "Was sind eForms?",
        answer: "eForms ist der EU-Standard für strukturierte elektronische Vergabebekanntmachungen. Die Formulare basieren auf maschinenlesbaren Daten und verbessern Transparenz und Auffindbarkeit.",
      },
      {
        question: "Ab wann sind eForms verpflichtend?",
        answer: "Für unionsrechtlich erfasste Bekanntmachungen sind eForms seit dem 25. Oktober 2023 der maßgebliche Standard. Welche Bekanntmachung konkret erforderlich ist, richtet sich weiterhin nach dem Verfahren und den geltenden Bekanntmachungsregeln.",
      },
    ],
    relatedTerms: ["cpv-code", "eu-vergaberichtlinien", "gaeb"],
    sources: [
      { title: "Durchführungsverordnung (EU) 2019/1780 – eForms", url: "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32019R1780" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "gaeb",
    term: "GAEB",
    category: "Technik & Standards",
    shortDefinition: "GAEB (Gemeinsamer Ausschuss Elektronik im Bauwesen) ist der deutsche Standard für den elektronischen Austausch von Leistungsverzeichnissen.",
    definition: [
      "GAEB (Gemeinsamer Ausschuss Elektronik im Bauwesen) ist ein Standard für den elektronischen Austausch von Leistungsverzeichnissen, Ausschreibungen und Abrechnungen im deutschen Bauwesen. Er ermöglicht eine reibungslose Datenübertragung zwischen Auftraggebern, Bietern und Auftragnehmern.",
      "GAEB-Dateien sind XML-basiert und enthalten alle Informationen eines Leistungsverzeichnisses: Positionen, Mengen, Einheiten, Preise und Beschreibungen. Der Standard wird kontinuierlich weiterentwickelt und ist heute ein unverzichtbares Werkzeug für die elektronische Bauabwicklung.",
      "Die Nutzung von GAEB ist in vielen öffentlichen Vergaben Standard oder gar verpflichtend. Bauunternehmen und Architekten arbeiten in der Regel mit GAEB-fähiger Software, die den Austausch der Dateien ermöglicht.",
    ],
    keyPoints: [
      "Standard für elektronischen Austausch von Leistungsverzeichnissen",
      "XML-basiert, für Bauwesen entwickelt",
      "Ermöglicht nahtlosen Datenaustausch zwischen allen Beteiligten",
      "In öffentlichen Vergaben oft Standard oder verpflichtend",
    ],
    faq: [
      {
        question: "Was ist GAEB?",
        answer: "GAEB (Gemeinsamer Ausschuss Elektronik im Bauwesen) ist ein Standard für den elektronischen Austausch von Leistungsverzeichnissen, Ausschreibungen und Abrechnungen im deutschen Bauwesen. Er ermöglicht eine reibungslose Datenübertragung.",
      },
      {
        question: "Welche Software unterstützt GAEB?",
        answer: "GAEB wird von vielen Branchen-Softwarelösungen für das Bauwesen unterstützt, darunter Angebotssysteme, LV-Software und Kalkulationsprogramme. Die Software kann GAEB-Dateien importieren, bearbeiten und exportieren.",
      },
    ],
    relatedTerms: ["leistungsverzeichnis", "leistungsbeschreibung"],
    relatedCategories: ["Bauarbeiten", "Tiefbau"],
  },
  {
    slug: "ted",
    term: "TED (Tenders Electronic Daily)",
    category: "Technik & Standards",
    shortDefinition: "TED ist das offizielle Vergabeportal der Europäischen Union für die Veröffentlichung von Oberschwellenvergaben.",
    definition: [
      "TED (Tenders Electronic Daily) ist das offizielle Online-Portal der Europäischen Union für unionsrechtlich vorgeschriebene Vergabebekanntmachungen. Bekanntmachungspflichtige Vergaben im EU-Oberschwellenbereich werden dort grundsätzlich veröffentlicht; Ausnahmen und besondere Regelwerke sind anhand des konkreten Verfahrens zu prüfen.",
      "Das Portal wird vom Amt für Veröffentlichungen der Europäischen Union betrieben und ist kostenlos nutzbar. Es bietet eine Suchfunktion, mit der Bieter gezielt nach Aufträgen filtern können — nach Land, CPV-Code, Auftragsart und anderen Kriterien.",
      "Neben Bekanntmachungen bietet TED auch Informationen über Zuschlagserteilungen, Korrekturen und Verfahrensaufhebungen. Für Unternehmen mit internationaler Ausrichtung ist TED eine unverzichtbare Informationsquelle.",
    ],
    keyPoints: [
      "Offizielles EU-Vergabeportal",
      "Portal für unionsrechtlich vorgeschriebene Bekanntmachungen",
      "Kostenlose Nutzung für Bieter",
      "Suche nach Land, CPV-Code, Auftragsart möglich",
    ],
    faq: [
      {
        question: "Was ist TED?",
        answer: "TED (Tenders Electronic Daily) ist das offizielle Vergabeportal der Europäischen Union für unionsrechtlich vorgeschriebene Bekanntmachungen. Es ist kostenlos nutzbar und bietet vielfältige Suchfunktionen.",
      },
      {
        question: "Müssen alle Ausschreibungen auf TED veröffentlicht werden?",
        answer: "Nein. Auf TED werden grundsätzlich die unionsrechtlich bekanntmachungspflichtigen Vergaben veröffentlicht. Unterschwellenvergaben werden regelmäßig national oder regional bekannt gemacht; für Ausnahmen und besondere Auftraggeber gelten die jeweiligen Vorschriften.",
      },
    ],
    relatedTerms: ["eu-vergaberichtlinien", "schwellenwerte", "cpv-code"],
    sources: [
      { title: "TED – Tenders Electronic Daily der Europäischen Union", url: "https://ted.europa.eu/de/" },
    ],
    lastReviewed: "2026-09-27",
  },

  {
    slug: "e-vergabe",
    term: "E-Vergabe (elektronische Vergabe)",
    category: "Technik & Standards",
    shortDefinition: "E-Vergabe bezeichnet die elektronische Durchführung von Vergabeverfahren: von der Bereitstellung der Unterlagen über die Kommunikation bis zur Angebotsabgabe.",
    definition: [
      "Bei der E-Vergabe werden die wesentlichen Verfahrensschritte elektronisch über ein Vergabeportal abgewickelt. Dazu gehören insbesondere der Zugang zu Bekanntmachung und Vergabeunterlagen, Bieterfragen, Antworten und die Einreichung von Teilnahmeanträgen oder Angeboten.",
      "Für EU-Vergaben verlangt die VgV grundsätzlich die Verwendung elektronischer Kommunikationsmittel. Die konkrete Bedienung, Dateiformate, Fristen und Anforderungen an Signatur oder Authentifizierung ergeben sich aus der Bekanntmachung und den Vergabeunterlagen des jeweiligen Verfahrens.",
      "E-Vergabe ist nicht dasselbe wie ein einzelnes Portal. Auftraggeber können unterschiedliche Plattformen einsetzen; für Bieter ist deshalb entscheidend, sich am angegebenen System zu registrieren, die Unterlagen vollständig herunterzuladen und die elektronische Übermittlung rechtzeitig zu testen.",
    ],
    keyPoints: [
      "Elektronische Bereitstellung, Kommunikation und Einreichung",
      "Portal und technische Anforderungen stehen in der Bekanntmachung",
      "Fristgerechter Upload liegt im Verantwortungsbereich des Bieters",
      "Nicht jedes Vergabeportal funktioniert mit demselben Konto oder Dateiformat",
    ],
    faq: [
      { question: "Was bedeutet E-Vergabe?", answer: "E-Vergabe bedeutet, dass ein Vergabeverfahren ganz oder in seinen wesentlichen Schritten elektronisch über ein Vergabeportal durchgeführt wird. Dazu zählen insbesondere Unterlagen, Kommunikation und die Abgabe von Teilnahmeanträgen oder Angeboten." },
      { question: "Muss ein Angebot elektronisch abgegeben werden?", answer: "Ob und in welcher Form ein Angebot elektronisch einzureichen ist, ergibt sich aus dem anwendbaren Regelwerk und den konkreten Vergabeunterlagen. Bei EU-Vergaben ist die elektronische Kommunikation grundsätzlich vorgesehen; die Bekanntmachung nennt die maßgebliche Plattform und die technischen Vorgaben." },
      { question: "Was sollten Bieter bei der E-Vergabe prüfen?", answer: "Bieter sollten Registrierung, Benutzerrechte, Dateiformate, Größenlimits, erforderliche Signaturen und die tatsächliche Übermittlung vor Fristablauf prüfen. Eine bloße Speicherung als Entwurf ersetzt die erfolgreiche Einreichung nicht." },
    ],
    relatedTerms: ["vergabeunterlagen", "teilnahmewettbewerb", "eforms", "ted", "angebot", "nachforderung-unterlagen"],
    relatedArticles: ["wie-funktioniert-ausschreibung", "vergabeverfahren-uebersicht", "vergabeportal-vergleich", "eu-vergabe"],
    sources: [
      { title: "§ 9 VgV – Grundsätze der Kommunikation", url: "https://www.gesetze-im-internet.de/vgv_2016/__9.html" },
      { title: "§ 10 VgV – Anforderungen an elektronische Mittel", url: "https://www.gesetze-im-internet.de/vgv_2016/__10.html" },
      { title: "§ 11 VgV – Anforderungen an elektronische Kommunikation", url: "https://www.gesetze-im-internet.de/vgv_2016/__11.html" },
    ],
    lastReviewed: "2026-09-24",
  },
  {
    slug: "vergabeunterlagen",
    term: "Vergabeunterlagen",
    category: "Vergabeprozess",
    shortDefinition: "Vergabeunterlagen enthalten die Informationen und Bedingungen, die Unternehmen für die Entscheidung über eine Teilnahme und die Erstellung eines Angebots benötigen.",
    definition: [
      "Zu den Vergabeunterlagen gehören je nach Verfahren unter anderem die Aufforderung zur Angebotsabgabe oder zur Teilnahme, Vertragsbedingungen, Leistungsbeschreibung, Leistungsverzeichnis, Formblätter, Eignungsanforderungen und Zuschlagskriterien.",
      "Die Unterlagen müssen die Anforderungen des konkreten Auftrags so klar beschreiben, dass Unternehmen ihre Teilnahmeentscheidung treffen und vergleichbare Angebote abgeben können. Maßgeblich sind immer die Unterlagen der konkreten Vergabestelle; eine allgemeine Musterliste ersetzt sie nicht.",
      "Bieter sollten die Unterlagen vollständig herunterladen, Fristen und Nachweise in einer Checkliste erfassen und Unklarheiten innerhalb der vorgesehenen Frist über das Vergabeportal fragen. Änderungen oder Antworten der Vergabestelle können die ursprünglichen Unterlagen ergänzen.",
    ],
    keyPoints: [
      "Leistungsbeschreibung und Leistungsverzeichnis bilden den fachlichen Kern",
      "Eignungs- und Zuschlagskriterien müssen für das Angebot erkennbar sein",
      "Vertragsbedingungen und Formblätter gehören zum Gesamtpaket",
      "Nachträge, Antworten und Änderungen im Portal mitprüfen",
    ],
    faq: [
      { question: "Was gehört zu den Vergabeunterlagen?", answer: "Das hängt vom Verfahren ab. Typisch sind Aufforderung, Leistungsbeschreibung, Leistungsverzeichnis, Vertragsbedingungen, Formblätter, Eignungsanforderungen, Zuschlagskriterien sowie weitere Anlagen wie Pläne oder Gutachten." },
      { question: "Wo finde ich die Vergabeunterlagen?", answer: "Die Bekanntmachung nennt die zuständige Vergabeplattform und den Zugang. Bei elektronischen Verfahren werden die Unterlagen dort bereitgestellt; Bieter sollten auch spätere Antworten und Änderungen im selben Verfahren abrufen." },
      { question: "Was tun bei unklaren Vergabeunterlagen?", answer: "Unklarheiten sollten innerhalb der angegebenen Frist über den vorgesehenen Kommunikationsweg als Bieterfrage gestellt werden. Die Antwort kann für alle Bieter relevant sein und die Unterlagen ergänzen oder erläutern." },
    ],
    relatedTerms: ["leistungsbeschreibung", "leistungsverzeichnis", "e-vergabe", "eignungskriterien", "zuschlagskriterien", "bieterfragen", "nachforderung-unterlagen"],
    relatedArticles: ["ausschreibung-schreiben", "ausschreibung-muster", "wie-funktioniert-ausschreibung", "vob-vergabe"],
    sources: [
      { title: "§ 29 VgV – Vergabeunterlagen", url: "https://www.gesetze-im-internet.de/vgv_2016/__29.html" },
      { title: "VOB/A 2019 – §§ 7 und 8", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-09-24",
  },
  {
    slug: "teilnahmewettbewerb",
    term: "Teilnahmewettbewerb",
    category: "Verfahren",
    shortDefinition: "Im Teilnahmewettbewerb prüft der Auftraggeber zunächst, welche Unternehmen geeignet sind und zur Angebotsabgabe aufgefordert werden.",
    definition: [
      "Der Teilnahmewettbewerb ist eine Auswahlphase vor der eigentlichen Angebotsphase. Unternehmen reichen zunächst einen Teilnahmeantrag mit den geforderten Eignungsnachweisen ein; ein Angebot wird erst von den ausgewählten Bewerbern verlangt.",
      "Er kommt insbesondere beim nichtoffenen Verfahren und bei Verfahren mit vorgeschalteter Auswahl in Betracht. Die Bekanntmachung muss die Teilnahmebedingungen, Eignungskriterien und gegebenenfalls die objektiven Regeln für die Begrenzung der Bewerberzahl nennen.",
      "Bewerber sollten den Teilnahmeantrag strikt von einem Angebot unterscheiden: In dieser Phase geht es um die eigene Eignung und Auswahl, nicht um eine vollständige Preis- und Leistungskalkulation, sofern die Vergabestelle nichts anderes verlangt.",
    ],
    keyPoints: [
      "Auswahlphase vor der Angebotsabgabe",
      "Teilnahmeantrag ist kein Angebot",
      "Eignung und Auswahlregeln stehen in der Bekanntmachung",
      "Nur ausgewählte Bewerber werden zur Angebotsabgabe aufgefordert",
    ],
    faq: [
      { question: "Was ist ein Teilnahmewettbewerb?", answer: "Ein Teilnahmewettbewerb ist eine vorgelagerte Auswahlphase. Unternehmen weisen zunächst ihre Eignung nach; anschließend fordert der Auftraggeber die ausgewählten Bewerber zur Abgabe eines Angebots auf." },
      { question: "Ist ein Teilnahmeantrag schon ein Angebot?", answer: "Nein. Der Teilnahmeantrag dient grundsätzlich der Auswahl geeigneter Bewerber. Ein Angebot wird erst in der anschließenden Angebotsphase abgegeben, wenn die Vergabestelle dazu auffordert." },
      { question: "Welche Nachweise werden im Teilnahmewettbewerb verlangt?", answer: "Verlangt werden die in der Bekanntmachung genannten Eignungsnachweise, zum Beispiel Angaben zur beruflichen Befähigung, Referenzen oder zur wirtschaftlichen Leistungsfähigkeit. Maßgeblich sind die konkreten Anforderungen des Verfahrens." },
    ],
    relatedTerms: ["beschraenktes-verfahren", "eignungskriterien", "eigenerklaerung", "referenzen", "e-vergabe", "nachforderung-unterlagen"],
    relatedArticles: ["vergabeverfahren-uebersicht", "wie-funktioniert-ausschreibung", "eu-vergabe"],
    sources: [
      { title: "§ 16 VgV – Nichtoffenes Verfahren", url: "https://www.gesetze-im-internet.de/vgv_2016/__16.html" },
      { title: "§ 17 VgV – Verhandlungsverfahren", url: "https://www.gesetze-im-internet.de/vgv_2016/__17.html" },
      { title: "§ 3b VOB/A – Arten der Vergabe", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-09-24",
  },

  // === AKTEURE ===
  {
    slug: "auftraggeber",
    term: "Auftraggeber",
    category: "Akteure",
    shortDefinition: "Ein Auftraggeber ist eine Stelle, die einen öffentlichen Auftrag vergibt. Dazu gehören Bund, Länder, Kommunen und andere öffentliche Einrichtungen.",
    definition: [
      "Ein öffentlicher Auftraggeber ist eine Stelle, die im öffentlichen Interesse tätig wird und nicht gewerblich tätig ist. Zu den öffentlichen Auftraggebern gehören der Bund, die Länder, die Kommunen, sowie öffentliche Einrichtungen wie Universitäten, Krankenhäuser oder Sozialversicherungsträger.",
      "Öffentliche Auftraggeber sind an das öffentliche Vergaberecht gebunden, das sicherstellen soll, dass öffentliche Mittel wirtschaftlich und sparsam verwendet werden, und dass der Wettbewerb zwischen Unternehmen fair und transparent abläuft.",
      "Auch sogenannte Sektorenauftraggeber (z.B. Energieversorger, Verkehrsbetriebe) fallen unter den Begriff des Auftraggebers, haben aber besondere vergaberechtliche Vorschriften (SektVO).",
    ],
    keyPoints: [
      "Öffentliche Stelle, die Aufträge vergibt",
      "Bund, Länder, Kommunen, Universitäten, Krankenhäuser",
      "An das öffentliche Vergaberecht gebunden",
      "Sektorenauftraggeber haben besondere Vorschriften (SektVO)",
    ],
    faq: [
      {
        question: "Wer gilt als öffentlicher Auftraggeber?",
        answer: "Öffentliche Auftraggeber sind Stellen, die im öffentlichen Interesse tätig werden und nicht gewerblich tätig sind. Dazu gehören Bund, Länder, Kommunen, Universitäten, Krankenhäuser, Sozialversicherungsträger und bestimmte Sektorenunternehmen.",
      },
      {
        question: "Was sind die Pflichten eines öffentlichen Auftraggebers?",
        answer: "Öffentliche Auftraggeber müssen das Vergaberecht einhalten: Transparenz, Wettbewerb, Gleichbehandlung, Wirtschaftlichkeit und Sparsamkeit. Sie müssen Vergaben bekannt machen, faire Verfahren durchführen und dokumentieren.",
      },
    ],
    relatedTerms: ["vergabestelle", "sektvo"],
  },
  {
    slug: "vergabestelle",
    term: "Vergabestelle",
    category: "Akteure",
    shortDefinition: "Die Vergabestelle ist die organisatorische Einheit innerhalb eines Auftraggebers, die für die Durchführung von Vergabeverfahren verantwortlich ist.",
    definition: [
      "Die Vergabestelle ist die organisatorische Einheit oder Abteilung innerhalb eines öffentlichen Auftraggebers, die mit der Durchführung von Vergabeverfahren betraut ist. Sie ist für die fachliche, rechtliche und administrative Abwicklung von Ausschreibungen zuständig.",
      "Die Vergabestelle erstellt die Vergabeunterlagen, führt das Vergabeverfahren durch, betreut den Bieterdialog, prüft die Angebote und bereitet die Zuschlagserteilung vor. Sie ist damit die zentrale Schnittstelle zwischen dem Auftraggeber und den Bietern.",
      "Je nach Größe und Struktur des Auftraggebers kann die Vergabestelle unterschiedlich organisiert sein: als eigenständige Abteilung, als zentrale Beschaffungsstelle oder dezentral bei den Fachbereichen.",
    ],
    keyPoints: [
      "Organisatorische Einheit für Vergabeverfahren",
      "Zentrale Schnittstelle zwischen Auftraggeber und Bietern",
      "Erstellt Vergabeunterlagen, führt Verfahren durch",
      "Organisation: eigenständig, zentral oder dezentral",
    ],
    faq: [
      {
        question: "Was ist eine Vergabestelle?",
        answer: "Die Vergabestelle ist die Abteilung oder Einheit innerhalb eines öffentlichen Auftraggebers, die für die Durchführung von Vergabeverfahren verantwortlich ist. Sie ist die zentrale Schnittstelle zwischen Auftraggeber und Bietern.",
      },
      {
        question: "Was sind die Aufgaben einer Vergabestelle?",
        answer: "Die Vergabestelle erstellt Vergabeunterlagen, führt das Vergabeverfahren durch, betreut den Bieterdialog, prüft Angebote und bereitet die Zuschlagserteilung vor. Sie sorgt für die Einhaltung des Vergaberechts.",
      },
    ],
    relatedTerms: ["auftraggeber"],
  },

  // === SONDERBEREICHE ===
  {
    slug: "sektorenauftraggeber",
    term: "Sektorenauftraggeber",
    category: "Sonderbereiche",
    shortDefinition: "Sektorenauftraggeber sind Unternehmen in den Bereichen Energie, Wasser, Verkehr und Hafen, für die die SektVO gilt.",
    definition: [
      "Sektorenauftraggeber sind öffentliche oder privatrechtliche Unternehmen, die in bestimmten wirtschaftlichen Sektoren tätig sind. Die wichtigsten Sektoren sind: Gas, Wärme, Elektrizität, Wasser, Eisenbahndienste und Hafen- sowie Flughafenbetrieb.",
      "Für diese Unternehmen gelten besondere vergaberechtliche Vorschriften, die in der Sektorenverordnung (SektVO) geregelt sind. Die SektVO trägt der besonderen Marktsituation in diesen Bereichen Rechnung, in denen oft nur wenige Anbieter existieren.",
      "Sektorenauftraggeber können flexiblere Vergabeverfahren anwenden und haben erweiterte Möglichkeiten der Vergabe ohne förmliches Verfahren, wenn die Bedingungen der SektVO dies zulassen.",
    ],
    keyPoints: [
      "Unternehmen in Energie, Wasser, Verkehr und Hafen",
      "Besondere Vorschriften nach SektVO",
      "Flexiblere Vergabeverfahren möglich",
      "Oft nur wenige Anbieter im Markt",
    ],
    faq: [
      {
        question: "Was ist ein Sektorenauftraggeber?",
        answer: "Sektorenauftraggeber sind Unternehmen in den Bereichen Gas, Wärme, Elektrizität, Wasser, Eisenbahndienste und Hafen- sowie Flughafenbetrieb. Für sie gelten die besonderen Vorschriften der SektVO.",
      },
      {
        question: "Welche Besonderheiten gelten für Sektorenauftraggeber?",
        answer: "Sektorenauftraggeber können nach SektVO flexiblere Vergabeverfahren anwenden und haben erweiterte Möglichkeiten der Vergabe ohne förmliches Verfahren. Dies liegt an der besonderen Marktsituation mit oft wenigen Anbietern.",
      },
    ],
    relatedTerms: ["sektvo", "auftraggeber"],
  },
  {
    slug: "tariftreue",
    term: "Tariftreue",
    category: "Sonderbereiche",
    shortDefinition: "Tariftreue bezeichnet vergaberechtliche Vorgaben zur Einhaltung einschlägiger Arbeits- oder Tarifbedingungen bei der Auftragsausführung.",
    definition: [
      "Tariftreue kann bedeuten, dass Auftragnehmer bei der Ausführung eines öffentlichen Auftrags bestimmte tarifliche oder gesetzlich festgelegte Arbeitsbedingungen einhalten müssen. Ob eine solche Verpflichtung besteht, hängt vom Auftraggeber, Auftragsgegenstand, Auftragswert und dem einschlägigen Bundes- oder Landesrecht ab.",
      "Die Anforderungen ergeben sich aus dem anwendbaren Tariftreue- oder Vergabegesetz, dem Vertrag und den Vergabeunterlagen. Sie können auch Nachunternehmer erfassen. Eine allgemeine Pflicht, bei jedem öffentlichen Auftrag einen Tariflohn zu zahlen, folgt daraus nicht.",
      "Auftraggeber können Nachweise und Kontrollen vorsehen. Rechtsfolgen bei Verstößen – etwa Vertragsstrafe, Ausschluss von künftigen Vergaben oder Kündigung – müssen sich aus der einschlägigen Rechtsgrundlage und den Vertragsbedingungen ergeben.",
    ],
    keyPoints: [
      "Arbeits- und Tarifbedingungen nach dem einschlägigen Recht einhalten",
      "Gilt nicht automatisch für jeden öffentlichen Auftrag",
      "Soll Lohndumping verhindern",
      "Auftraggeber prüfen Einhaltung",
    ],
    faq: [
      {
        question: "Was bedeutet Tariftreue bei öffentlichen Aufträgen?",
        answer: "Tariftreue bedeutet, dass bei einem konkreten öffentlichen Auftrag die in Recht und Vergabeunterlagen festgelegten tariflichen oder gesetzlichen Arbeitsbedingungen eingehalten werden müssen. Die genaue Verpflichtung hängt vom anwendbaren Bundes- oder Landesrecht ab.",
      },
      {
        question: "Gilt die Tariftreuepflicht für alle öffentlichen Aufträge?",
        answer: "Die Tariftreuepflicht gilt nicht für alle öffentlichen Aufträge, sondern für bestimmte Arten und Größenordnungen. Die genauen Voraussetzungen ergeben sich aus dem einschlägigen Bundes- oder Landesrecht, dem Vertrag und den Vergabeunterlagen.",
      },
    ],
    relatedTerms: ["auftraggeber"],
    relatedCategories: ["Gebaeudereinigung", "Facility Management"],
    sources: [
      { title: "§ 128 GWB – Auftragsausführung", url: "https://www.gesetze-im-internet.de/gwb/__128.html" },
      { title: "§ 129 GWB – Zwingende Arbeitsbedingungen", url: "https://www.gesetze-im-internet.de/gwb/__129.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "konzession",
    term: "Konzession",
    category: "Sonderbereiche",
    shortDefinition: "Eine Konzession ist ein Vertrag, bei dem der Auftragnehmer das wirtschaftliche Risiko trägt und dafür ein Nutzungsrecht erhält.",
    definition: [
      "Eine Konzession ist ein besonderer Vertragstyp im öffentlichen Beschaffungswesen. Der wesentliche Unterschied zu einem gewöhnlichen öffentlichen Auftrag besteht in der Risikoverteilung und der Entlohnung: Bei der Konzession trägt der Konzessionär das wirtschaftliche Risiko und wird durch das Recht, die Leistung zu nutzen (z.B. Eintrittsgelder), entlohnt.",
      "Typische Beispiele für Konzessionen sind der Betrieb von Rastanlagen an Autobahnen, Parkhäusern, Freizeitparks auf öffentlichem Grund oder die Bewirtschaftung von Wirtschaftshöfen. Der Konzessionär investiert in die Infrastruktur und erhält im Gegenzug das Recht, die Einnahmen aus dem Betrieb zu behalten.",
      "Die Vergabe von Konzessionen wird durch die Konzessionsvergabeverordnung (KonzVgV) geregelt, die besondere Verfahrensvorschriften enthält.",
    ],
    keyPoints: [
      "Vertrag mit besonderer Risikoverteilung",
      "Konzessionär trägt Marktrisiko, erhält Nutzungsrecht",
      "Typisch: Rastanlagen, Parkhäuser, Freizeitparks",
      "Reguliert durch KonzVgV",
    ],
    faq: [
      {
        question: "Was ist eine Konzession?",
        answer: "Eine Konzession ist ein öffentlicher Vertrag, bei dem der Auftragnehmer (Konzessionär) das wirtschaftliche Risiko trägt und dafür das Recht erhält, die erbrachte Leistung zu nutzen und Einnahmen daraus zu erzielen. Die Vergabe wird durch die KonzVgV geregelt.",
      },
      {
        question: "Was ist der Unterschied zwischen einer Konzession und einem öffentlichen Auftrag?",
        answer: "Bei einem öffentlichen Auftrag zahlt der Auftraggeber den Auftragnehmer für die erbrachten Leistungen. Bei einer Konzession trägt der Konzessionär das Marktrisiko und wird durch das Nutzungsrecht an der Leistung (z.B. Eintrittsgelder) entlohnt.",
      },
    ],
    relatedTerms: ["konzvgv"],
  },
  {
    slug: "zuschlagserteilung",
    term: "Zuschlagserteilung",
    category: "Vergabeprozess",
    shortDefinition: "Die Zuschlagserteilung ist die förmliche Beauftragung eines Bieters nach Abschluss des Vergabeverfahrens.",
    definition: [
      "Die Zuschlagserteilung ist der förmliche Akt, mit dem der öffentliche Auftraggeber einem Bieter den Zuschlag erteilt und damit den Vertrag abschließt. Sie erfolgt nach Abschluss des Vergabeverfahrens und der Prüfung aller Angebote.",
      "Soweit § 134 GWB anwendbar ist, muss der Auftraggeber die betroffenen Bieter in Textform über den Namen des vorgesehenen Zuschlagsempfängers, die Gründe der Nichtberücksichtigung und den frühesten Vertragsschluss informieren. Diese Informationspflicht gilt nicht pauschal für jedes Unterschwellenverfahren.",
      "Im Anwendungsbereich des § 134 GWB darf der Vertrag grundsätzlich erst 15 Kalendertage nach Absendung der Information geschlossen werden, bei elektronischer Übermittlung oder Fax nach zehn Kalendertagen. Ausnahmen, der konkrete Übermittlungsweg und die Form des Vertragsschlusses richten sich nach den einschlägigen Vorschriften.",
    ],
    keyPoints: [
      "Förmliche Beauftragung eines Bieters",
      "Erfolgt nach Prüfung aller Angebote",
      "Informations- und Wartepflicht gegenüber unterlegenen Bietern",
      "Im Anwendungsbereich des § 134 GWB: 15 Kalendertage (10 bei elektronischer Übermittlung)",
    ],
    faq: [
      {
        question: "Was ist die Zuschlagserteilung?",
        answer: "Die Zuschlagserteilung ist die Beauftragung des erfolgreichen Bieters nach Prüfung und Wertung der Angebote. Form, Informationspflichten und ein möglicher Vertragsschluss nach einer Wartefrist richten sich nach dem anwendbaren Vergaberecht.",
      },
      {
        question: "Wie läuft die Zuschlagserteilung ab?",
        answer: "Soweit § 134 GWB anwendbar ist, werden die betroffenen Bieter zunächst in Textform informiert. Der Vertrag darf grundsätzlich erst nach 15 Kalendertagen ab Absendung geschlossen werden, bei elektronischer Übermittlung nach 10 Kalendertagen. Ausnahmen und die konkreten Voraussetzungen müssen geprüft werden.",
      },
    ],
    relatedTerms: ["zuschlag", "nachpruefungsverfahren", "bindefrist"],
    sources: [
      { title: "§ 134 GWB – Informations- und Wartepflicht", url: "https://www.gesetze-im-internet.de/gwb/__134.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "bieterfragen",
    term: "Bieterfragen",
    category: "Vergabeprozess",
    shortDefinition: "Bieterfragen sind Anfragen von Bietern zur Ausschreibung, die während der Angebotsfrist gestellt werden können.",
    definition: [
      "Bieterfragen sind Anfragen, die Bewerber oder Bieter über den vorgesehenen Kommunikationsweg an den Auftraggeber richten, um Unklarheiten in Bekanntmachung oder Vergabeunterlagen zu klären. Maßgeblich sind die in den Unterlagen genannten Fristen und Kommunikationsregeln.",
      "Relevante Antworten oder Änderungen müssen nach dem anwendbaren Vergaberecht so bereitgestellt werden, dass die Gleichbehandlung und ausreichende Information aller betroffenen Unternehmen gewahrt bleiben. Bei erheblichen Änderungen kann eine Verlängerung der Angebotsfrist erforderlich sein.",
      "Bieterfragen sind ein wichtiges Instrument zur Klärung von Unklarheiten und zur Verbesserung der Qualität der Angebote. Sie können sich auf alle Aspekte der Ausschreibung beziehen: Leistungsbeschreibung, Eignungskriterien, Zuschlagskriterien, Vertragsbedingungen.",
    ],
    keyPoints: [
      "Anfragen von Bietern zur Ausschreibung",
      "Innerhalb des vorgesehenen Kommunikationswegs und der genannten Fristen",
      "Relevante Antworten müssen gleichbehandlungs- und transparent bereitgestellt werden",
      "Erhebliche Änderungen können eine Fristverlängerung erfordern",
    ],
    faq: [
      {
        question: "Was sind Bieterfragen?",
        answer: "Bieterfragen sind Anfragen von Bewerbern oder Bietern zu Unklarheiten in Bekanntmachung oder Vergabeunterlagen. Sie müssen über den vorgesehenen Kommunikationsweg und innerhalb der dort genannten Fristen gestellt werden.",
      },
      {
        question: "Müssen Antworten auf Bieterfragen veröffentlicht werden?",
        answer: "Relevante Antworten müssen so bereitgestellt werden, dass alle betroffenen Unternehmen gleich informiert werden. Ob eine Antwort anonymisiert, im Portal veröffentlicht oder die Frist verlängert wird, richtet sich nach dem Verfahren und den anwendbaren Vorschriften.",
      },
    ],
    relatedTerms: ["ausschreibung", "leistungsbeschreibung"],
    sources: [
      { title: "§ 9 VgV – Grundsätze der Kommunikation", url: "https://www.gesetze-im-internet.de/vgv_2016/__9.html" },
      { title: "§ 97 GWB – Allgemeine Grundsätze", url: "https://www.gesetze-im-internet.de/gwb/__97.html" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "angebotseroeffnung",
    term: "Angebotseröffnung",
    category: "Vergabeprozess",
    shortDefinition: "Die Angebotseröffnung ist der Zeitpunkt, zu dem die eingegangenen Angebote vom Auftraggeber geöffnet und erfasst werden.",
    definition: [
      "Die Angebotseröffnung bezeichnet den Vorgang, bei dem der Auftraggeber die eingegangenen Angebote nach Ablauf der Einreichungsfrist öffnet und für die weitere Prüfung erfasst. Ablauf und Dokumentation richten sich nach dem anwendbaren Regelwerk und der Verfahrensart.",
      "Bei elektronischen Vergaben findet regelmäßig keine öffentliche Bieteröffnung statt. Die Vergabestelle dokumentiert den Eingang und prüft die Angebote anschließend auf Vollständigkeit, fachliche und rechnerische Richtigkeit sowie nach den weiteren Verfahrensvorgaben.",
      "Eine öffentliche Öffnung mit Bekanntgabe bestimmter Angebotsdaten kann in einzelnen VOB/A-Konstellationen vorgesehen sein, ist aber keine allgemeine Folge eines offenen Verfahrens. Die konkrete Ausschreibung und das anwendbare Regelwerk sind maßgeblich.",
    ],
    keyPoints: [
      "Formeller Akt der Öffnung und Erfassung der Angebote",
      "Ablauf und Öffentlichkeit hängen vom anwendbaren Regelwerk ab",
      "Elektronische Vergaben haben regelmäßig keine öffentliche Bieteröffnung",
      "Inhaltliche Bewertung erfolgt nach dem Öffnungsvorgang",
    ],
    faq: [
      {
        question: "Was ist die Angebotseröffnung?",
        answer: "Die Angebotseröffnung ist der Vorgang, bei dem der Auftraggeber die eingegangenen Angebote nach Ablauf der Einreichungsfrist öffnet und erfasst. Ob sie öffentlich stattfindet, hängt vom anwendbaren Regelwerk und der Verfahrensart ab; bei elektronischen Vergaben ist sie regelmäßig nicht öffentlich.",
      },
      {
        question: "Können Bieter der Angebotseröffnung beiwohnen?",
        answer: "Das lässt sich nicht pauschal aus der Verfahrensart ableiten. Bei elektronischen Vergaben findet regelmäßig keine öffentliche Bieteröffnung statt; ob eine Teilnahme möglich ist, ergibt sich aus dem anwendbaren Regelwerk und den Vergabeunterlagen.",
      },
    ],
    relatedTerms: ["angebot", "offenes-verfahren", "ausschreibung"],
    sources: [
      { title: "§ 55 VgV – Öffnung der Angebote", url: "https://www.gesetze-im-internet.de/vgv_2016/__55.html" },
      { title: "VOB/A 2019 – § 14 Öffnung der Angebote", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-09-27",
  },
  {
    slug: "wirtschaftlichkeitsprinzip",
    term: "Wirtschaftlichkeitsprinzip",
    category: "Rechtsgrundlagen",
    shortDefinition: "Das Wirtschaftlichkeitsprinzip verlangt, dass öffentliche Aufträge wirtschaftlich und sparsam vergeben werden.",
    definition: [
      "Das Wirtschaftlichkeitsprinzip ist ein zentraler Grundsatz des öffentlichen Vergaberechts. Es verlangt, dass öffentliche Auftraggeber ihre Aufträge wirtschaftlich und sparsam vergeben, also das beste Preis-Leistungs-Verhältnis erzielen.",
      "Wirtschaftlichkeit bedeutet nicht, dass immer der niedrigste Preis den Zuschlag erhält. Vielmehr ist das wirtschaftlichste Angebot gesucht, das die beste Kombination aus Preis, Qualität, Lebenszykluskosten und anderen Faktoren bietet.",
      "Das Wirtschaftlichkeitsprinzip wird durch die Grundsätze des GWB und die jeweils anwendbaren Vergabeordnungen umgesetzt. Für den Zuschlag ist insbesondere das wirtschaftlichste Angebot maßgeblich; dabei können neben dem Preis auch qualitative und weitere bekannt gemachte Kriterien berücksichtigt werden.",
    ],
    keyPoints: [
      "Zentraler Grundsatz des Vergaberechts",
      "Bestes Preis-Leistungs-Verhältnis als Ziel",
      "Nicht zwingend der niedrigste Preis",
      "Ausprägung in GWB und den jeweils anwendbaren Vergabeordnungen",
    ],
    faq: [
      {
        question: "Was ist das Wirtschaftlichkeitsprinzip im Vergaberecht?",
        answer: "Das Wirtschaftlichkeitsprinzip verlangt, dass öffentliche Auftraggeber ihre Aufträge wirtschaftlich und sparsam vergeben. Das Ziel ist das wirtschaftlichste Angebot mit der besten Kombination aus Preis und Leistung.",
      },
      {
        question: "Bedeutet Wirtschaftlichkeit immer der niedrigste Preis?",
        answer: "Nein, Wirtschaftlichkeit bedeutet nicht immer der niedrigste Preis. Das wirtschaftlichste Angebot bietet das beste Preis-Leistungs-Verhältnis und kann qualitative Aspekte wie Qualität, Nachhaltigkeit oder Lebenszykluskosten einbeziehen.",
      },
    ],
    relatedTerms: ["zuschlagskriterien", "gwb-vergaberecht"],
    sources: [
      { title: "§ 97 GWB – Allgemeine Grundsätze", url: "https://www.gesetze-im-internet.de/gwb/__97.html" },
      { title: "§ 127 GWB – Zuschlag", url: "https://www.gesetze-im-internet.de/gwb/__127.html" },
    ],
    lastReviewed: "2026-09-08",
  },
  {
    slug: "transparenzprinzip",
    term: "Transparenzprinzip",
    category: "Rechtsgrundlagen",
    shortDefinition: "Das Transparenzprinzip verlangt, dass Vergabeverfahren nachvollziehbar und für alle Bieter fair ablaufen.",
    definition: [
      "Das Transparenzprinzip ist ein Grundprinzip des öffentlichen Vergaberechts. Es verlangt, dass alle Schritte des Vergabeverfahrens transparent, nachvollziehbar und fair ablaufen. Auftraggeber müssen sicherstellen, dass alle Bieter Zugang zu denselben Informationen haben.",
      "Transparenz bedeutet konkret: Bekanntmachung der Vergabe, klare Definition der Eignungs- und Zuschlagskriterien, gleiche Informationen für alle Bieter, Dokumentation des Verfahrens und Begründung der Vergabeentscheidung.",
      "Das Transparenzprinzip ist eng mit den Prinzipien der Gleichbehandlung und des Nichtdiskriminierung verbunden. Zusammen sollen sie einen fairen und wettbewerblichen Vergabeprozess sicherstellen.",
    ],
    keyPoints: [
      "Grundprinzip des Vergaberechts",
      "Vergabeverfahren müssen nachvollziehbar und fair ablaufen",
      "Gleiche Informationen für alle Bieter",
      "Dokumentation und Begründung der Entscheidungen",
    ],
    faq: [
      {
        question: "Was ist das Transparenzprinzip?",
        answer: "Das Transparenzprinzip verlangt, dass alle Schritte des Vergabeverfahrens transparent und nachvollziehbar ablaufen. Alle Bieter müssen Zugang zu denselben Informationen haben, und Entscheidungen müssen dokumentiert und begründet werden.",
      },
      {
        question: "Wie wird Transparenz im Vergabeverfahren sichergestellt?",
        answer: "Transparenz wird durch Bekanntmachung, klare Kriterien, gleiche Information aller Bieter, Dokumentation und Begründung der Vergabeentscheidung sichergestellt. Bei Fragen müssen alle Bieter gleichzeitig informiert werden.",
      },
    ],
    relatedTerms: ["wirtschaftlichkeitsprinzip", "gleichbehandlung"],
  },
  {
    slug: "gleichbehandlung",
    term: "Gleichbehandlung",
    category: "Rechtsgrundlagen",
    shortDefinition: "Das Prinzip der Gleichbehandlung verlangt, dass alle Bieter in einem Vergabeverfahren gleich behandelt werden.",
    definition: [
      "Das Prinzip der Gleichbehandlung ist ein Grundprinzip des öffentlichen Vergaberechts. Es verlangt, dass alle Bieter in einem Vergabeverfahren gleich behandelt werden, unabhängig von ihrer Größe, Herkunft oder anderen nicht leistungsbezogenen Merkmalen.",
      "Gleichbehandlung bedeutet konkret: gleiche Informationen für alle Bieter, gleiche Fristen, gleiche Kriterien, gleiche Bewertungsmethoden. Diskriminierung, Bevorzugung oder Benachteiligung einzelner Bieter ist untersagt.",
      "Das Prinzip ist eng mit dem Transparenzprinzip und dem Nichtdiskriminierungsgebot verbunden. Verstöße können zur Aufhebung des Vergabeverfahrens oder zur Zuschlagsverweigerung führen.",
    ],
    keyPoints: [
      "Grundprinzip des Vergaberechts",
      "Alle Bieter müssen gleich behandelt werden",
      "Gleiche Informationen, Fristen, Kriterien, Bewertung",
      "Diskriminierung ist untersagt",
    ],
    faq: [
      {
        question: "Was bedeutet Gleichbehandlung im Vergaberecht?",
        answer: "Gleichbehandlung bedeutet, dass alle Bieter in einem Vergabeverfahren gleich behandelt werden müssen: gleiche Informationen, Fristen, Kriterien und Bewertungsmethoden. Diskriminierung oder Bevorzugung einzelner Bieter ist untersagt.",
      },
      {
        question: "Was passiert bei Verstößen gegen die Gleichbehandlung?",
        answer: "Verstöße gegen die Gleichbehandlung können zur Aufhebung des Vergabeverfahrens, zur Zuschlagsverweigerung oder zum Ausschluss eines Bieters führen. Betroffene Bieter können ein Nachprüfungsverfahren einleiten.",
      },
    ],
    relatedTerms: ["transparenzprinzip", "wirtschaftlichkeitsprinzip"],
  },
  {
    slug: "vergabestatistikverordnung",
    term: "VergStatVO (Vergabestatistikverordnung)",
    category: "Rechtsgrundlagen",
    shortDefinition: "Die VergStatVO regelt die statistische Erfassung und Meldung von Vergabeverfahren in Deutschland.",
    definition: [
      "Die Vergabestatistikverordnung (VergStatVO) regelt die statistische Erfassung und Meldung von Vergabeverfahren in Deutschland. Sie verpflichtet öffentliche Auftraggeber, Daten zu ihren Vergabeverfahren zu erheben und an das Bundeskartellamt zu melden.",
      "Die erhobenen Daten umfassen unter anderem: Anzahl und Art der Vergabeverfahren, Auftragswerte, Zuschlagsentscheidungen, Bieterzahlen und CPV-Codes. Die Statistik dient der Transparenz, der Vergabekontrolle und der Weiterentwicklung des Vergaberechts.",
      "Die VergStatVO ist Teil der Bemühungen, das öffentliche Beschaffungswesen in Deutschland transparenter und datenbasiert zu gestalten. Die Ergebnisse werden aggregiert veröffentlicht.",
    ],
    keyPoints: [
      "Regelt statistische Erfassung von Vergabeverfahren",
      "Meldepflicht an das Bundeskartellamt",
      "Daten: Anzahl, Art, Werte, Zuschläge, Bieterzahlen",
      "Dient Transparenz und Vergabekontrolle",
    ],
    faq: [
      {
        question: "Was ist die Vergabestatistikverordnung?",
        answer: "Die VergStatVO regelt die statistische Erfassung und Meldung von Vergabeverfahren in Deutschland. Öffentliche Auftraggeber müssen Daten zu ihren Vergaben an das Bundeskartellamt melden. Die Daten dienen Transparenz und Kontrolle.",
      },
      {
        question: "Welche Daten müssen nach der VergStatVO gemeldet werden?",
        answer: "Die gemeldeten Daten umfassen Anzahl und Art der Vergabeverfahren, Auftragswerte, Zuschlagsentscheidungen, Bieterzahlen und CPV-Codes. Die Ergebnisse werden aggregiert veröffentlicht.",
      },
    ],
    relatedTerms: ["gwb-vergaberecht", "auftraggeber"],
  },
  {
    slug: "direktvergabe",
    term: "Direktvergabe",
    category: "Verfahren",
    shortDefinition: "Die Direktvergabe ist die Auftragsvergabe ohne förmliches Vergabeverfahren. Sie ist nur in Ausnahmefällen zulässig.",
    definition: [
      "Die Direktvergabe (auch Vertragsschluss ohne Vergabeverfahren genannt) ist die Vergabe eines öffentlichen Auftrags ohne ein förmliches Vergabeverfahren. Sie ist nur in engen Ausnahmefällen zulässig und wird durch das Vergaberecht streng kontrolliert.",
      "Direktvergaben können zulässig sein, wenn der Auftragswert unterhalb der Schwellenwerte liegt und auch nach Unterschwellenrecht keine Vergabepflicht besteht, oder in besonderen Ausnahmefällen (z.B. bei Einzigartigkeit der Leistung, bei extremem Zeitdruck oder bei Wiederholungsaufträgen).",
      "Direktvergaben oberhalb der Schwellenwerte ohne rechtfertigenden Grund sind ein Verstoß gegen das Vergaberecht und können als de facto Vergabe zum Nachprüfungsverfahren führen.",
    ],
    keyPoints: [
      "Vergabe ohne förmliches Vergabeverfahren",
      "Nur in engen Ausnahmefällen zulässig",
      "Unterschwellenbereich oder besondere Ausnahmen",
      "De facto Vergabe bei unrechtmäßiger Direktvergabe",
    ],
    faq: [
      {
        question: "Wann ist eine Direktvergabe zulässig?",
        answer: "Eine Direktvergabe ist nur zulässig, wenn das einschlägige Unterschwellenregelwerk oder eine besondere gesetzliche Ausnahme dies erlaubt. Die Voraussetzungen hängen insbesondere von Auftraggeber, Leistungsart, Auftragswert und dem geltenden Landes- oder Haushaltsrecht ab.",
      },
      {
        question: "Was ist der Unterschied zwischen Direktvergabe und freihändiger Vergabe?",
        answer: "Die Direktvergabe erfolgt ohne jedes Verfahren und ohne Wettbewerb. Die freihändige Vergabe ist ein förmliches Vergabeverfahren, bei dem mit ausgewählten Unternehmen verhandelt wird, aber ein eingeschränkter Wettbewerb stattfindet.",
      },
    ],
    relatedTerms: ["freihändige-vergabe", "de-facto-vergabe"],
  },
];

// Helper maps
export const GLOSSARY_MAP: Record<string, GlossaryEntry> = GLOSSARY.reduce(
  (acc, entry) => {
    acc[entry.slug] = entry;
    return acc;
  },
  {} as Record<string, GlossaryEntry>,
);

export const ALL_GLOSSARY_SLUGS = GLOSSARY.map((e) => e.slug);

export const GLOSSARY_CATEGORIES = [
  "Rechtsgrundlagen",
  "Verfahren",
  "Vergabeprozess",
  "Eignung & Zuschlag",
  "Schwellenwerte",
  "Nachprüfung",
  "Technik & Standards",
  "Akteure",
  "Sonderbereiche",
] as const;

export function getGlossaryByCategory(): Record<string, GlossaryEntry[]> {
  const result: Record<string, GlossaryEntry[]> = {};
  for (const cat of GLOSSARY_CATEGORIES) {
    result[cat] = GLOSSARY.filter((e) => e.category === cat);
  }
  return result;
}
