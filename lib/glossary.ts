// SEO: Vergabelexikon — ~50 glossary entries targeting long-tail glossary queries
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
    shortDefinition: "Das GWB ist das zentrale Wettbewerbsgesetz Deutschlands. Teil 4 (§§ 97–173) regelt das öffentliche Vergaberecht.",
    definition: [
      "Das Gesetz gegen Wettbewerbsbeschränkungen (GWB) ist die rechtliche Grundlage für die öffentliche Auftragsvergabe in Deutschland. Der vierte Teil des GWB (§§ 97–173 GWB) enthält die zentralen vergaberechtlichen Vorschriften, die für öffentliche Auftraggeber bindend sind.",
      "Das GWB regelt unter anderem die Anwendungsbereiche des Vergaberechts, die vergabeverfahrensrechtlichen Prinzipien (Transparenz, Wettbewerb, Gleichbehandlung), die Schwellenwerte und das Nachprüfungsverfahren. Es implementiert die europäischen Vergaberichtlinien in nationales Recht.",
      "Die Vorschriften des GWB gelten für Beschaffungen oberhalb der EU-Schwellenwerte. Für Unterschwellenvergaben gelten stattdessen die UVgO (Liefer- und Dienstleistungen), die VOB/A (Bauleistungen) oder landesspezifische Vergabevorschriften.",
    ],
    keyPoints: [
      "Teil 4 (§§ 97–173 GWB) = Kern des deutschen Vergaberechts",
      "Gilt für Vergaben oberhalb der EU-Schwellenwerte",
      "Regelt Transparenz-, Wettbewerbs- und Gleichbehandlungsprinzip",
      "Grundlage für das Nachprüfungsverfahren vor Vergabekammern",
    ],
    faq: [
      {
        question: "Was regelt das GWB im Vergaberecht?",
        answer: "Das GWB regelt in seinem vierten Teil (§§ 97–173) die öffentliche Auftragsvergabe in Deutschland. Es definiert die Grundprinzipien wie Transparenz, Wettbewerb und Gleichbehandlung, legt die Schwellenwerte fest und ermöglicht die Nachprüfung von Vergabeverfahren durch Vergabekammern.",
      },
      {
        question: "Für welche Aufträge gilt das GWB?",
        answer: "Das GWB gilt grundsätzlich für alle öffentlichen Aufträge oberhalb der EU-Schwellenwerte. Für Unterschwellenvergaben gelten die UVgO, VOB/A oder landesspezifische Vorschriften, die dem GWB-Prinzip der Wirtschaftlichkeit und Sparsamkeit folgen.",
      },
      {
        question: "Wo finde ich den vollständigen Text des GWB?",
        answer: "Den vollständigen Text des GWB finden Sie auf gesetze-im-internet.de unter der offiziellen Veröffentlichung des Bundesministeriums der Justiz. Teil 4 umfasst die §§ 97 bis 173.",
      },
    ],
    relatedTerms: ["vgv-vergabeverordnung", "uvgo", "vob-a"],
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
    relatedTerms: ["uvgo", "vob-a", "gwb-vergaberecht", "sektvo", "konzvgv"],
    relatedCategories: ["Planungsleistungen", "IT-Dienstleistungen", "Lieferung"],
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
    shortDefinition: "Die VOB/A enthält die Vergaberegeln für öffentliche Bauaufträge. Abschnitt 1 gilt national, Abschnitt 2 für Bauaufträge im EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Vergaben.",
    definition: [
      "Die Vergabe- und Vertragsordnung für Bauleistungen, Teil A (VOB/A) regelt den vergaberechtlichen Teil öffentlicher Bauaufträge. Sie unterscheidet zwischen Abschnitt 1 für den nationalen Unterschwellenbereich, Abschnitt 2 für den EU-Oberschwellenbereich und Abschnitt 3 für verteidigungs- und sicherheitsspezifische Aufträge.",
      "Bei Bauaufträgen oberhalb der EU-Schwellenwerte ist die VOB/A Abschnitt 2 nicht isoliert zu lesen. § 2 VgV ordnet an, welche Teile der VgV zusätzlich gelten; für die Vergabe von Planungsleistungen, die als Los eines Bauauftrags vergeben werden, gilt die VgV nach dieser Vorschrift unmittelbar.",
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
    relatedTerms: ["vob-b", "vob-c", "vob-a-eu", "schwellenwerte", "auftragswert", "leistungsbeschreibung", "leistungsverzeichnis", "vgv-vergabeverordnung", "gwb-vergaberecht"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [
      { title: "VOB/A, Bekanntmachung vom 31. Januar 2019 (BAnz AT 19.02.2019 B2)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "BMWE: Vergabeübersicht und Rechtsgrundlagen", url: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Artikel/Wirtschaft/vergabe-uebersicht-und-rechtsgrundlagen.html" },
    ],
    lastReviewed: "2026-09-06",
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
    ],
    relatedTerms: ["vob-a", "vob-c", "leistungsbeschreibung", "leistungsverzeichnis"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [{ title: "VOB/A, Abschnitt 1, § 8a (Einbeziehung von VOB/B und VOB/C)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" }],
    lastReviewed: "2026-09-06",
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
    ],
    relatedTerms: ["vob-a", "vob-b", "leistungsbeschreibung", "leistungsverzeichnis"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe"],
    sources: [{ title: "VOB/A, Abschnitt 1, § 8a (Einbeziehung von VOB/B und VOB/C)", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" }],
    lastReviewed: "2026-09-06",
  },
  {
    slug: "vob-a-eu",
    term: "VOB/A EU (VOB/A Abschnitt 2)",
    category: "Rechtsgrundlagen",
    shortDefinition: "VOB/A EU bezeichnet Abschnitt 2 der VOB/A für Bauaufträge im EU-Oberschwellenbereich. Sie gilt zusammen mit den nach § 2 VgV anwendbaren Vorschriften und dem GWB.",
    definition: [
      "VOB/A EU ist die gebräuchliche Bezeichnung für VOB/A Abschnitt 2. Dieser Abschnitt enthält die besonderen Vergaberegeln für öffentliche Bauaufträge oberhalb des einschlägigen EU-Schwellenwerts, darunter Vorgaben zu Bekanntmachung, Verfahren, Fristen, Eignung, Angeboten und Zuschlag.",
      "Die Einordnung beginnt mit dem geschätzten Auftragswert ohne Umsatzsteuer und dem konkreten Auftraggeber- und Leistungsbereich. Für Bauaufträge ordnet § 2 VgV an, dass Abschnitt 1 und Abschnitt 2 Unterabschnitt 2 der VgV sowie im Übrigen VOB/A Teil A Abschnitt 2 anzuwenden sind. Planungsleistungen, die als Los eines Bauauftrags vergeben werden, unterliegen nach § 2 VgV der VgV.",
      "VOB/A EU ist daher weder eine eigene vierte VOB noch ein vollständiger Ersatz für GWB und VgV. Abschnitt 1 der VOB/A bleibt der nationale Bereich; Abschnitt 3 betrifft verteidigungs- und sicherheitsspezifische Vergaben.",
    ],
    keyPoints: ["VOB/A EU = VOB/A Abschnitt 2", "Für Bauaufträge im EU-Oberschwellenbereich", "GWB und die nach § 2 VgV anwendbaren VgV-Regeln sind mitzudenken", "Nicht mit VOB/A Abschnitt 1 oder Abschnitt 3 gleichsetzen"],
    faq: [
      { question: "Ab wann gilt VOB/A EU?", answer: "VOB/A EU kommt bei Bauaufträgen im EU-Oberschwellenbereich zur Anwendung, wenn der geschätzte Auftragswert ohne Umsatzsteuer den einschlägigen EU-Schwellenwert erreicht oder überschreitet und keine Sonderregel greift." },
      { question: "Ist VOB/A EU dasselbe wie VgV?", answer: "Nein. VOB/A EU ist Abschnitt 2 der VOB/A. Bei Bauaufträgen gelten daneben die in § 2 VgV genannten VgV-Vorschriften sowie der vierte Teil des GWB." },
    ],
    relatedTerms: ["vob-a", "schwellenwerte", "auftragswert", "vgv-vergabeverordnung", "gwb-vergaberecht"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA", "Gartenarbeiten"],
    relatedArticles: ["vob-vergabe", "schwellenwerte-vergabe"],
    sources: [
      { title: "§ 2 VgV – Bauaufträge", url: "https://www.gesetze-im-internet.de/vgv_2016/__2.html" },
      { title: "§ 106 GWB – Schwellenwerte", url: "https://www.gesetze-im-internet.de/gwb/__106.html" },
      { title: "VOB/A, Abschnitt 2, Bekanntmachung vom 31. Januar 2019", url: "https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_31012019_BWI781063060120180001604634.htm" },
    ],
    lastReviewed: "2026-09-06",
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
      "Das Verfahren ist stärker reglementiert als andere Verfahrensarten. Die Angebotsfrist beträgt im Oberschwellenbereich mindestens 35 Tage. Eine Verhandlung über die Angebote ist ausgeschlossen — der Auftrag wird an das wirtschaftlichste Angebot auf Basis der vorab bekanntgemachten Zuschlagskriterien erteilt.",
      "Das offene Verfahren wird häufig bei standardisierten Leistungen eingesetzt, bei denen eine einfache Bewertung der Angebote möglich ist. Es ist das am häufigsten angewendete Verfahren im öffentlichen Bereich.",
    ],
    keyPoints: [
      "Jedes interessierte Unternehmen kann ein Angebot abgeben",
      "Keine Teilnahmeantrags-Phase, keine Verhandlungen",
      "Angebotsfrist: mindestens 35 Tage (Oberschwellenbereich)",
      "Zuschlag auf das wirtschaftlichste Angebot",
    ],
    faq: [
      {
        question: "Was ist das offene Verfahren?",
        answer: "Im offenen Verfahren kann jedes interessierte Unternehmen direkt ein Angebot abgeben, ohne vorher einen Teilnahmeantrag stellen zu müssen. Es ist das transparenteste und häufigste Vergabeverfahren.",
      },
      {
        question: "Wie lange ist die Frist im offenen Verfahren?",
        answer: "Die Angebotsfrist im offenen Verfahren beträgt im Oberschwellenbereich mindestens 35 Tage ab Absendung der Bekanntmachung. Im Unterschwellenbereich (UVgO) sind kürzere Fristen möglich.",
      },
      {
        question: "Kann im offenen Verfahren verhandelt werden?",
        answer: "Nein, im offenen Verfahren sind Verhandlungen über die Angebote ausgeschlossen. Der Zuschlag wird allein auf Basis der eingereichten Angebote und der vorab bekannt gemachten Zuschlagskriterien erteilt.",
      },
    ],
    relatedTerms: ["beschraenktes-verfahren", "verhandlungsverfahren", "vgv-vergabeverordnung"],
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
    relatedTerms: ["offenes-verfahren", "verhandlungsverfahren"],
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
      "Die freihändige Vergabe ist ein Verfahren im Unterschwellenbereich (UVgO und § 3 VOB/A), bei dem der Auftraggeber die Möglichkeit hat, mit mehreren, aber einer begrenzten Zahl von Unternehmen zu verhandeln. Sie ist das Unterschwellen-Pendant zum Verhandlungsverfahren.",
      "Der Auftraggeber wählt die Unternehmen, mit denen er verhandelt, nach pflichtgemäßem Ermessen aus. Die Zahl der Unternehmen muss so groß sein, dass ein echter Wettbewerb gewährleistet ist, in der Regel mindestens drei.",
      "Die freihändige Vergabe ist zulässig, wenn die Auftragsbedingungen nicht eindeutig bestimmt werden können oder wenn aufgrund der Dringlichkeit oder der besonderen Komplexität andere Verfahren nicht praktikabel sind.",
    ],
    keyPoints: [
      "Unterschwellenverfahren (UVgO / § 3 VOB/A)",
      "Verhandlung mit ausgewählten Unternehmen möglich",
      "Mindestens 3 angefragte Unternehmen für Wettbewerb",
      "Pendant zum Verhandlungsverfahren im Oberschwellenbereich",
    ],
    faq: [
      {
        question: "Was ist die freihändige Vergabe?",
        answer: "Die freihändige Vergabe ist ein Vergabeverfahren im Unterschwellenbereich, bei dem der Auftraggeber mit ausgewählten Unternehmen verhandeln kann. Sie ist das Pendant zum Verhandlungsverfahren im Oberschwellenbereich.",
      },
      {
        question: "Wann ist die freihändige Vergabe zulässig?",
        answer: "Die freihändige Vergabe ist zulässig, wenn die Auftragsbedingungen nicht eindeutig bestimmt werden können, bei besonderer Dringlichkeit oder Komplexität oder wenn andere Verfahren nicht praktikabel sind. Sie erfordert in der Regel die Anfrage von mindestens drei Unternehmen.",
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
    relatedTerms: ["leistungsbeschreibung", "leistungsverzeichnis", "offenes-verfahren"],
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
    relatedTerms: ["leistungsverzeichnis", "ausschreibung", "eigenerklaerung"],
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
    relatedTerms: ["leistungsbeschreibung", "gaeb", "ausschreibung"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA"],
  },
  {
    slug: "bindefrist",
    term: "Bindefrist",
    category: "Vergabeprozess",
    shortDefinition: "Die Bindefrist ist der Zeitraum, während dessen ein Bieter an sein Angebot gebunden ist und den Zuschlag annehmen muss.",
    definition: [
      "Die Bindefrist ist ein zentraler Begriff im Vergaberecht. Sie definiert den Zeitraum, während dessen ein Bieter an sein abgegebenes Angebot gebunden ist. Der Bieter kann innerhalb dieser Frist sein Angebot nicht zurückziehen und muss den Zuschlag annehmen, wenn er ihn erhält.",
      "Die Bindefrist wird vom Auftraggeber in der Ausschreibung festgelegt. Sie muss angemessen sein und wird durch die Angebotsfrist ausgelöst, läuft also ab dem Tag der Angebotseröffnung. Die Bindefrist muss so lang sein, dass der Auftraggeber ausreichend Zeit für die Prüfung der Angebote hat.",
      "Läuft die Bindefrist ab, ohne dass der Bieter den Zuschlag erhalten hat, kann er sein Angebot zurückziehen. Der Auftraggeber muss die Bindefrist beachten und darf den Zuschlag nicht mehr nach Ablauf erteilen.",
    ],
    keyPoints: [
      "Zeitraum, in dem der Bieter an sein Angebot gebunden ist",
      "Wird vom Auftraggeber festgelegt",
      "Beginnt mit der Angebotseröffnung",
      "Nach Ablauf: Bieter kann Angebot zurückziehen",
    ],
    faq: [
      {
        question: "Was ist die Bindefrist bei einer Ausschreibung?",
        answer: "Die Bindefrist ist der Zeitraum, in dem ein Bieter an sein Angebot gebunden ist und den Zuschlag annehmen muss. Sie wird vom Auftraggeber festgelegt und beginnt mit der Angebotseröffnung.",
      },
      {
        question: "Wie lange ist eine typische Bindefrist?",
        answer: "Eine typische Bindefrist beträgt 30 bis 60 Tage ab Angebotseröffnung. Die genaue Dauer hängt von der Komplexität der Ausschreibung und dem Vergabeverfahren ab. Sie muss so lang sein, dass der Auftraggeber die Angebote sorgfältig prüfen kann.",
      },
    ],
    relatedTerms: ["ausschreibung", "zuschlag", "angebot"],
  },
  {
    slug: "zuschlag",
    term: "Zuschlag",
    category: "Vergabeprozess",
    shortDefinition: "Der Zuschlag ist die Annahme eines Angebots durch den Auftraggeber und führt zum Vertragsabschluss.",
    definition: [
      "Der Zuschlag ist die verbindliche Annahme eines Angebots durch den öffentlichen Auftraggeber. Mit dem Zuschlag kommt der Vertrag zwischen Auftraggeber und Bieter zustande. Der Zuschlag muss schriftlich und eindeutig formuliert sein.",
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
        answer: "Ja, nicht berücksichtigte Bieter können den Zuschlag angreifen, wenn sie der Meinung sind, dass das Verfahren fehlerhaft war. Dies muss innerhalb bestimmter Fristen (in der Regel 15 Tage nach Information) über ein Nachprüfungsverfahren geschehen.",
      },
    ],
    relatedTerms: ["zuschlagskriterien", "bindefrist", "nachpruefungsverfahren"],
  },
  {
    slug: "angebot",
    term: "Angebot",
    category: "Vergabeprozess",
    shortDefinition: "Das Angebot ist die verbindliche Erklärung eines Bieters, eine Leistung zu bestimmten Bedingungen zu erbringen.",
    definition: [
      "Das Angebot ist die verbindliche Erklärung eines Unternehmens (Bieters), eine Leistung zu den in der Ausschreibung genannten Bedingungen zu erbringen. Es ist die Grundlage für den späteren Vertrag und muss klar, eindeutig und vollständig sein.",
      "Das Angebot muss alle geforderten Inhalte enthalten: Preise, technische Lösungen, Eigenerklärungen zur Eignung, Referenzen und sonstige geforderte Unterlagen. Unvollständige Angebote können ausgeschlossen werden.",
      "Im Vergabeverfahren wird das wirtschaftlichste Angebot mit dem Zuschlag bedacht. Das bedeutet nicht zwingend das günstigste Angebot, sondern das Verhältnis von Preis und Leistung gemäß den Zuschlagskriterien.",
    ],
    keyPoints: [
      "Verbindliche Erklärung zur Leistungserbringung",
      "Muss klar, eindeutig und vollständig sein",
      "Grundlage für den späteren Vertrag",
      "Wirtschaftlichstes Angebot erhält den Zuschlag",
    ],
    faq: [
      {
        question: "Was ist ein Angebot im Vergaberecht?",
        answer: "Ein Angebot ist die verbindliche Erklärung eines Bieters, eine Leistung zu bestimmten Bedingungen zu erbringen. Es muss vollständig und fristgerecht eingereicht werden und ist Grundlage für den Vertragsschluss.",
      },
      {
        question: "Können unvollständige Angebote berücksichtigt werden?",
        answer: "Unvollständige Angebote können ausgeschlossen werden, wenn wesentliche Angaben fehlen. Der Auftraggeber darf aber Nachklärungen zu formalen Mängeln verlangen, wenn das Angebot sonst als brauchbar zu bewerten ist.",
      },
    ],
    relatedTerms: ["zuschlag", "bindefrist", "eignungskriterien"],
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
    relatedTerms: ["nachunternehmer", "eignungskriterien", "angebot"],
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
      "Aus vergaberechtlicher Sicht ist relevant, dass die Einschaltung von Nachunternehmern nicht zur Umgehung von Tariftreue- oder Vergabepflichten führen darf. Bei bestimmten Vergaben gelten besondere Nachunternehmeregelungen (z.B. VgV, Tariftreuegesetz).",
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
    relatedTerms: ["bietergemeinschaft", "eignungskriterien", "angebot"],
  },

  // === EIGNUUNG & ZUSCHLAG ===
  {
    slug: "eignungskriterien",
    term: "Eignungskriterien",
    category: "Eignung & Zuschlag",
    shortDefinition: "Eignungskriterien sind die Kriterien, anhand derer der Auftraggeber beurteilt, ob ein Bieter fachlich, wirtschaftlich und rechtlich zur Auftragsausführung geeignet ist.",
    definition: [
      "Eignungskriterien sind die Maßstäbe, anhand derer der Auftraggeber feststellt, ob ein Bieter die notwendige fachliche, wirtschaftliche und rechtliche Eignung für die Durchführung des Auftrags besitzt. Bieter, die die Eignungskriterien nicht erfüllen, müssen vom Verfahren ausgeschlossen werden.",
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
    relatedTerms: ["zuschlagskriterien", "eigenerklaerung", "referenzen"],
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
    relatedTerms: ["eignungskriterien", "zuschlag", "angebot"],
  },
  {
    slug: "eigenerklaerung",
    term: "Eigenerklärung (EEE)",
    category: "Eignung & Zuschlag",
    shortDefinition: "Die Einheitliche Europäische Eigenerklärung (EEE) ist ein Standardformular, das Bieter zur Eignungsprüfung ausfüllen.",
    definition: [
      "Die Einheitliche Europäische Eigenerklärung (EEE) ist ein standardisiertes Formular, das im Rahmen von öffentlichen Vergabeverfahren in der EU verwendet wird. Der Bieter erklärt damit seine Eignung für den Auftrag, ohne im ersten Schritt Nachweise vorlegen zu müssen.",
      "Die EEE umfasst Erklärungen zur Befähigung, Fachkunde, Leistungsfähigkeit und Zuverlässigkeit. Sie ist verbindlich für alle Oberschwellenvergaben in der EU und erleichtert die grenzüberschreitende Teilnahme an Vergabeverfahren.",
      "Der Auftraggeber kann die Richtigkeit der Eigenerklärung jederzeit überprüfen, in der Regel vor der Zuschlagserteilung an den erfolgreichen Bieter. Falsche Angaben können zum Angebotsausschluss führen.",
    ],
    keyPoints: [
      "Standardisiertes Formular zur Eignungsklärung",
      "Verbindlich für alle EU-Oberschwellenvergaben",
      "Selbsterklärung statt sofortiger Nachweisvorlage",
      "Überprüfbar bei Zuschlagserteilung",
    ],
    faq: [
      {
        question: "Was ist die Einheitliche Europäische Eigenerklärung (EEE)?",
        answer: "Die EEE ist ein standardisiertes Formular, in dem der Bieter im Rahmen der Eignungsprüfung seine Befähigung, Fachkunde, Leistungsfähigkeit und Zuverlässigkeit selbst erklärt. Sie ist verbindlich für EU-Oberschwellenvergaben.",
      },
      {
        question: "Müssen Nachweise vorgelegt werden?",
        answer: "Die EEE ist eine vorläufige Selbsterklärung. Erst der erfolgreiche Bieter muss bei Zuschlagserteilung die entsprechenden Nachweise (Zertifikate, Referenzen, Steuerbescheinigungen etc.) vorlegen.",
      },
    ],
    relatedTerms: ["eignungskriterien", "referenzen"],
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
    relatedTerms: ["eignungskriterien", "eigenerklaerung"],
  },

  // === SCHWELLENWERTE ===
  {
    slug: "schwellenwerte",
    term: "Schwellenwerte",
    category: "Schwellenwerte",
    shortDefinition: "Schwellenwerte sind finanzielle Grenzen, ab denen EU-weite Vergabeverfahren und Bekanntmachungen verpflichtend werden.",
    definition: [
      "Schwellenwerte sind zentrale vergaberechtliche Grenzwerte, die bestimmen, ab welchem Auftragswert die vergaberechtlichen Vorschriften des europäischen Vergaberechts (Oberschwellenbereich) gelten. Unterhalb der Schwellenwerte gilt das nationale Vergaberecht (Unterschwellenbereich).",
      "Die Schwellenwerte werden von der Europäischen Kommission alle zwei Jahre überprüft und angepasst. Sie unterscheiden sich nach Auftragsart (Lieferungen, Dienstleistungen, Bauleistungen) und Auftraggeberart (klassische Auftraggeber, Sektorenauftraggeber).",
      "Für 2026/2027 gelten je nach Auftraggeber und Leistungsart unterschiedliche EU-Schwellenwerte. Beispielsweise gelten 140.000 EUR für bestimmte zentrale Regierungsbehörden, 216.000 EUR für sonstige bestimmte Liefer- und Dienstleistungsaufträge und 5.404.000 EUR für Bauaufträge.",
    ],
    keyPoints: [
      "Grenzwert zwischen Ober- und Unterschwellenbereich",
      "Werden alle 2 Jahre von der EU-Kommission angepasst",
      "2026/2027: 140.000 EUR bzw. 216.000 EUR für bestimmte Liefer- und Dienstleistungsaufträge",
      "2026/2027: 5.404.000 EUR für Bauaufträge",
    ],
    faq: [
      {
        question: "Welche EU-Schwellenwerte gelten 2026 und 2027?",
        answer: "Für 2026 und 2027 gelten je nach Auftraggeber und Auftragsart unterschiedliche Werte. Die zentralen Kontrollwerte sind 140.000 EUR für bestimmte zentrale Regierungsbehörden, 216.000 EUR für sonstige bestimmte Liefer- und Dienstleistungsaufträge sowie 5.404.000 EUR für Bauaufträge; Konzessionen liegen ebenfalls bei 5.404.000 EUR.",
      },
      {
        question: "Was passiert bei Überschreitung des Schwellenwerts?",
        answer: "Bei Überschreitung des einschlägigen Schwellenwerts gelten die Regeln des Oberschwellenbereichs. Dazu gehören insbesondere die EU-weite Bekanntmachung und die Vorschriften des vierten Teils des GWB. Bei Liefer- und Dienstleistungen ist regelmäßig die VgV maßgeblich; bei Bauaufträgen gelten VOB/A Abschnitt 2 und die nach § 2 VgV anwendbaren Vorschriften. Unter den gesetzlichen Voraussetzungen ist ein Nachprüfungsverfahren nach dem GWB möglich.",
      },
      {
        question: "Wie wird der Auftragswert berechnet?",
        answer: "Der Auftragswert wird grundsätzlich als Gesamtwert des Auftrags inklusive aller Optionen und Verlängerungen berechnet. Abhängig von der Art des Auftrags gibt es unterschiedliche Berechnungsmethoden. Bei regelmäßig wiederkehrenden Leistungen ist die Laufzeit zu berücksichtigen.",
      },
    ],
    relatedTerms: ["auftragswert", "vgv-vergabeverordnung", "uvgo", "eu-vergaberichtlinien"],
    relatedArticles: ["schwellenwerte-vergabe", "vob-vergabe"],
  },
  {
    slug: "auftragswert",
    term: "Auftragswert",
    category: "Schwellenwerte",
    shortDefinition: "Der Auftragswert ist der geschätzte Gesamtwert eines öffentlichen Auftrags. Er entscheidet über die Anwendung ober- oder unterschwelliger Vorschriften.",
    definition: [
      "Der Auftragswert ist der geschätzte Gesamtwert eines öffentlichen Auftrags. Er ist maßgeblich für die Bestimmung, ob die Vorgaben des Ober- oder Unterschwellenbereichs anwendbar sind. Die Berechnung muss sorgfältig und nachvollziehbar erfolgen.",
      "Bei der Berechnung des Auftragswerts sind alle mit dem Vertrag verbundenen Kosten zu berücksichtigen, einschließlich eventueller Optionen, Verlängerungen und Nebenkosten. Der Auftragswert ist vorab zu schätzen und zu dokumentieren.",
      "Verschiedene Auftragsarten haben unterschiedliche Berechnungsmethoden: Bei Liefer- und Dienstleistungen kann der Wert anhand der vergangenen Abrechnungen oder der Marktanalyse geschätzt werden. Bei Bauleistungen werden die Baukosten inklusive Planung angesetzt.",
    ],
    keyPoints: [
      "Geschätzter Gesamtwert eines öffentlichen Auftrags",
      "Entscheidet über Ober- oder Unterschwellenbereich",
      "Alle Kosten inklusive Optionen und Verlängerungen",
      "Vorab zu schätzen und zu dokumentieren",
    ],
    faq: [
      {
        question: "Wie wird der Auftragswert berechnet?",
        answer: "Der Auftragswert wird als Gesamtwert des Auftrags inklusive Optionen, Verlängerungen und Nebenkosten berechnet. Die Berechnungsmethode hängt von der Auftragsart ab (Lieferungen/Dienstleistungen vs. Bauleistungen). Er muss vorab geschätzt und dokumentiert werden.",
      },
      {
        question: "Warum ist der Auftragswert wichtig?",
        answer: "Der Auftragswert entscheidet darüber, ob die Vorgaben des Ober- oder Unterschwellenbereichs anwendbar sind. Oberhalb der EU-Schwellenwerte gelten strengere Regeln (EU-weite Bekanntmachung, VgV statt UVgO, erweiterte Nachprüfungsmöglichkeiten).",
      },
    ],
    relatedTerms: ["schwellenwerte", "vgv-vergabeverordnung", "uvgo"],
    relatedArticles: ["schwellenwerte-vergabe"],
  },

  // === NACHPRÜFUNG ===
  {
    slug: "nachpruefungsverfahren",
    term: "Nachprüfungsverfahren",
    category: "Nachprüfung",
    shortDefinition: "Das Nachprüfungsverfahren erlaubt es Bietern, Verstöße gegen Vergabevorschriften durch öffentliche Auftraggeber zu rügen.",
    definition: [
      "Das Nachprüfungsverfahren ist ein förmliches Verfahren, das es Unternehmen ermöglicht, vermeintliche Verstöße gegen das Vergaberecht durch öffentliche Auftraggeber überprüfen zu lassen. Es ist im vierten Teil des GWB geregelt.",
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
        answer: "Ein Nachprüfungsverfahren bei der Vergabekammer dauert in der Regel einige Wochen bis Monate, abhängig von der Komplexität des Falls. Gegen die Entscheidung kann Beschwerde beim Vergabesenat des Oberlandesgerichts eingelegt werden.",
      },
    ],
    relatedTerms: ["ruege", "vergabekammer", "vergabesenat", "gwb-vergaberecht"],
  },
  {
    slug: "ruege",
    term: "Rüge",
    category: "Nachprüfung",
    shortDefinition: "Die Rüge ist die formelle Beanstandung eines Vergaberechtsverstoßes durch einen Bieter gegenüber dem Auftraggeber.",
    definition: [
      "Die Rüge ist die förmliche Beanstandung eines vermuteten Vergaberechtsverstoßes durch einen Bieter gegenüber dem öffentlichen Auftraggeber. Sie ist Voraussetzung für ein späteres Nachprüfungsverfahren: Erst wenn die Rüge erfolglos bleibt, kann die Vergabekammer angerufen werden.",
      "Eine Rüge muss unverzüglich nach Kenntnisnahme des angeblichen Verstoßes erfolgen. Der Bieter muss klar benennen, welcher Verstoß gegen welche Vergabevorschrift vorliegen soll. Der Auftraggeber hat dann die Möglichkeit, den Verstoß zu korrigieren.",
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
        answer: "Eine Rüge ist die formelle Beanstandung eines vermuteten Vergaberechtsverstoßes durch einen Bieter gegenüber dem Auftraggeber. Sie muss unverzüglich erfolgen und klar benannt sein. Erst nach erfolgloser Rüge kann die Vergabekammer angerufen werden.",
      },
      {
        question: "Wie muss eine Rüge formuliert sein?",
        answer: "Eine Rüge muss den vermuteten Verstoß klar und konkret benennen: Welcher Vorgang verstößt gegen welche Vorschrift? Eine pauschale Rüge reicht nicht aus. Die Rüge sollte schriftlich erfolgen und eine Frist zur Stellungnahme setzen.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "vergabekammer"],
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
    shortDefinition: "Der Vergabesenat ist die Berufungsinstanz bei Oberlandesgerichten für Entscheidungen der Vergabekammern.",
    definition: [
      "Der Vergabesenat ist die zweite Instanz im Nachprüfungsverfahren. Er ist bei den Oberlandesgerichten (OLG) angesiedelt und entscheidet über Beschwerden gegen Entscheidungen der Vergabekammern.",
      "Der Vergabesenat prüft, ob die Vergabekammer das Vergaberecht richtig angewendet hat. Er kann die Entscheidung der Vergabekammer bestätigen, ändern oder aufheben und an die Vergabekammer zurückverweisen.",
      "Eine weitere Rechtsbeschwerde zum Bundesgerichtshof kommt nur unter den gesetzlichen Voraussetzungen in Betracht. Ob ein Rechtsmittel möglich ist, hängt daher von der konkreten Entscheidung und den Vorgaben des GWB ab.",
    ],
    keyPoints: [
      "Berufungsinstanz bei Oberlandesgerichten (OLG)",
      "Zweite Instanz im Nachprüfungsverfahren",
      "Entscheidet über Beschwerden gegen Vergabekammer-Entscheidungen",
      "Entscheidungen sind endgültig",
    ],
    faq: [
      {
        question: "Was ist ein Vergabesenat?",
        answer: "Der Vergabesenat ist die zweite Instanz im Nachprüfungsverfahren, angesiedelt bei den Oberlandesgerichten. Er entscheidet über Beschwerden gegen Entscheidungen der Vergabekammern und kann diese bestätigen, ändern oder aufheben.",
      },
      {
        question: "Kann man gegen Vergabesenatsentscheidungen vorgehen?",
        answer: "Gegen Entscheidungen des Vergabesenats ist keine weitere Beschwerde im Nachprüfungsverfahren möglich. Die Entscheidungen sind endgültig. In Ausnahmefällen kann der Weg zu allgemeinen Zivilgerichten oder zum Bundesverfassungsgericht offenstehen.",
      },
    ],
    relatedTerms: ["nachpruefungsverfahren", "vergabekammer"],
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
    shortDefinition: "eForms ist der EU-Standard für strukturierte elektronische Vergabebekanntmachungen, der seit 2025 stufenweise verwendet wird.",
    definition: [
      "eForms ist ein neuer, standardisierter elektronischer Standard für Vergabebekanntmachungen in der Europäischen Union. Er löst die bisherigen Formulare (wie die Standardformulare für Bekanntmachungen) ab und soll die Transparenz, Vergleichbarkeit und Auffindbarkeit von Vergabeverfahren verbessern.",
      "eForms basiert auf einem strukturierten XML-Format und ermöglicht die maschinenlesbare Verarbeitung von Bekanntmachungen. Dadurch können Ausschreibungen leichter durchsucht, gefiltert und analysiert werden — ein Vorteil sowohl für Auftraggeber als auch für Bieter.",
      "eForms werden seit 2025 für die unionsrechtlich erfassten Bekanntmachungen stufenweise eingesetzt. Die konkrete Umsetzung erfolgt über die zuständigen elektronischen Vergabesysteme und die jeweils geltenden Bekanntmachungspflichten.",
    ],
    keyPoints: [
      "Neuer EU-Standard für Vergabebekanntmachungen",
      "Löst bisherige Standardformulare ab",
      "Maschinenlesbares XML-Format",
      "Seit 2025 unionsweit maßgeblicher Bekanntmachungsstandard",
    ],
    faq: [
      {
        question: "Was sind eForms?",
        answer: "eForms ist der EU-Standard für strukturierte elektronische Vergabebekanntmachungen. Die Formulare basieren auf maschinenlesbaren Daten und verbessern Transparenz und Auffindbarkeit.",
      },
      {
        question: "Ab wann sind eForms verpflichtend?",
        answer: "eForms werden seit 2025 unionsweit für die einschlägigen Bekanntmachungen eingesetzt. Welche Bekanntmachung konkret erforderlich ist, richtet sich nach dem Verfahren und den geltenden elektronischen Vergaberegeln.",
      },
    ],
    relatedTerms: ["cpv-code", "eu-vergaberichtlinien", "gaeb"],
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
      "TED (Tenders Electronic Daily) ist das offizielle Online-Portal der Europäischen Union für die Veröffentlichung von Vergabebekanntmachungen. Alle öffentlichen Aufträge oberhalb der EU-Schwellenwerte müssen hier veröffentlicht werden, damit sie EU-weit sichtbar sind.",
      "Das Portal wird vom Amt für Veröffentlichungen der Europäischen Union betrieben und ist kostenlos nutzbar. Es bietet eine Suchfunktion, mit der Bieter gezielt nach Aufträgen filtern können — nach Land, CPV-Code, Auftragsart und anderen Kriterien.",
      "Neben Bekanntmachungen bietet TED auch Informationen über Zuschlagserteilungen, Korrekturen und Verfahrensaufhebungen. Für Unternehmen mit internationaler Ausrichtung ist TED eine unverzichtbare Informationsquelle.",
    ],
    keyPoints: [
      "Offizielles EU-Vergabeportal",
      "Verpflichtend für alle Oberschwellenvergaben",
      "Kostenlose Nutzung für Bieter",
      "Suche nach Land, CPV-Code, Auftragsart möglich",
    ],
    faq: [
      {
        question: "Was ist TED?",
        answer: "TED (Tenders Electronic Daily) ist das offizielle Vergabeportal der Europäischen Union. Alle Oberschwellenvergaben müssen hier veröffentlicht werden. Es ist kostenlos nutzbar und bietet vielfältige Suchfunktionen.",
      },
      {
        question: "Müssen alle Ausschreibungen auf TED veröffentlicht werden?",
        answer: "Nein, nur Aufträge oberhalb der EU-Schwellenwerte müssen auf TED veröffentlicht werden. Für Unterschwellenvergaben genügt die Veröffentlichung auf nationalen oder regionalen Portalen wie DTVP oder evergabe.",
      },
    ],
    relatedTerms: ["eu-vergaberichtlinien", "schwellenwerte", "cpv-code"],
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
    shortDefinition: "Tariftreue bedeutet, dass Auftragnehmer bei öffentlichen Aufträgen die einschlägigen Tariflöhne zahlen müssen.",
    definition: [
      "Tariftreue ist ein Begriff aus dem öffentlichen Beschaffungswesen, der besagt, dass Auftragnehmer bei der Ausführung öffentlicher Aufträge verpflichtet sind, ihren Beschäftigten mindestens den einschlägigen Tariflohn zu zahlen.",
      "Die Tariftreuepflicht ist in verschiedenen Gesetzen geregelt, darunter das Tariftreuegesetz (Tarifaugleichungsgesetz) des Bundes und entsprechende Landesgesetze. Sie gilt für bestimmte öffentliche Aufträge und soll Lohndumping verhindern und faire Wettbewerbsbedingungen schaffen.",
      "Auftraggeber müssen die Einhaltung der Tariftreue bei der Vergabe prüfen und können Verträge kündigen, wenn der Auftragnehmer gegen die Tariftreuepflicht verstößt.",
    ],
    keyPoints: [
      "Pflicht zur Zahlung des Tariflohns bei öffentlichen Aufträgen",
      "Geregelt im Tariftreuegesetz (Bund) und Landesgesetzen",
      "Soll Lohndumping verhindern",
      "Auftraggeber prüfen Einhaltung",
    ],
    faq: [
      {
        question: "Was bedeutet Tariftreue bei öffentlichen Aufträgen?",
        answer: "Tariftreue bedeutet, dass Auftragnehmer bei öffentlichen Aufträgen verpflichtet sind, mindestens den einschlägigen Tariflohn zu zahlen. Dies ist im Tariftreuegesetz und in Landesgesetzen geregelt.",
      },
      {
        question: "Gilt die Tariftreuepflicht für alle öffentlichen Aufträge?",
        answer: "Die Tariftreuepflicht gilt nicht für alle öffentlichen Aufträge, sondern für bestimmte Arten und Größenordnungen. Die genauen Voraussetzungen sind im Tariftreuegesetz des Bundes und in den jeweiligen Landesgesetzen geregelt.",
      },
    ],
    relatedTerms: ["auftraggeber"],
    relatedCategories: ["Gebaeudereinigung", "Facility Management"],
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
      "Vor der Zuschlagserteilung muss der Auftraggeber die nicht berücksichtigten Bieter über die beabsichtigte Zuschlagserteilung informieren und ihnen die Möglichkeit geben, den Zuschlag zu überprüfen (Nachprüfungsverfahren). Diese Information muss bestimmte Angaben enthalten (z.B. Name des erfolgreichen Bieters, Zuschlagskriterien, Rangfolge der Angebote).",
      "Die Wartefrist nach dieser Information beträgt in der Regel 15 Tage (bei elektronischer Übermittlung 10 Tage). Erst nach Ablauf der Frist kann der Zuschlag formell erteilt werden. Die Zuschlagserteilung muss schriftlich erfolgen und den Bieter über die Annahme seines Angebots informieren.",
    ],
    keyPoints: [
      "Förmliche Beauftragung eines Bieters",
      "Erfolgt nach Prüfung aller Angebote",
      "Informations- und Wartepflicht gegenüber unterlegenen Bietern",
      "Wartefrist: 15 Tage (10 bei elektronischer Übermittlung)",
    ],
    faq: [
      {
        question: "Was ist die Zuschlagserteilung?",
        answer: "Die Zuschlagserteilung ist die förmliche Beauftragung eines Bieters nach Abschluss des Vergabeverfahrens. Sie muss schriftlich erfolgen und ist der Abschluss des Vergabeverfahrens.",
      },
      {
        question: "Wie läuft die Zuschlagserteilung ab?",
        answer: "Vor der Zuschlagserteilung müssen unterlegene Bieter informiert werden. Nach einer Wartefrist (15 Tage bzw. 10 Tage bei elektronischer Übermittlung) kann der Zuschlag formell erteilt werden. In dieser Frist können Bieter Nachprüfungsanträge stellen.",
      },
    ],
    relatedTerms: ["zuschlag", "nachpruefungsverfahren", "bindefrist"],
  },
  {
    slug: "bieterfragen",
    term: "Bieterfragen",
    category: "Vergabeprozess",
    shortDefinition: "Bieterfragen sind Anfragen von Bietern zur Ausschreibung, die während der Angebotsfrist gestellt werden können.",
    definition: [
      "Bieterfragen sind Anfragen, die Bieter während der Angebotsfrist an den Auftraggeber richten können, um Unklarheiten oder Fragen zur Ausschreibung zu klären. Der Auftraggeber ist verpflichtet, Bieterfragen fristgerecht und vollständig zu beantworten.",
      "Die Antworten auf Bieterfragen werden in der Regel allen Bietern zeitgleich zur Verfügung gestellt (anonymisiert), um die Gleichbehandlung sicherzustellen. Bei erheblichen Fragen kann der Auftraggeber die Angebotsfrist verlängern, um Bietern ausreichend Zeit für die Angebotsabgabe zu geben.",
      "Bieterfragen sind ein wichtiges Instrument zur Klärung von Unklarheiten und zur Verbesserung der Qualität der Angebote. Sie können sich auf alle Aspekte der Ausschreibung beziehen: Leistungsbeschreibung, Eignungskriterien, Zuschlagskriterien, Vertragsbedingungen.",
    ],
    keyPoints: [
      "Anfragen von Bietern zur Ausschreibung",
      "Während der Angebotsfrist",
      "Auftraggeber muss antworten, Antworten an alle Bieter",
      "Können zu Fristverlängerung führen",
    ],
    faq: [
      {
        question: "Was sind Bieterfragen?",
        answer: "Bieterfragen sind Anfragen, die Bieter während der Angebotsfrist an den Auftraggeber stellen können, um Unklarheiten zur Ausschreibung zu klären. Der Auftraggeber muss diese fristgerecht und vollständig beantworten.",
      },
      {
        question: "Müssen Antworten auf Bieterfragen veröffentlicht werden?",
        answer: "Ja, die Antworten müssen allen Bietern zeitgleich und anonymisiert zur Verfügung gestellt werden. Nur so wird die Gleichbehandlung der Bieter sichergestellt. Bei erheblichen Fragen kann die Angebotsfrist verlängert werden.",
      },
    ],
    relatedTerms: ["ausschreibung", "leistungsbeschreibung"],
  },
  {
    slug: "angebotseroeffnung",
    term: "Angebotseröffnung",
    category: "Vergabeprozess",
    shortDefinition: "Die Angebotseröffnung ist der Zeitpunkt, zu dem die eingegangenen Angebote vom Auftraggeber geöffnet und erfasst werden.",
    definition: [
      "Die Angebotseröffnung ist der formelle Akt, bei dem der öffentliche Auftraggeber die eingegangenen Angebote nach Ablauf der Einreichungsfrist öffnet und erfasst. Im offenen Verfahren findet die Eröffnung in der Regel öffentlich statt; Bieter können teilnehmen.",
      "Bei der Eröffnung werden die Angebote in ihrer äußeren Form erfasst (Absender, Datum, Unversehrtheit) und die wesentlichen Bedingungen wie Preis und Fristen bekannt gegeben. Eine inhaltliche Bewertung erfolgt jedoch erst nach der Eröffnung.",
      "Im beschränkten Verfahren und in anderen Verfahrensarten gibt es in der Regel keine öffentliche Eröffnung, da die Angebote nur von ausgewählten Bietern angefordert wurden.",
    ],
    keyPoints: [
      "Formeller Akt der Öffnung und Erfassung der Angebote",
      "Im offenen Verfahren oft öffentlich",
      "Erfassung von Absender, Datum, Unversehrtheit",
      "Inhaltliche Bewertung erfolgt erst später",
    ],
    faq: [
      {
        question: "Was ist die Angebotseröffnung?",
        answer: "Die Angebotseröffnung ist der Zeitpunkt, zu dem der Auftraggeber die eingegangenen Angebote nach Ablauf der Einreichungsfrist öffnet und erfasst. Im offenen Verfahren kann dies öffentlich stattfinden.",
      },
      {
        question: "Können Bieter der Angebotseröffnung beiwohnen?",
        answer: "Im offenen Verfahren können Bieter in der Regel der Angebotseröffnung beiwohnen. Im beschränkten Verfahren oder bei anderen Verfahrensarten ist dies nicht üblich, da die Angebote nur von ausgewählten Bietern angefordert wurden.",
      },
    ],
    relatedTerms: ["angebot", "offenes-verfahren", "ausschreibung"],
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
        answer: "Eine Direktvergabe ist nur in engen Ausnahmefällen zulässig: bei Unterschreitung der Schwellenwerte und Vorliegen der Voraussetzungen für freihändige Vergabe, bei Einzigartigkeit der Leistung, bei extremem Zeitdruck oder bei Wiederholungsaufträgen.",
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
