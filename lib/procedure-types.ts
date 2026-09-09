// SEO: Procedure type landing pages — German Vergabeverfahren with editorial content and FAQ.
// Used for /ausschreibungen/verfahren/[type] landing pages targeting queries like
// "offenes Verfahren Ausschreibungen", "Verhandlungsverfahren Vergabe".

export interface ProcedureTypeEntry {
  slug: string;
  label: string;
  keyword: string;
  description: string;
  intro: string;
  details: string;
  faq: Array<{ question: string; answer: string }>;
}

export const PROCEDURE_TYPES: Record<string, ProcedureTypeEntry> = {
  offen: {
    slug: "offen",
    label: "Offenes Verfahren",
    keyword: "offenes Verfahren",
    description:
      "Offene Verfahren — öffentliche Ausschreibungen nach offener Vergabe. Alle interessierten Bieter können ohne vorherige Auswahl ein Angebot abgeben.",
    intro:
      "Das offene Verfahren ist das häufigste Vergabeverfahren in Deutschland. Jedes interessierte Unternehmen kann ohne vorherige Teilnahmebeschränkung ein Angebot abgeben. Der Auftraggeber veröffentlicht die Ausschreibung öffentlich, und alle Bieter werden gleich behandelt.",
    details:
      "Beim offenen Verfahren gibt der Auftraggeber eine öffentliche Bekanntmachung heraus. Interessierte Unternehmen reichen innerhalb der festgelegten Frist (mindestens35 Tage bei EU-Schwellenwert, mindestens20 Tage unterhalb) ihre Angebote ein. Es gibt keine vorherige Auswahl der Bieter — das Verfahren ist für alle Unternehmen offen. Die Vergabe erfolgt nach den festgelegten Zuschlagskriterien (niedrigster Preis oder wirtschaftlichstes Angebot).",
    faq: [
      {
        question: "Was ist ein offenes Verfahren?",
        answer:
          "Beim offenen Verfahren kann jedes interessierte Unternehmen ein Angebot abgeben. Es gibt keine vorherige Auswahl der Bieter. Die Ausschreibung wird öffentlich bekanntgemacht, und alle Angebote werden nach festgelegten Kriterien bewertet.",
      },
      {
        question: "Welche Fristen gelten beim offenen Verfahren?",
        answer:
          "Die Angebotsfrist richtet sich nach dem konkreten Verfahren und den einschlägigen Vorschriften. Im EU-Oberschwellenbereich gelten die jeweils aktuellen EU-Schwellenwerte und formalen Fristvorgaben; unterhalb gelten nationale Regeln.",
      },
      {
        question: "Für welche Aufträge eignet sich das offene Verfahren?",
        answer:
          "Das offene Verfahren eignet sich besonders für standardisierte Leistungen mit klar definierten Anforderungen, bei denen ein breiter Bieterkreis erwünscht ist. Es ist das Standardverfahren für Bau-, Liefer- und Dienstleistungsaufträge.",
      },
      {
        question: "Welche Vorteile hat das offene Verfahren für Bieter?",
        answer:
          "Vorteile sind: Keine Teilnahmebeschränkung, transparentes Verfahren, faire Wettbewerbsbedingungen und die Möglichkeit, sich direkt mit einem Angebot zu beteiligen, ohne sich vorher qualifizieren zu müssen.",
      },
    ],
  },
  "beschraenkt": {
    slug: "beschraenkt",
    label: "Beschränktes Verfahren",
    keyword: "beschränktes Verfahren",
    description:
      "Beschränkte Verfahren — öffentliche Ausschreibungen mit vorheriger Bieterauswahl. Nur eingeladene Unternehmen dürfen Angebote abgeben.",
    intro:
      "Beim beschränkten Verfahren wählt der Auftraggeber zunächst eine begrenzte Anzahl von Unternehmen aus, die zur Angebotsabgabe eingeladen werden. Die Auswahl erfolgt auf Basis von Eignungskriterien wie Referenzen, finanzieller Leistungsfähigkeit und technischer Fähigkeiten.",
    details:
      "Das beschränkte Verfahren gliedert sich in zwei Phasen: In der ersten Phase interessieren sich Unternehmen für die Teilnahme, und der Auftraggeber wählt anhand von Eignungskriterien (mindestens3, maximal5 bei EU-Vergaben) Bieter aus. In der zweiten Phase laden die ausgewählten Unternehmen zur Angebotsabgabe ein. Dieses Verfahren wird bei komplexen Leistungen eingesetzt, bei denen eine Vorqualifikation sinnvoll ist.",
    faq: [
      {
        question: "Was ist ein beschränktes Verfahren?",
        answer:
          "Beim beschränkten Verfahren lädt der Auftraggeber nur eine ausgewählte Anzahl von Unternehmen zur Angebotsabgabe ein. Die Auswahl erfolgt auf Basis von Eignungskriterien nach einer öffentlichen Bekanntmachung.",
      },
      {
        question: "Wie viele Bieter werden beim beschränkten Verfahren eingeladen?",
        answer:
          "Bei EU-Schwellenwert-Vergaben müssen mindestens3 und höchstens5 Bieter eingeladen werden. Unterhalb der Schwellenwerte kann die Anzahl flexibler festgelegt werden.",
      },
      {
        question: "Wie bewerbe ich mich für ein beschränktes Verfahren?",
        answer:
          "Reichen Sie zunächst einen Teilnahmeantrag mit den geforderten Eignungsnachweisen ein. Der Auftraggeber prüft die Eingaben und entscheidet, welche Unternehmen zur Angebotsabgabe eingeladen werden.",
      },
    ],
  },
  verhandelt: {
    slug: "verhandelt",
    label: "Verhandlungsverfahren",
    keyword: "Verhandlungsverfahren",
    description:
      "Verhandlungsverfahren — öffentliche Ausschreibungen mit Verhandlung. Auftraggeber und Bieter verhandeln über Konditionen und Leistungsumfang.",
    intro:
      "Beim Verhandlungsverfahren verhandelt der Auftraggeber mit einem oder mehreren Bietern über die Bedingungen des Auftrags. Dieses Verfahren ist in bestimmten Fällen zulässig, z.B. bei komplexen Leistungen, bei denen die genauen Spezifikationen im Vorfeld nicht festgelegt werden können.",
    details:
      "Das Verhandlungsverfahren kommt zum Einsatz, wenn die Leistung so komplex ist, dass die Spezifikationen nicht im Voraus festgelegt werden können, oder wenn der Auftraggeber die wirtschaftlichste Lösung ermitteln möchte. Es gibt zwei Varianten: mit und ohne Teilnahmewettbewerb. Beim Verhandlungsverfahren mit Teilnahmewettbewerb erfolgt zunächst eine öffentliche Bekanntmachung, danach werden ausgewählte Bieter zu Verhandlungen eingeladen.",
    faq: [
      {
        question: "Was ist ein Verhandlungsverfahren?",
        answer:
          "Beim Verhandlungsverfahren verhandeln Auftraggeber und Bieter über Preis, Leistungsumfang und andere Bedingungen. Es eignet sich für komplexe Leistungen, bei denen die genauen Anforderungen nicht im Voraus festgelegt werden können.",
      },
      {
        question: "Wann ist ein Verhandlungsverfahren zulässig?",
        answer:
          "Zulässig bei: komplexen Leistungen (z.B. Forschung, Softwareentwicklung), wenn die Spezifikationen nicht genau definiert werden können, bei Innovationsprojekten und wenn nur wenige Anbieter den Markt bedienen.",
      },
      {
        question: "Was ist der Unterschied zwischen Verhandlungsverfahren mit und ohne Teilnahmewettbewerb?",
        answer:
          "Mit Teilnahmewettbewerb: Öffentliche Bekanntmachung, Auswahl der Bieter nach Eignungskriterien, dann Verhandlung. Ohne Teilnahmewettbewerb: Direkte Einladung ausgewählter Unternehmen (nur in Ausnahmefällen zulässig).",
      },
    ],
  },
  dialog: {
    slug: "dialog",
    label: "Wettbewerblicher Dialog",
    keyword: "Wettbewerblicher Dialog",
    description:
      "Wettbewerblicher Dialog — öffentliche Ausschreibungen mit Dialogverfahren. Auftraggeber und Bieter erarbeiten gemeinsam die beste Lösung.",
    intro:
      "Der wettbewerbliche Dialog ist ein Vergabeverfahren für besonders komplexe Aufträge, bei denen der Auftraggeber die technischen, rechtlichen oder finanziellen Anforderungen nicht genau spezifizieren kann. Im Dialog werden gemeinsam mit den Bietern Lösungsansätze erarbeitet.",
    details:
      "Der wettbewerbliche Dialog beginnt mit einer öffentlichen Bekanntmachung. Interessierte Unternehmen reichen einen Teilnahmeantrag ein. Der Auftaggeber lädt dann mindestens3 qualifizierte Bieter zum Dialog ein. In mehreren Gesprächsrunden werden die Lösungsansätze diskutiert und verfeinert. Nach Abschluss des Dialogs reichen die Bieter ihre endgültigen Angebote ein.",
    faq: [
      {
        question: "Was ist ein wettbewerblicher Dialog?",
        answer:
          "Der wettbewerbliche Dialog ist ein Vergabeverfahren für komplexe Aufträge. Auftraggeber und ausgewählte Bieter erarbeiten gemeinsam im Dialog die technisch und wirtschaftlich beste Lösung.",
      },
      {
        question: "Wann wird ein wettbewerblicher Dialog eingesetzt?",
        answer:
          "Bei besonders komplexen Aufträgen (z.B. IT-Systeme, Infrastrukturprojekte), bei denen die genauen Anforderungen nicht im Voraus definiert werden können und ein innovativer Lösungsansatz benötigt wird.",
      },
      {
        question: "Wie läuft ein wettbewerblicher Dialog ab?",
        answer:
          "Öffentliche Bekanntmachung → Teilnahmeanträge → Auswahl mindestens3 Bieter → mehrere Dialogrunden → Abschluss des Dialogs → Angebotsabgabe → Zuschlag.",
      },
    ],
  },
  innovation: {
    slug: "innovation",
    label: "Innovationspartnerschaft",
    keyword: "Innovationspartnerschaft",
    description:
      "Innovationspartnerschaft — öffentliche Ausschreibungen für innovative Produkte und Dienstleistungen. Gemeinsame Forschung und Entwicklung mit dem Auftraggeber.",
    intro:
      "Die Innovationspartnerschaft ist ein Vergabeverfahren für innovative Produkte, Dienstleistungen oder Bauwerke, die noch nicht auf dem Markt verfügbar sind. Auftraggeber und Bieter entwickeln gemeinsam die Innovation und können anschließend die resultierenden Produkte oder Leistungen erwerben.",
    details:
      "Die Innovationspartnerschaft kombiniert Forschung und Entwicklung mit der Beschaffung. Der Auftraggeber veröffentlicht eine Bekanntmachung, in der er den Innovationsbedarf beschreibt. Qualifizierte Bieter werden ausgewählt und schließen eine Partnerschaft ab. Die Entwicklung erfolgt in Phasen mit klaren Meilensteinen. Nach erfolgreicher Entwicklung kann der Auftraggeber die resultierenden Leistungen abnehmen.",
    faq: [
      {
        question: "Was ist eine Innovationspartnerschaft?",
        answer:
          "Die Innovationspartnerschaft ist ein Vergabeverfahren, bei dem Auftraggeber und Bieter gemeinsam innovative Produkte oder Dienstleistungen entwickeln. Sie kombiniert Forschung und Entwicklung mit der Beschaffung.",
      },
      {
        question: "Wann kommt eine Innovationspartnerschaft zum Einsatz?",
        answer:
          "Wenn es auf dem Markt keine geeigneten Produkte oder Lösungen gibt und eine Neuentwicklung erforderlich ist. Typisch für IT-Systeme, Technologieprojekte und innovative Verwaltungslösungen.",
      },
      {
        question: "Welche Phasen hat eine Innovationspartnerschaft?",
        answer:
          "Die Partnerschaft gliedert sich in Forschungs- und Entwicklungsphasen mit Meilensteinen. Nach jeder Phase kann der Auftraggeber entscheiden, ob die Entwicklung fortgesetzt wird.",
      },
    ],
  },
};

export const ALL_PROCEDURE_TYPE_SLUGS = Object.keys(PROCEDURE_TYPES);

const PROCEDURE_DATABASE_VALUES: Record<string, string[]> = {
  offen: ["offen"],
  // Older scraper records keep the German umlaut while the route uses an ASCII slug.
  beschraenkt: ["beschraenkt", "beschränkt"],
  verhandelt: ["verhandelt"],
  dialog: ["dialog"],
  innovation: ["innovation"],
};

export function getProcedureDatabaseValues(slug: string): string[] {
  return PROCEDURE_DATABASE_VALUES[slug] ?? [slug];
}
