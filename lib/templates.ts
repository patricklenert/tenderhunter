// SEO: Vorlagen Hub — template/document pages targeting commercial download-intent keywords
// Target keywords: "deckblatt vgv vorlage", "eigenerklärung vorlage", "leistungsverzeichnis muster", etc.

export interface TemplateEntry {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: "Angebotsunterlagen" | "Eignungsnachweise" | "Vertragsbedingungen" | "Leistungsbeschreibung" | "Korrespondenz" | "Baubetrieb";
  intro: string[];
  whenToUse: string[];
  contents: string[];
  tips: string[];
  faq: Array<{ question: string; answer: string }>;
  relatedTemplates?: string[];
  relatedCategories?: string[];
}

export const TEMPLATES: TemplateEntry[] = [
  {
    slug: "deckblatt-vgv-vorlage",
    title: "Deckblatt VgV Vorlage",
    metaTitle: "Deckblatt VgV Vorlage – Kostenlose Musterdeckblätter für Vergaben",
    metaDescription: "Kostenlose Deckblatt VgV Vorlage zum Download. Professionelles Deckblatt für VgV-Vergaben mit allen Pflichtfeldern. Jetzt herunterladen.",
    category: "Angebotsunterlagen",
    intro: [
      "Das Deckblatt VgV ist das erste Dokument, das der Bieter bei einer Vergabe nach der Vergabeverordnung (VgV) einreicht. Es enthält die wesentlichen Informationen zum Bieter und zum Angebot und ermöglicht dem Auftraggeber eine schnelle Zuordnung.",
      "Eine professionelle Deckblatt VgV Vorlage sollte folgende Elemente enthalten: Absender (Bieter), Empfänger (Vergabestelle), Betreff mit Aktenzeichen und Vergabeverfahren, Datum, sowie die Unterschrift des autorisierten Vertreters.",
      "Das Deckblatt ist Teil der äußeren Form des Angebots und wird bei der Angebotseröffnung als erstes geprüft. Ein fehlerhaftes oder unvollständiges Deckblatt kann zum Ausschluss des Angebots führen.",
    ],
    whenToUse: [
      "Bei allen Vergaben nach VgV (Lieferungen und Dienstleistungen über EU-Schwellenwerten)",
      "Bei offenen, beschränkten und Verhandlungsverfahren nach VgV",
      "Als erste Seite des Angebotsdokuments",
    ],
    contents: [
      "Absender mit Firma, Ansprechpartner, Adresse und Kontaktdaten",
      "Empfänger (Vergabestelle) mit Aktenzeichen",
      "Betreff: Vergabeverfahren, Projektname, Frist",
      "Datum und Ort der Angebotsabgabe",
      "Unterschrift (bei elektronischer Einreichung: qualifizierte elektronische Signatur)",
    ],
    tips: [
      "Verwenden Sie das im Vergabeverfahren vorgegebene Deckblatt, falls der Auftraggeber ein Muster bereitstellt",
      "Achten Sie auf die korrekte Angabe des Aktenzeichens — falsche Zuordnungen führen zum Ausschluss",
      "Prüfen Sie die Anforderung zur elektronischen Signatur (QES) vor der Einreichung",
      "Behalten Sie eine Kopie des Deckblatts mit Einreichungszeitpunkt für Ihre Unterlagen",
    ],
    faq: [
      {
        question: "Was ist ein Deckblatt VgV?",
        answer: "Das Deckblatt VgV ist das erste Dokument eines Angebots bei Vergaben nach der Vergabeverordnung (VgV). Es enthält die wesentlichen Informationen zum Bieter, Empfänger, Verfahren und Datum.",
      },
      {
        question: "Ist das Deckblatt VgV Pflicht?",
        answer: "Ein Deckblatt ist nicht explizit gesetzlich vorgeschrieben, aber bei der meisten Vergaben nach VgV wird es vom Auftraggeber gefordert oder ist branchenüblich. Fehlt das Deckblatt oder ist es unvollständig, kann das Angebot ausgeschlossen werden.",
      },
      {
        question: "Wie wird das Deckblatt VgV unterschrieben?",
        answer: "Das Deckblatt muss vom autorisierten Vertreter des Bieters unterschrieben werden. Bei elektronischer Einreichung (DEUP) ist in der Regel eine qualifizierte elektronische Signatur (QES) erforderlich.",
      },
    ],
    relatedTemplates: ["eigenerklaerung-vorlage", "angebot-vorlage-ausschreibung"],
    relatedCategories: ["Lieferung", "IT-Dienstleistungen", "Planungsleistungen"],
  },
  {
    slug: "eigenerklaerung-vorlage",
    title: "Eigenerklärung Vorlage (EEE)",
    metaTitle: "Eigenerklärung Vorlage (EEE) – Einheitliche Europäische Eigenerklärung Download",
    metaDescription: "Kostenlose Eigenerklärung Vorlage (EEE – Einheitliche Europäische Eigenerklärung) für Vergabeverfahren. Alle Pflichtfelder nach EU-Recht.",
    category: "Eignungsnachweise",
    intro: [
      "Die Einheitliche Europäische Eigenerklärung (EEE) ist ein standardisiertes Formular, das im Rahmen von öffentlichen Vergabeverfahren in der EU verwendet wird. Der Bieter erklärt damit seine Eignung für den Auftrag (Fachkunde, Leistungsfähigkeit, Zuverlässigkeit) ohne im ersten Schritt Nachweise vorlegen zu müssen.",
      "Die EEE ist verbindlich für alle Oberschwellenvergaben in der EU und wurde mit den EU-Vergaberichtlinien 2014 eingeführt. Sie erleichtert die grenzüberschreitende Teilnahme an Vergabeverfahren, da Bieter nicht für jedes Land unterschiedliche Formulare ausfüllen müssen.",
      "Der Auftraggeber kann die Richtigkeit der Eigenerklärung jederzeit überprüfen, in der Regel vor der Zuschlagserteilung an den erfolgreichen Bieter. Falsche Angaben können zum Angebotsausschluss und in schweren Fällen zu Schadensersatzforderungen führen.",
    ],
    whenToUse: [
      "Bei allen EU-Oberschwellenvergaben (VgV, SektVO, KonzVgV)",
      "Als Eignungserklärung statt sofortiger Nachweisvorlage",
      "Bei der Teilnahmeantragstellung oder Angebotsabgabe",
    ],
    contents: [
      "Angaben zum Bieter (Firma, Rechtsform, Registernummer, Ansprechpartner)",
      "Erklärung zur Befähigung und Fachkunde (Qualifikationen, Zertifikate)",
      "Erklärung zur beruflichen und technischen Leistungsfähigkeit",
      "Erklärung zur Zuverlässigkeit (keine Ausschlussgründe nach § 123 GWB)",
      "Umsatzzahlen und Referenzen (bei komplexeren Vergaben)",
      "Erklärung zur Zahlung von Steuern und Sozialabgaben",
    ],
    tips: [
      "Bereiten Sie die EEE frühzeitig vor — nicht erst am Tag der Angebotsabgabe",
      "Sammeln Sie die zugrundeliegenden Nachweise (Zertifikate, Steuerbescheinigungen) parallel, auch wenn diese erst bei Zuschlag vorgelegt werden müssen",
      "Achten Sie auf Vollständigkeit — unvollständige Eigenerklärungen führen zum Ausschluss",
      "Prüfen Sie, ob der Auftraggeber ein eigenes EEE-Formular bereitstellt oder das EU-Standardformular akzeptiert",
    ],
    faq: [
      {
        question: "Was ist die Einheitliche Europäische Eigenerklärung (EEE)?",
        answer: "Die EEE ist ein standardisiertes Formular, das Bieter im Rahmen der Eignungsprüfung ausfüllen. Es ersetzt die sofortige Vorlage von Nachweisen und ist für alle EU-Oberschwellenvergaben verbindlich.",
      },
      {
        question: "Müssen alle Nachweise vorgelegt werden?",
        answer: "Nein, die EEE ist eine vorläufige Selbsterklärung. Erst der erfolgreiche Bieter muss bei Zuschlagserteilung die entsprechenden Nachweise (Zertifikate, Referenzen, Steuerbescheinigungen) vorlegen.",
      },
      {
        question: "Kann die Eigenerklärung elektronisch eingereicht werden?",
        answer: "Ja, die EEE kann elektronisch eingereicht werden. In der Regel wird sie über das eVergabe-System des Auftraggebers hochgeladen. Eine qualifizierte elektronische Signatur (QES) kann erforderlich sein.",
      },
    ],
    relatedTemplates: ["deckblatt-vgv-vorlage", "referenznachweis-vorlage", "angebot-vorlage-ausschreibung"],
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Gebaeudereinigung"],
  },
  {
    slug: "leistungsverzeichnis-vorlage",
    title: "Leistungsverzeichnis Vorlage (LV)",
    metaTitle: "Leistungsverzeichnis Vorlage & Muster – LV Excel/Word Download",
    metaDescription: "Kostenlose Leistungsverzeichnis Vorlage (LV) als Excel und Word. Strukturiertes Muster für Bau- und Dienstleistungsvergaben mit allen Positionen.",
    category: "Leistungsbeschreibung",
    intro: [
      "Ein Leistungsverzeichnis (LV) ist ein strukturierter Katalog aller Einzelposten, die im Rahmen einer Bauleistung oder Dienstleistung erbracht werden müssen. Es enthält für jeden Posten eine klare Beschreibung, die Einheit (m², Stück, Stunden), die Menge und oft einen Preisansatz.",
      "Das LV ist Grundlage für die Angebotsabgabe und die spätere Abrechnung. Der Bieter füllt seine Preise in das LV ein, und die Summe ergibt sein Angebot. Nach Zuschlag wird das LV zur Grundlage der Rechnungsstellung und der Leistungsabnahme.",
      "Im Bauwesen wird das LV oft als GAEB-Datei ausgetauscht, einem standardisierten XML-Format, das den Austausch zwischen Auftraggebern und Bietern erleichtert.",
    ],
    whenToUse: [
      "Bei Ausschreibungen von Bauleistungen und komplexeren Dienstleistungen",
      "Als Grundlage für die Angebotskalkulation und -abgabe",
      "Für die spätere Abrechnung und Leistungsabnahme",
    ],
    contents: [
      "Titel und Beschreibung des Projekts",
      "Strukturierte Gliederung nach Gewerken oder Leistungsgruppen",
      "Positionen mit Positionsnummer, Beschreibung, Einheit und Menge",
      "Spalten für Einzelpreis und Gesamtpreis",
      "Zusammenfassung der Gewerke und Gesamtangebotspreis",
      "Hinweise zur Ausführung und Spezifikationen",
    ],
    tips: [
      "Verwenden Sie eine klare und logische Gliederung nach Gewerken oder Leistungsgruppen",
      "Beschreiben Sie jede Position präzise und vermeiden Sie Mehrdeutigkeiten",
      "Geben Sie die korrekte Einheit an (m², m³, Stück, Stunden etc.)",
      "Stimmen Sie die Mengenangaben mit der Leistungsbeschreibung ab",
      "Nutzen Sie GAEB-kompatible Software, wenn der Auftraggeber GAEB-Dateien erwartet",
    ],
    faq: [
      {
        question: "Was ist ein Leistungsverzeichnis?",
        answer: "Ein Leistungsverzeichnis (LV) ist ein strukturierter Katalog aller Einzelposten einer Bauleistung oder Dienstleistung mit Beschreibung, Einheit, Menge und Preis. Es ist Grundlage für Angebot und Abrechnung.",
      },
      {
        question: "Wie erstelle ich ein Leistungsverzeichnis?",
        answer: "Ein LV wird aus der Leistungsbeschreibung abgeleitet. Sie strukturieren die Leistung in Gewerken, definieren Positionen mit Beschreibung, Einheit und Menge, und fügen Spalten für Preise hinzu. Excel-Vorlagen oder spezialisierte LV-Software helfen dabei.",
      },
      {
        question: "Was ist der Unterschied zwischen LV und Leistungsbeschreibung?",
        answer: "Die Leistungsbeschreibung definiert die Anforderungen an die Leistung (das 'Was'), das Leistungsverzeichnis listet die konkreten Einzelposten mit Mengen und Preisen auf (das 'Wie viel'). Beide zusammen bilden die Grundlage der Ausschreibung.",
      },
    ],
    relatedTemplates: ["leistungsbeschreibung-vorlage", "gaeb-vorlage"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "TGA"],
  },
  {
    slug: "leistungsbeschreibung-vorlage",
    title: "Leistungsbeschreibung Vorlage",
    metaTitle: "Leistungsbeschreibung Vorlage & Muster – Kostenlos Download",
    metaDescription: "Kostenlose Leistungsbeschreibung Vorlage für Ausschreibungen. Funktionale und detaillierte Muster für Bau- und Dienstleistungsvergaben.",
    category: "Leistungsbeschreibung",
    intro: [
      "Die Leistungsbeschreibung definiert, welche Leistung vom Auftragnehmer erbracht werden muss und legt die technischen, funktionalen und qualitativen Anforderungen fest. Sie ist das zentrale Dokument einer jeden Ausschreibung.",
      "Eine gute Leistungsbeschreibung ist konkret, eindeutig und vollständig. Sie ermöglicht es den Bietern, die Anforderungen zu verstehen und vergleichbare Angebote zu erstellen. Gleichzeitig lässt sie Raum für innovative Lösungen.",
      "Es werden funktionale Leistungsbeschreibungen (Anforderungen an das Ergebnis) und detaillierte Leistungsbeschreibungen (genaue Vorgaben zur Ausführung) unterschieden. Der Trend geht zur funktionalen Beschreibung, die dem Bieter mehr Gestaltungsfreiheit lässt.",
    ],
    whenToUse: [
      "Bei allen Ausschreibungen als zentrales Vergabedokument",
      "Zur Definition der Anforderungen an die zu erbringende Leistung",
      "Als Grundlage für das Leistungsverzeichnis und die Angebotsabgabe",
    ],
    contents: [
      "Titel und Beschreibung des Auftragsgegenstands",
      "Funktionale oder detaillierte Anforderungen",
      "Technische Spezifikationen und Normen",
      "Qualitätsanforderungen und Prüfkriterien",
      "Umwelt- und Nachhaltigkeitsanforderungen",
      "Liefer- oder Leistungsfristen",
    ],
    tips: [
      "Beschreiben Sie das Ergebnis, nicht nur die Ausführung — funktionale Beschreibungen sind oft besser",
      "Vermeiden Sie produkt- oder markenspezifische Vorgaben (gehen Sie 'oder gleichwertig' an)",
      "Stützen Sie sich auf anerkannte Normen (DIN, EN, ISO) statt eigene Spezifikationen zu erfinden",
      "Prüfen Sie die Leistungsbeschreibung auf Vollständigkeit und Widerspruchsfreiheit",
    ],
    faq: [
      {
        question: "Wie schreibe ich eine Leistungsbeschreibung?",
        answer: "Eine Leistungsbeschreibung sollte konkret, eindeutig und vollständig sein. Definieren Sie die Anforderungen an das Ergebnis oder die Ausführung, verwenden Sie Normen als Referenz, und vermeiden Sie zu detaillierte Vorgaben, die Innovation verhindern.",
      },
      {
        question: "Was ist der Unterschied zwischen funktionaler und detaillierter Leistungsbeschreibung?",
        answer: "Die funktionale Leistungsbeschreibung definiert das gewünschte Ergebnis ('was'), die detaillierte Leistungsbeschreibung gibt genaue Vorgaben zur Ausführung ('wie'). Funktionale Beschreibungen lassen dem Bieter mehr Gestaltungsspielraum.",
      },
    ],
    relatedTemplates: ["leistungsverzeichnis-vorlage", "ausschreibung-muster"],
    relatedCategories: ["Bauarbeiten", "Tiefbau", "Facility Management"],
  },
  {
    slug: "bvb-vorlage",
    title: "BVB Vorlage (Besondere Vertragsbedingungen)",
    metaTitle: "BVB Vorlage – Besondere Vertragsbedingungen Muster Download",
    metaDescription: "Kostenlose BVB Vorlage (Besondere Vertragsbedingungen) für Vergaben. Alle wesentlichen Vertragsklauseln für öffentliche Aufträge.",
    category: "Vertragsbedingungen",
    intro: [
      "Die Besonderen Vertragsbedingungen (BVB) ergänzen die Allgemeinen Vertragsbedingungen (z.B. VOB/B, VOL/B) um projektspezifische Regelungen. Sie enthalten die besonderen Klauseln, die für den konkreten Auftrag gelten.",
      "Die BVB sind Teil der Vergabeunterlagen und müssen vom Bieter bei der Angebotsabgabe akzeptiert werden. Sie regeln unter anderem: Zahlungsbedingungen, Vertragsstrafen, Gewährleistung, Versicherungen, Abnahme modalitäten und besondere Pflichten des Auftragnehmers.",
      "Da die BVB rechtlich bindend sind, sollten sie sorgfältig formuliert werden. Unklare oder widersprüchliche Klauseln können zu Streitigkeiten im Vertragsverhältnis führen.",
    ],
    whenToUse: [
      "Bei allen öffentlichen Vergaben mit projektspezifischen Vertragsklauseln",
      "Zur Ergänzung der VOB/B oder VOL/B",
      "Als Teil der Vergabeunterlagen",
    ],
    contents: [
      "Zahlungsbedingungen (Fristen, Skonto, Abschlagszahlungen)",
      "Vertragsstrafen bei verspäteter Leistung",
      "Gewährleistungsfristen und -bedingungen",
      "Versicherungspflichten (Betriebshaftpflicht, Bauversicherung)",
      "Abnahme modalitäten und Abnahmefristen",
      "Besondere Pflichten (Baustelleneinrichtung, Sicherheit, Dokumentation)",
    ],
    tips: [
      "Prüfen Sie die BVB vor Angebotsabgabe sorgfältig — unvorhergesehene Klauseln können das Angebot unwirtschaftlich machen",
      "Achten Sie auf Vertragsstrafen und Gewährleistungsfristen — diese können das Risiko erheblich erhöhen",
      "Vergleichen Sie die BVB mit den branchenüblichen Klauseln (z.B. VOB/B für Bau)",
      "Klären Sie Unklarheiten vor Angebotsabgabe durch Bieterfragen",
    ],
    faq: [
      {
        question: "Was sind Besondere Vertragsbedingungen (BVB)?",
        answer: "Die BVB ergänzen die Allgemeinen Vertragsbedingungen (z.B. VOB/B) um projektspezifische Klauseln. Sie enthalten Zahlungsbedingungen, Vertragsstrafen, Gewährleistung und andere projektbezogene Regelungen.",
      },
      {
        question: "Sind die BVB verhandelbar?",
        answer: "Im Vergabeverfahren sind die BVB in der Regel nicht verhandelbar. Der Bieter muss sie akzeptieren oder sein Angebot zurückziehen. Im Nachverhandlungsstadium (Verhandlungsverfahren) können einzelne Klauseln besprochen werden.",
      },
    ],
    relatedTemplates: ["leistungsverzeichnis-vorlage", "ausschreibung-muster"],
    relatedCategories: ["Bauarbeiten", "Facility Management"],
  },
  {
    slug: "angebot-vorlage-ausschreibung",
    title: "Angebot Vorlage Ausschreibung",
    metaTitle: "Angebot Vorlage für Ausschreibungen – Muster & Struktur Download",
    metaDescription: "Kostenlose Angebot Vorlage für öffentliche Ausschreibungen. Professionelle Struktur für Angebotschreiben mit allen Pflichtelementen.",
    category: "Angebotsunterlagen",
    intro: [
      "Das Angebot ist die verbindliche Erklärung eines Bieters, eine Leistung zu bestimmten Bedingungen zu erbringen. Es muss klar, eindeutig und vollständig sein und alle in der Ausschreibung geforderten Inhalte enthalten.",
      "Ein professionelles Angebot umfasst mehrere Komponenten: Deckblatt, Begleitschreiben, Eigenerklärung (EEE), Eignungsnachweise, Leistungsverzeichnis mit Preisen, und eventuell Konzept oder technische Lösung.",
      "Im Vergabeverfahren wird das wirtschaftlichste Angebot mit dem Zuschlag bedacht. Das bedeutet nicht zwingend das günstigste Angebot, sondern das Verhältnis von Preis und Leistung gemäß den Zuschlagskriterien.",
    ],
    whenToUse: [
      "Bei allen Vergabeverfahren als zentrales Angebotsdokument",
      "Als Strukturhilfe für die vollständige Angebotsabgabe",
      "Zur Sicherstellung, dass alle Pflichtelemente enthalten sind",
    ],
    contents: [
      "Deckblatt mit Absender, Empfänger, Aktenzeichen, Datum",
      "Begleitschreiben mit Kurzpräsentation des Bieters",
      "Eigenerklärung (EEE) zur Eignung",
      "Ausgefülltes Leistungsverzeichnis mit Preisen",
      "Endpreis mit allen Nebenkosten (netto/brutto)",
      "Gültigkeit des Angebots (Bindefrist)",
    ],
    tips: [
      "Strukturieren Sie das Angebot nach den Vorgaben des Auftraggebers — Abweichungen führen zum Ausschluss",
      "Vergewissern Sie sich, dass alle geforderten Dokumente (EEE, Zertifikate, Referenzen) beiliegen",
      "Prüfen Sie die Preise sorgfältig auf Plausibilität — Tippfehler können zum Gewinnverlust führen",
      "Geben Sie eine klare Bindefrist an (in der Regel vom Auftraggeber vorgegeben)",
    ],
    faq: [
      {
        question: "Was muss ein Angebot bei einer Ausschreibung enthalten?",
        answer: "Ein Angebot muss alle geforderten Elemente enthalten: Deckblatt, Eigenerklärung (EEE), ausgefülltes Leistungsverzeichnis mit Preisen, und eventuell weitere Unterlagen wie Referenzen oder Konzept. Die genauen Anforderungen stehen in den Vergabeunterlagen.",
      },
      {
        question: "Was passiert bei Fehlern im Angebot?",
        answer: "Rechenfehler oder offensichtliche Unstimmigkeiten können nachgeklärt werden. Wesentliche Mängel (fehlende Unterlagen, falsche Preise, unklare Angaben) können zum Ausschluss führen. Prüfen Sie Ihr Angebot daher vor Abgabe sorgfältig.",
      },
    ],
    relatedTemplates: ["deckblatt-vgv-vorlage", "eigenerklaerung-vorlage", "begleitschreiben-ausschreibung-muster"],
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Gebaeudereinigung"],
  },
  {
    slug: "begleitschreiben-ausschreibung-muster",
    title: "Begleitschreiben Ausschreibung Muster",
    metaTitle: "Begleitschreiben Ausschreibung Muster – Professionelle Vorlage Download",
    metaDescription: "Kostenloses Begleitschreiben Muster für Ausschreibungen. Professionelle Vorlage für Angebotsanschreiben mit überzeugender Struktur.",
    category: "Korrespondenz",
    intro: [
      "Das Begleitschreiben ist der erste Text, den der Auftraggeber beim Öffnen des Angebots liest. Es sollte den Bieter professionell präsentieren, das Verständnis der Aufgabe zeigen und die wesentlichen Stärken des Angebots hervorheben.",
      "Ein gutes Begleitschreiben ist kurz (maximal 1-2 Seiten), gut strukturiert und auf die jeweilige Ausschreibung zugeschnitten. Es ersetzt nicht das eigentliche Angebot, sondern ergänzt es um eine persönliche Note.",
      "Bei Vergaben, die eine qualitative Bewertung umfassen (Zuschlagskriterien wie Qualität, Konzept), kann das Begleitschreiben ein entscheidender Faktor sein, um sich von Mitbewerbern abzuheben.",
    ],
    whenToUse: [
      "Bei allen Ausschreibungen als Begleitung zum Hauptangebot",
      "Zur kurzen Präsentation des Bieters und der Angebotsschwerpunkte",
      "Bei qualitativen Zuschlagskriterien zur Hervorhebung der Stärken",
    ],
    contents: [
      "Absender- und Empfängeradresse",
      "Datum und Betreff mit Aktenzeichen",
      "Anrede (formal: 'Sehr geehrte Damen und Herren,')",
      "Einleitung: Bezug auf die Ausschreibung",
      "Hauptteil: Kurzpräsentation, Verständnis der Aufgabe, Stärken des Angebots",
      "Schluss: Bindefrist, Kontaktdaten, Unterschrift",
    ],
    tips: [
      "Personalisieren Sie das Begleitschreiben — keine Standardtexte verwenden",
      "Heben Sie 2-3 konkrete Stärken hervor, die für den Auftrag relevant sind",
      "Verweisen Sie auf Referenzprojekte mit ähnlicher Komplexität",
      "Halten Sie sich kurz — Auftraggeber haben viele Angebote zu prüfen",
    ],
    faq: [
      {
        question: "Muss ein Begleitschreiben bei einer Ausschreibung sein?",
        answer: "Ein Begleitschreiben ist nicht immer zwingend vorgeschrieben, aber empfohlen. Bei qualitativen Zuschlagskriterien kann es helfen, das Angebot positiv von Mitbewerbern abzuheben. Bei reinen Preisvergaben ist es weniger entscheidend.",
      },
      {
        question: "Wie lang sollte ein Begleitschreiben sein?",
        answer: "Ein Begleitschreiben sollte maximal 1-2 Seiten lang sein. Der Auftraggeber hat viele Angebote zu prüfen und schätzt Prägnanz. Fokussieren Sie sich auf die wesentlichen Stärken Ihres Angebots.",
      },
    ],
    relatedTemplates: ["angebot-vorlage-ausschreibung", "deckblatt-vgv-vorlage"],
  },
  {
    slug: "bieterfrage-muster",
    title: "Bieterfrage Muster",
    metaTitle: "Bieterfrage Muster & Vorlage – Wie man richtig rügt und fragt",
    metaDescription: "Kostenlose Bieterfrage Vorlage für Vergabeverfahren. Professionelle Musterformulierung für Vergaberechtsfragen und Rügen.",
    category: "Korrespondenz",
    intro: [
      "Bieterfragen sind Anfragen, die Bieter während der Angebotsfrist an den Auftraggeber richten können, um Unklarheiten oder Fragen zur Ausschreibung zu klären. Der Auftraggeber ist verpflichtet, Bieterfragen fristgerecht und vollständig zu beantworten.",
      "Eine gut formulierte Bieterfrage sollte konkret und klar benennen, wo eine Unklarheit besteht und was der Bieter vorschlägt. Sie ist auch ein strategisches Instrument: Gut platzierte Fragen können die Wettbewerbsposition verbessern oder auf vergaberechtliche Mängel hinweisen.",
      "Bei vermuteten Vergaberechtsverstößen ist die Bieterfrage der erste Schritt zur Rüge. Eine spätere Nachprüfung setzt voraus, dass zunächst eine erfolglose Rüge versucht wurde.",
    ],
    whenToUse: [
      "Bei Unklarheiten in der Leistungsbeschreibung oder den Vertragsbedingungen",
      "Bei vermuteten Vergaberechtsverstößen (Vorläufer zur Rüge)",
      "Zur Klärung von Fristen, Anforderungen oder Bewertungsmethoden",
    ],
    contents: [
      "Absender mit Kontaktdaten",
      "Empfänger (Vergabestelle) mit Aktenzeichen",
      "Betreff: 'Bieterfrage zum Vergabeverfahren [Aktenzeichen]'",
      "Konkrete Frage mit Bezug zur Ausschreibungsstelle",
      "Vorschlag oder Bitte um Klarstellung",
      "Fristsetzung zur Antwort",
    ],
    tips: [
      "Formulieren Sie die Frage klar und konkret — keine pauschalen Anfragen",
      "Beziehen Sie sich auf konkrete Stellen der Vergabeunterlagen (Seite, Position)",
      "Behalten Sie eine Kopie der Frage und der Antwort für Ihre Unterlagen",
      "Prüfen Sie die Antwort sorgfältig auf vergaberechtliche Implikationen",
    ],
    faq: [
      {
        question: "Wie formiere ich eine Bieterfrage?",
        answer: "Eine Bieterfrage sollte konkret und klar formuliert sein. Beziehen Sie sich auf konkrete Stellen der Vergabeunterlagen, stellen Sie die Frage präzise und schlagen Sie, wenn möglich, eine Lösung vor. Setzen Sie eine Frist zur Antwort.",
      },
      {
        question: "Ist eine Bieterfrage Pflicht?",
        answer: "Eine Bieterfrage ist nicht generell Pflicht, aber bei vergaberechtlichen Verstößen ist sie Vorstufe zur Rüge. Eine spätere Nachprüfung bei der Vergabekammer setzt voraus, dass zunächst versucht wurde, den Verstoß im Verfahren zu klären.",
      },
    ],
    relatedTemplates: ["ruege-muster", "begleitschreiben-ausschreibung-muster"],
  },
  {
    slug: "ausschreibung-muster",
    title: "Ausschreibung Muster / Checkliste",
    metaTitle: "Ausschreibung Muster & Checkliste – Vorlage für Auftraggeber Download",
    metaDescription: "Kostenloses Ausschreibung Muster und Checkliste für Auftraggeber. Alle Schritte und Dokumente für eine rechtssichere Vergabe.",
    category: "Angebotsunterlagen",
    intro: [
      "Eine Ausschreibung muss verschiedene rechtliche und formale Anforderungen erfüllen, um rechtssicher zu sein. Ein Ausschreibungsmuster hilft Auftraggebern, alle notwendigen Elemente zu berücksichtigen und Fehler zu vermeiden.",
      "Zu den Kernbestandteilen einer Ausschreibung gehören: Bekanntmachung, Vergabeunterlagen (Leistungsbeschreibung, Eignungskriterien, Zuschlagskriterien, Vertragsbedingungen), Fristen, und Bieterfragen/antworten.",
      "Eine Checkliste stellt sicher, dass alle Schritte des Vergabeverfahrens in der richtigen Reihenfolge und unter Einhaltung der vergaberechtlichen Vorgaben durchgeführt werden.",
    ],
    whenToUse: [
      "Für Auftraggeber bei der Vorbereitung einer Ausschreibung",
      "Zur Sicherstellung aller vergaberechtlichen Schritte",
      "Als Strukturhilfe für die Erstellung der Vergabeunterlagen",
    ],
    contents: [
      "Bedarfsermittlung und Auftragswertberechnung",
      "Wahl des Vergabeverfahrens (offen, beschränkt, etc.)",
      "Vergabeunterlagen: Leistungsbeschreibung, Eignung, Zuschlagskriterien, BVB",
      "Bekanntmachung (DTVP, TED, evergabe)",
      "Angebotsfrist und Bindefrist",
      "Angebotseröffnung und Wertung",
      "Zuschlagserteilung und Information der Unterlegenen",
    ],
    tips: [
      "Dokumentieren Sie jeden Schritt des Vergabeverfahrens — Nachprüfungsverfahren erfordern vollständige Akten",
      "Achten Sie auf die korrekte Berechnung des Auftragswerts und die Wahl des richtigen Verfahrens",
      "Prüfen Sie die Vergabeunterlagen auf Konsistenz und Widerspruchsfreiheit",
      "Geben Sie ausreichend lange Angebotsfristen, um Wettbewerb zu ermöglichen",
    ],
    faq: [
      {
        question: "Was muss eine Ausschreibung enthalten?",
        answer: "Eine Ausschreibung muss die Vergabeunterlagen (Leistungsbeschreibung, Eignungskriterien, Zuschlagskriterien, Vertragsbedingungen), die Bekanntmachung, die Fristen und die Bieterinformation umfassen. Alle Elemente müssen vergaberechtlich korrekt sein.",
      },
      {
        question: "Wie lange müssen die Fristen sein?",
        answer: "Die Angebotsfrist hängt vom Vergabeverfahren, der Auftragsart, dem Auftraggeber und dem anwendbaren Regelwerk ab. Im offenen Verfahren nach VgV gelten gesetzliche Mindestfristen mit möglichen Verkürzungen; unterhalb der Schwellenwerte sind die einschlägigen nationalen Vorgaben und die Angemessenheit der Frist zu prüfen.",
      },
    ],
    relatedTemplates: ["leistungsbeschreibung-vorlage", "eignungskriterien-vorlage", "bvb-vorlage"],
  },
  {
    slug: "eignungskriterien-vorlage",
    title: "Eignungskriterien Vorlage",
    metaTitle: "Eignungskriterien Vorlage – Muster & Beispiele für Vergaben",
    metaDescription: "Kostenlose Eignungskriterien Vorlage für Auftraggeber. Strukturierte Muster für Fachkunde, Leistungsfähigkeit und Zuverlässigkeit.",
    category: "Eignungsnachweise",
    intro: [
      "Eignungskriterien sind die Maßstäbe, anhand derer der Auftraggeber feststellt, ob ein Bieter die notwendige fachliche, wirtschaftliche und rechtliche Eignung für die Durchführung des Auftrags besitzt. Sie müssen vorab in der Bekanntmachung definiert werden.",
      "Die wichtigsten Eignungskriterien sind: Befähigung und Fachkunde (Qualifikationen, Zertifikate), Leistungsfähigkeit (personelle und technische Ausstattung), Zuverlässigkeit (keine Vorstrafen, Steuern/Sozialabgaben), und wirtschaftliche Leistungskraft (Umsatz, Referenzen).",
      "Eignungskriterien müssen transparent, nachvollziehbar und angemessen sein. Sie müssen in einem klaren Bezug zur zu vergebenden Leistung stehen und dürfen nicht übermäßig oder diskriminierend sein.",
    ],
    whenToUse: [
      "Für Auftraggeber bei der Definition der Eignungsanforderungen",
      "Zur Strukturierung der Eignungsprüfung",
      "Als Grundlage für die Eigenerklärung (EEE)",
    ],
    contents: [
      "Kriterien für Befähigung und Fachkunde (Ausbildung, Zertifikate)",
      "Kriterien für berufliche Leistungsfähigkeit (Personal, Ausstattung)",
      "Kriterien für wirtschaftliche Leistungskraft (Umsatz, Bonität)",
      "Kriterien für Zuverlässigkeit (Ausschlussgründe nach § 123 GWB)",
      "Geforderte Referenzen (Art, Umfang, Anzahl)",
      "Mindestanforderungen vs. Bewertungsskala",
    ],
    tips: [
      "Definieren Sie Mindestanforderungen klar von Bewertungskriterien",
      "Stellen Sie sicher, dass die Kriterien im Zusammenhang mit der Leistung stehen",
      "Vermeiden Sie übermäßige Anforderungen, die kleine und mittlere Unternehmen ausschließen",
      "Geben Sie an, welche Nachweise bei Zuschlag vorgelegt werden müssen",
    ],
    faq: [
      {
        question: "Wie definiere ich Eignungskriterien?",
        answer: "Eignungskriterien sollten fachlich begründet und leistungsbezogen sein. Definieren Sie Mindestanforderungen klar von Bewertungskriterien und stellen Sie sicher, dass die Kriterien transparent, nachvollziehbar und nicht diskriminierend sind.",
      },
      {
        question: "Welche Referenzen kann ich verlangen?",
        answer: "Die geforderten Referenzen müssen vergleichbar mit der zu vergebenden Leistung sein (Art, Umfang, Komplexität). Übermäßige Anforderungen können als Wettbewerbsbarriere angesehen werden. In der Regel werden 3 vergleichbare Referenzen der letzten 3-5 Jahre verlangt.",
      },
    ],
    relatedTemplates: ["eigenerklaerung-vorlage", "referenznachweis-vorlage", "ausschreibung-muster"],
  },
  {
    slug: "referenznachweis-vorlage",
    title: "Referenznachweis Vorlage",
    metaTitle: "Referenznachweis Vorlage & Muster – Referenzschreiben Download",
    metaDescription: "Kostenlose Referenznachweis Vorlage für Vergabeverfahren. Strukturiertes Muster für Referenzschreiben mit allen Pflichtangaben.",
    category: "Eignungsnachweise",
    intro: [
      "Ein Referenznachweis ist ein Dokument, das belegt, dass ein Bieter eine ähnliche Leistung bereits in der Vergangenheit erfolgreich erbracht hat. Referenzen sind ein zentrales Eignungskriterium bei öffentlichen Vergaben.",
      "Ein guter Referenznachweis enthält: Angabe des Auftraggebers (mit Kontaktdaten), Beschreibung der Leistung (Art, Umfang, Komplexität), Angaben zur Laufzeit und Abnahme, sowie die Bestätigung der ordnungsgemäßen Ausführung.",
      "Referenzen müssen vergleichbar mit der zu vergebenden Leistung sein. Bieter sollten ihre Referenzen sorgfältig auswählen und sicherstellen, dass sie die geforderten Kriterien erfüllen.",
    ],
    whenToUse: [
      "Bei Vergabeverfahren, die Referenzen als Eignungskriterium fordern",
      "Als Nachweis über ähnliche, erfolgreich abgeschlossene Leistungen",
      "Bei der Zuschlagserteilung (Nachweisvorlage nach Eigenerklärung)",
    ],
    contents: [
      "Angabe des Referenzprojekts (Name, Beschreibung)",
      "Auftraggeber mit Ansprechpartner und Kontaktdaten",
      "Leistungsbeschreibung (Art, Umfang, Komplexität)",
      "Auftragswert (optional, aber empfohlen)",
      "Laufzeit (Beginn, Ende) und Abnahmedatum",
      "Bestätigung der ordnungsgemäßen Ausführung",
    ],
    tips: [
      "Wählen Sie Referenzen aus, die mit der zu vergebenden Leistung vergleichbar sind",
      "Bitten Sie Ihre Kunden frühzeitig um Referenzschreiben — nicht erst bei der Ausschreibung",
      "Stellen Sie sicher, dass der Referenzgeber erreichbar ist für Rückfragen",
      "Dokumentieren Sie alle Referenzen in einer zentralen Datenbank für künftige Ausschreibungen",
    ],
    faq: [
      {
        question: "Was ist ein Referenznachweis?",
        answer: "Ein Referenznachweis belegt, dass ein Bieter eine ähnliche Leistung bereits erfolgreich erbracht hat. Er enthält Angaben zum Projekt, zum Auftraggeber, zur Leistung und zur Abnahme.",
      },
      {
        question: "Wie viele Referenzen brauche ich?",
        answer: "Die Anzahl der geforderten Referenzen steht in den Vergabeunterlagen. In der Regel werden 3 vergleichbare Referenzen der letzten 3-5 Jahre verlangt. Mehr Referenzen können helfen, aber sind nicht immer besser.",
      },
    ],
    relatedTemplates: ["eigenerklaerung-vorlage", "eignungskriterien-vorlage"],
  },
  {
    slug: "ruege-muster",
    title: "Rüge Muster / Nachprüfungsantrag",
    metaTitle: "Rüge Muster & Vorlage – Vergaberechtsrüge professionell formulieren",
    metaDescription: "Kostenlose Rüge Vorlage für Vergabeverfahren. Professionelle Musterformulierung für Vergaberechtsrüge und Nachprüfungsantrag.",
    category: "Korrespondenz",
    intro: [
      "Eine Rüge ist die formelle Beanstandung eines vermuteten Vergaberechtsverstoßes durch einen Bieter gegenüber dem Auftraggeber. Sie ist Voraussetzung für ein späteres Nachprüfungsverfahren vor der Vergabekammer.",
      "Eine gut formulierte Rüge muss konkret benennen, welcher Verstoß gegen welche Vorschrift vorliegen soll, und eine Frist zur Stellungnahme setzen. Eine pauschale Rüge reicht nicht aus.",
      "Rügen können sich auf verschiedene Aspekte beziehen: unklare Leistungsbeschreibung, unangemessene Fristen, intransparente Zuschlagskriterien, Diskriminierung von Bietern, falsche Eignungsprüfung oder unzulässige Verhandlung von Angeboten.",
    ],
    whenToUse: [
      "Bei vermuteten Vergaberechtsverstößen als Vorstufe zum Nachprüfungsverfahren",
      "Zur formellen Beanstandung von Fehlern im Vergabeverfahren",
      "Zur Wahrung der Fristen für ein späteres Nachprüfungsverfahren",
    ],
    contents: [
      "Absender mit Kontaktdaten und Bevollmächtigung",
      "Empfänger (Vergabestelle) mit Aktenzeichen",
      "Betreff: 'Rüge zum Vergabeverfahren [Aktenzeichen]'",
      "Konkrete Benennung des Vergaberechtsverstoßes (Stelle, Vorschrift)",
      "Rechtliche Begründung mit Angabe der verletzten Vorschrift",
      "Beantragte Maßnahmen (Aufklärung, Fristverlängerung, Verfahrenskorrektur)",
      "Fristsetzung zur Stellungnahme",
    ],
    tips: [
      "Formulieren Sie die Rüge klar und konkret — vermeiden Sie Pauschalitäten",
      "Benennen Sie die genaue Stelle in den Vergabeunterlagen und die verletzte Vorschrift",
      "Setzen Sie eine angemessene Frist (in der Regel 7-14 Tage)",
      "Behalten Sie alle Unterlagen für ein mögliches Nachprüfungsverfahren",
      "Ziehen Sie bei komplexen Rügen einen vergaberechtlichen Anwalt hinzu",
    ],
    faq: [
      {
        question: "Wie formuliere ich eine Rüge?",
        answer: "Eine Rüge muss konkret und klar formuliert sein. Benennen Sie den vermuteten Verstoß, die betroffene Stelle in den Vergabeunterlagen, die verletzte Vorschrift und beantragen Sie konkrete Maßnahmen. Setzen Sie eine Frist zur Stellungnahme.",
      },
      {
        question: "Was passiert nach der Rüge?",
        answer: "Der Auftraggeber kann den Verstoß korrigieren oder die Rüge zurückweisen. Bleibt die Rüge erfolglos, kann ein Nachprüfungsantrag bei der zuständigen Vergabekammer in Betracht kommen. Die Zulässigkeit hängt insbesondere von Antragsbefugnis, Rügeobliegenheit und den Fristen des § 160 Abs. 3 GWB ab.",
      },
    ],
    relatedTemplates: ["bieterfrage-muster"],
  },
  {
    slug: "gaeb-vorlage",
    title: "GAEB Datei Vorlage",
    metaTitle: "GAEB Datei Vorlage & Konverter – LV im GAEB-Format",
    metaDescription: "Informationen und Tools für GAEB-Dateien. Leistungsverzeichnis im GAEB-Format erstellen, konvertieren und austauschen.",
    category: "Baubetrieb",
    intro: [
      "GAEB (Gemeinsamer Ausschuss Elektronik im Bauwesen) ist ein Standard für den elektronischen Austausch von Leistungsverzeichnissen, Ausschreibungen und Abrechnungen im deutschen Bauwesen. GAEB-Dateien sind XML-basiert und ermöglichen eine reibungslose Datenübertragung.",
      "GAEB wird in der Regel bei öffentlichen Bauvergaben eingesetzt, ist aber auch bei privaten Ausschreibungen verbreitet. Die Nutzung von GAEB-Software ist für Bauunternehmen, Architekten und Ingenieure Standard.",
      "GAEB-Dateien gibt es in verschiedenen Phasen: D88 (Angebotssphase), D89 (Auftragsphase), D90 (Abrechnungsphase) und X31 (neuerer Standard). Die GAEB-Software unterstützt den Import, Export und die Konvertierung zwischen den Formaten.",
    ],
    whenToUse: [
      "Bei öffentlichen Bauvergaben, die GAEB-Dateien fordern",
      "Zum elektronischen Austausch von Leistungsverzeichnissen",
      "Für die LV-Kalkulation und Abrechnung im Bauwesen",
    ],
    contents: [
      "GAEB-Datei im Format D88, D89, D90 oder X31",
      "Leistungsverzeichnis mit Positionen, Mengen, Einheiten",
      "Preise und kalkulatorische Angaben",
      "Bauzeiten und Bauablauf (optional)",
      "Bohrungen und Abrechnungsdaten (Abrechnungsphase)",
    ],
    tips: [
      "Verwenden Sie GAEB-fähige Software (z.B. sensible, RIB, italcementi)",
      "Prüfen Sie die Kompatibilität Ihrer Software mit dem geforderten GAEB-Standard",
      "Sichern Sie GAEB-Dateien vor dem Versand und behalten Sie Kopien",
      "Bei Konvertierungsproblemen: Kontaktieren Sie den Auftraggeber oder den GAEB-Helpdesk",
    ],
    faq: [
      {
        question: "Was ist eine GAEB-Datei?",
        answer: "Eine GAEB-Datei ist ein elektronisches Dokument im Standard des Gemeinsamen Ausschusses Elektronik im Bauwesen (GAEB). Sie dient dem Austausch von Leistungsverzeichnissen, Ausschreibungen und Abrechnungen im Bauwesen.",
      },
      {
        question: "Welche Software kann GAEB-Dateien verarbeiten?",
        answer: "GAEB-Dateien werden von spezialisierten Branchenlösungen für das Bauwesen unterstützt, darunter sensible, RIB, italcementi und andere. Die Software kann GAEB-Dateien importieren, bearbeiten und exportieren.",
      },
      {
        question: "Kann ich GAEB ohne Software nutzen?",
        answer: "Die Nutzung von GAEB ohne spezielle Software ist möglich, aber aufwendig. Es gibt Online-Konverter und Cloud-Lösungen, die GAEB-Dateien in Excel oder PDF umwandeln. Für professionelle Anwender ist GAEB-Software aber empfehlenswert.",
      },
    ],
    relatedTemplates: ["leistungsverzeichnis-vorlage", "leistungsbeschreibung-vorlage"],
    relatedCategories: ["Bauarbeiten", "Tiefbau"],
  },
  {
    slug: "pruefliste-angebotsabgabe",
    title: "Prüfliste Angebotsabgabe",
    metaTitle: "Prüfliste Angebotsabgabe – Checkliste für Bieter Download",
    metaDescription: "Kostenlose Prüfliste für die Angebotsabgabe bei öffentlichen Ausschreibungen. Alle Schritte und Dokumente systematisch geprüft.",
    category: "Angebotsunterlagen",
    intro: [
      "Die Angebotsabgabe ist ein kritischer Moment im Vergabeverfahren. Ein vergessenes Dokument oder ein fehlerhaftes Detail kann zum Ausschluss des gesamten Angebots führen. Eine systematische Prüfliste hilft, alle Elemente zu kontrollieren.",
      "Die Prüfliste sollte alle Aspekte der Angebotsabgabe umfassen: Formalia (Deckblatt, Unterschrift), Fachliche Inhalte (Leistungsverzeichnis, Konzept), Eignungsnachweise (EEE, Referenzen, Zertifikate), und Technische Aspekte (elektronische Signatur, Format).",
      "Die Prüfliste sollte vor jeder Angebotsabgabe systematisch durchgearbeitet werden. Am besten von zwei Personen — einer, der das Angebot erstellt hat, und einer, der es unabhängig prüft (Vier-Augen-Prinzip).",
    ],
    whenToUse: [
      "Vor jeder Angebotsabgabe zur systematischen Kontrolle",
      "Als Checkliste für das gesamte Angebotsteam",
      "Zur Vermeidung von Ausschlussgründen",
    ],
    contents: [
      "Formalia: Deckblatt, Unterschrift, Datum korrekt",
      "Frist: Einreichung vor Ablauf der Deadline",
      "Eignung: Eigenerklärung (EEE) vollständig",
      "Leistungsverzeichnis: Alle Positionen ausgefüllt, Preise geprüft",
      "Konzept/Technische Lösung: Vollständig und verständlich",
      "Zertifikate/Referenzen: Aktuell und vollständig",
      "Elektronische Signatur: Qualifiziert (QES) wenn gefordert",
      "Format: Korrektes Dateiformat (PDF, GAEB, etc.)",
    ],
    tips: [
      "Beginnen Sie die Prüfung mindestens 24 Stunden vor Abgabefrist — nicht in letzter Minute",
      "Prüfen Sie nach dem Vier-Augen-Prinzip: Eine andere Person schaut das Angebot durch",
      "Behalten Sie eine Kopie des gesamten Angebots mit Einreichungszeitpunkt",
      "Prüfen Sie die elektronische Signatur technisch (nicht nur optisch)",
    ],
    faq: [
      {
        question: "Was passiert, wenn ein Dokument fehlt?",
        answer: "Ein fehlendes Dokument kann zum Ausschluss des Angebots führen. Bei wesentlichen Unterlagen (z.B. Eigenerklärung, Leistungsverzeichnis) ist der Ausschluss sicher. Bei formalen Mängeln kann der Auftraggeber Nachklärung verlangen.",
      },
      {
        question: "Kann ich ein Angebot nach der Deadline noch ergänzen?",
        answer: "Nein, nach Ablauf der Einreichungsfrist können keine Dokumente mehr nachgereicht werden. Angebote, die zu spät eingehen, müssen ausgeschlossen werden. Planen Sie daher ausreichend Pufferzeit ein.",
      },
    ],
    relatedTemplates: ["angebot-vorlage-ausschreibung", "deckblatt-vgv-vorlage", "eigenerklaerung-vorlage"],
    relatedCategories: ["Bauarbeiten", "IT-Dienstleistungen", "Gebaeudereinigung"],
  },
  {
    slug: "preisspiegel-vorlage",
    title: "Preisspiegel Vorlage",
    metaTitle: "Preisspiegel Vorlage & Muster – Preisvergleich bei Vergaben",
    metaDescription: "Kostenlose Preisspiegel Vorlage für Auftraggeber. Systematischer Preisvergleich aller Angebote in öffentlichen Vergaben.",
    category: "Angebotsunterlagen",
    intro: [
      "Ein Preisspiegel ist eine systematische Übersicht über die Preise aller eingegangenen Angebote bei einer Ausschreibung. Er ermöglicht dem Auftraggeber den direkten Vergleich der Bieter und ist Grundlage für die Vergabeentscheidung.",
      "Der Preisspiegel vergleicht in der Regel die Einzelpreise jeder Position, die Gewerke-Summen und den Gesamtangebotspreis. Auffälligkeiten (sehr hohe oder sehr niedrige Preise) werden markiert und können Anlass für Nachfragen sein.",
      "Preisspiegel sind Teil der Vergabedokumentation und müssen für ein mögliches Nachprüfungsverfahren aufbewahrt werden. Sie sollten transparent und nachvollziehbar erstellt werden.",
    ],
    whenToUse: [
      "Für Auftraggeber nach Eingang aller Angebote",
      "Als Grundlage für die Vergabeentscheidung",
      "Zur Identifikation von Anomalien (sehr hohe/niedrige Preise)",
    ],
    contents: [
      "Position mit Positionsnummer und Beschreibung",
      "Menge und Einheit",
      "Einzelpreise aller Bieter pro Position",
      "Gewerke-Summen und Gesamtangebotspreis",
      "Markierung von Anomalien (zu hoch/zu niedrig)",
      "Ranking der Bieter nach Gesamtpreis",
    ],
    tips: [
      "Prüfen Sie sehr niedrige Preise (>30% unter Durchschnitt) auf Plausibilität — möglicherweise fehlerhaft",
      "Identifizieren Sie Positionen, bei denen ein Bieter deutlich abweicht — mögliche Nachfrage",
      "Dokumentieren Sie die Preisspiegel-Bewertung für die Vergabeakte",
      "Berücksichtigen Sie qualitative Kriterien (Zuschlagskriterien) neben dem Preis",
    ],
    faq: [
      {
        question: "Was ist ein Preisspiegel?",
        answer: "Ein Preisspiegel ist eine systematische Übersicht über die Preise aller eingegangenen Angebote. Er ermöglicht den direkten Vergleich der Bieter und ist Grundlage für die Vergabeentscheidung.",
      },
      {
        question: "Muss der Preisspiegel den Bietern mitgeteilt werden?",
        answer: "Der Preisspiegel wird in der Regel nur intern verwendet. Bei der Information der unterlegenen Bieter nach der Zuschlagserteilung wird der Name des erfolgreichen Bieters und der Zuschlagspreis mitgeteilt, nicht aber der vollständige Preisspiegel.",
      },
    ],
    relatedTemplates: ["leistungsverzeichnis-vorlage", "pruefliste-angebotsabgabe"],
  },
  {
    slug: "submissionsprotokoll-vorlage",
    title: "Submissionsprotokoll Vorlage",
    metaTitle: "Submissionsprotokoll Vorlage – Angebotseröffnung dokumentieren",
    metaDescription: "Kostenlose Submissionsprotokoll Vorlage für Auftraggeber. Professionelle Dokumentation der Angebotseröffnung.",
    category: "Angebotsunterlagen",
    intro: [
      "Das Submissionsprotokoll dokumentiert die förmliche Eröffnung der Angebote bei einer öffentlichen Vergabe. Es enthält die wesentlichen Daten aller eingegangenen Angebote und ist ein zentrales Dokument der Vergabedokumentation.",
      "Bei der öffentlichen Eröffnung (im offenen Verfahren) werden die wesentlichen Bedingungen der Angebote bekannt gegeben, einschließlich Bietername, Gesamtpreis und wesentliche Nebenangebote. Das Protokoll wird in der Regel von den anwesenden Bietern gegengezeichnet.",
      "Das Submissionsprotokoll ist Grundlage für die weitere Wertung der Angebote und muss für ein mögliches Nachprüfungsverfahren aufbewahrt werden.",
    ],
    whenToUse: [
      "Bei der förmlichen Angebotseröffnung durch den Auftraggeber",
      "Zur Dokumentation der eingegangenen Angebote",
      "Als Grundlage für die weitere Wertung",
    ],
    contents: [
      "Datum und Ort der Eröffnung",
      "Aktenzeichen und Vergabeverfahren",
      "Liste der eingegangenen Angebote (Bietername)",
      "Gesamtpreise der Angebote",
      "Wesentliche Nebenangebote oder Abweichungen",
      "Anwesende Personen (Bieter, Vertreter des Auftraggebers)",
      "Unterschriften (Protokollführer, anwesende Bieter)",
    ],
    tips: [
      "Stellen Sie sicher, dass alle eingegangenen Angebote erfasst werden — kein Angebot vergessen",
      "Dokumentieren Sie Auffälligkeiten (verspätete Angebote, formale Mängel)",
      "Das Protokoll muss zeitnah nach der Eröffnung erstellt werden",
      "Verteilen Sie das Protokoll an die anwesenden Bieter",
    ],
    faq: [
      {
        question: "Was ist ein Submissionsprotokoll?",
        answer: "Ein Submissionsprotokoll dokumentiert die förmliche Eröffnung der Angebote bei einer öffentlichen Vergabe. Es enthält die wesentlichen Daten aller Angebote und ist ein zentrales Dokument der Vergabedokumentation.",
      },
      {
        question: "Wer bekommt das Submissionsprotokoll?",
        answer: "Das Submissionsprotokoll wird in der Regel den anwesenden Bietern bei der öffentlichen Eröffnung (offenes Verfahren) zur Verfügung gestellt. Im beschränkten Verfahren wird es nur den ausgewählten Bietern zugestellt.",
      },
    ],
    relatedTemplates: ["preisspiegel-vorlage", "pruefliste-angebotsabgabe"],
  },
  {
    slug: "auftragsbestaetigung-vorlage",
    title: "Auftragsbestätigung Vorlage",
    metaTitle: "Auftragsbestätigung Vorlage – Muster nach Zuschlag",
    metaDescription: "Kostenlose Auftragsbestätigung Vorlage für Auftragnehmer. Professionelle Vorlage zur Bestätigung des Auftragserhalts nach Zuschlag.",
    category: "Vertragsbedingungen",
    intro: [
      "Die Auftragsbestätigung ist die formelle Bestätigung des Auftragnehmers, dass er den Auftrag nach der Zuschlagserteilung erhalten hat und bereit ist, die Leistung zu erbringen. Sie ist in der Regel nicht gesetzlich vorgeschrieben, aber branchenüblich.",
      "Die Auftragsbestätigung enthält die wesentlichen Vertragsdaten: Auftraggeber, Auftragsgegenstand, Auftragswert, Fristen und besondere Bedingungen. Sie schafft Klarheit über den Vertragsinhalt und dokumentiert den Vertragsabschluss.",
      "Bei komplexeren Aufträgen kann die Auftragsbestätigung mit einer Auftragsbestätigung des Auftraggebers kombiniert werden, die alle Vertragsbedingungen noch einmal zusammenfasst.",
    ],
    whenToUse: [
      "Nach der Zuschlagserteilung als formelle Bestätigung",
      "Zur Klärung offener Punkte vor Leistungsbeginn",
      "Als Grundlage für die weitere Vertragsabwicklung",
    ],
    contents: [
      "Absender (Auftragnehmer) und Empfänger (Auftraggeber)",
      "Betreff: 'Auftragsbestätigung zum Vergabeverfahren [Aktenzeichen]'",
      "Dank für die Zuschlagserteilung",
      "Zusammenfassung der wesentlichen Vertragsdaten",
      "Bestätigung der Leistungsbereitschaft",
      "Hinweis auf weitere Schritte (Kickoff, Baubeginn)",
    ],
    tips: [
      "Bestätigen Sie den Auftrag zeitnah nach Zuschlagserteilung — in der Regel innerhalb weniger Tage",
      "Prüfen Sie noch einmal, ob alle Vertragsbedingungen verständlich sind",
      "Klären Sie offene Fragen vor der Bestätigung",
      "Behalten Sie eine Kopie der Auftragsbestätigung in Ihren Unterlagen",
    ],
    faq: [
      {
        question: "Muss eine Auftragsbestätigung erstellt werden?",
        answer: "Eine formelle Auftragsbestätigung ist nicht gesetzlich vorgeschrieben, aber branchenüblich und empfehlenswert. Sie schafft Klarheit über den Vertragsabschluss und die wesentlichen Bedingungen.",
      },
      {
        question: "Was passiert, wenn der Auftragnehmer den Auftrag ablehnt?",
        answer: "Lehnt der Auftragnehmer den Auftrag nach der Zuschlagserteilung ab, kann der Auftraggeber den nächstplatzierten Bieter den Zuschlag erteilen oder das Verfahren aufheben. Der ablehnende Bieter kann schadensersatzpflichtig werden.",
      },
    ],
    relatedTemplates: ["bvb-vorlage", "angebot-vorlage-ausschreibung"],
  },
];

// Helper maps
export const TEMPLATE_MAP: Record<string, TemplateEntry> = TEMPLATES.reduce(
  (acc, entry) => {
    acc[entry.slug] = entry;
    return acc;
  },
  {} as Record<string, TemplateEntry>,
);

export const ALL_TEMPLATE_SLUGS = TEMPLATES.map((e) => e.slug);

export const TEMPLATE_CATEGORIES = [
  "Angebotsunterlagen",
  "Eignungsnachweise",
  "Vertragsbedingungen",
  "Leistungsbeschreibung",
  "Korrespondenz",
  "Baubetrieb",
] as const;

export function getTemplatesByCategory(): Record<string, TemplateEntry[]> {
  const result: Record<string, TemplateEntry[]> = {};
  for (const cat of TEMPLATE_CATEGORIES) {
    result[cat] = TEMPLATES.filter((e) => e.category === cat);
  }
  return result;
}
