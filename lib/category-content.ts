export interface CategoryContent {
  intro: string;
  tips: string[];
  requirements: string[];
  // SEO: Real question-answer pairs for FAQPage JSON-LD — must follow Google's FAQ schema guidelines
  faq: Array<{ question: string; answer: string }>;
}

export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  Bauarbeiten: {
    intro:
      "Bauarbeiten umfassen Rohbau, Innenausbau, Instandsetzung und Abbrucharbeiten an öffentlichen Gebäuden und Infrastruktur. Aufträge der öffentlichen Hand reichen von der Sanierung einer Schule über den Neubau einer Feuerwache bis zur Instandsetzung von Brücken. Vergaben erfolgen meist als offenes oder beschränktes Verfahren nach VOB/A.",
    tips: [
      "Prüfen Sie die Eignungskriterien frühzeitig – Nachweise wie Präqualifikation (PQ-VOLK), Berufshaftpflicht und Referenzprojekte werden zwingend gefordert.",
      "Achten Sie auf die Zuschlagsfrist und die Ausführungsfrist – öffentliche Auftraggeber haben feste Bauzeiten, die im Terminplan eingehalten werden müssen.",
      "Bei VOB-Vergaben müssen Nebenangebote genau spezifiziert werden – Abweichungen ohne entsprechende Klausel führen zum Ausschluss.",
    ],
    requirements: [
      "Eintragung im Berufsregister (Handwerkskarte oder Gewerbeanmeldung)",
      "Berufshaftpflichtversicherung mit ausreichender Deckungssumme",
      "Referenzen vergleichbarer Größenordnung aus den letzten 3–5 Jahren",
      "PQ-VOLK-Zertifikat (Vergabeordnung für Leistungen) bei vielen Vergabestellen",
    ],
    faq: [
      {
        question: "Wo finde ich Bauarbeiten-Ausschreibungen?",
        answer: "Bauarbeiten-Ausschreibungen finden Sie auf den Portalen DTVP, TED, evergabe sowie Bauportal Deutschland. Tenderhunter aggregiert alle Quellen automatisch und zeigt Ihnen passende Ergebnisse für Ihr Unternehmen.",
      },
      {
        question: "Welche Anforderungen gelten bei Bauarbeiten-Vergaben?",
        answer: "Typische Anforderungen sind Eintragung im Berufsregister, Berufshaftpflichtversicherung, Referenzen vergleichbarer Projekte aus den letzten 3–5 Jahren sowie häufig ein PQ-VOLK-Zertifikat.",
      },
      {
        question: "Welche Auftraggeber schreiben Bauarbeiten am häufigsten aus?",
        answer: "Die aktivsten Auftraggeber für Bauarbeiten sind Kommunen, Landesbetriebe, Bund und öffentliche Unternehmen wie Stadtwerke. Auch Universitäten und Kliniken vergeben regelmäßig Bauaufträge.",
      },
    ],
  },
  Tiefbau: {
    intro:
      "Tiefbau- und Infrastrukturleistungen umfassen Kanalbau, Straßenbau, Erdarbeiten, Versorgungsleitungen und Wasserbau. Diese Vergaben stammen häufig von Kommunen, Wasser- und Abwasserzweckverbänden sowie Landesbetrieben. Die Auftragsvolumina sind oft erheblich, und die technischen Anforderungen an Material und Ausführung sind hoch.",
    tips: [
      "Tiefbau-Vergaben erfordern oft spezielle Nachweise wie DIN 18234 (Kanalbau) oder TL Asphalt – prüfen Sie die technischen Lieferbedingungen genau.",
      "Bodenklassen und Grundwasserstände werden häufig erst während der Bauzeit endgültig festgestellt – bedenken Sie Mehrvergütungsansprüche bei abweichenden Baugrundverhältnissen.",
      "Verkehrsmanagement und Baustellenabsicherung sind oft eigener Vergabeteil – koordinieren Sie sich mit anderen Gewerken.",
    ],
    requirements: [
      "Präqualifikation nach VOB/A (PQ-VOB)",
      "Fachbetriebnachweis für Kanalsanierung (z.B. nach DIN 4033 oder DWA-Richtlinien)",
      "Erfahrung mit vergleichbaren Tiefbauvorhaben (Wertangabe und Referenz)",
      "Sicherheits- und Gesundheitsschutzkoordinator (SiGeKo) Benennung",
    ],
    faq: [
      {
        question: "Wo finde ich Tiefbau-Ausschreibungen?",
        answer: "Tiefbau-Ausschreibungen werden auf DTVP, TED, evergabe und Bauportal Deutschland veröffentlicht. Tenderhunter durchsucht automatisch alle Portale und filtert relevante Infrastrukturprojekte für Sie.",
      },
      {
        question: "Welche Anforderungen gelten bei Tiefbau-Vergaben?",
        answer: "Typische Anforderungen sind Präqualifikation nach VOB/A, Fachbetriebnachweise für Kanalsanierung, Erfahrung mit vergleichbaren Tiefbauvorhaben sowie die Benennung eines SiGeKo.",
      },
      {
        question: "Welche Auftraggeber schreiben Tiefbau am häufigsten aus?",
        answer: "Die wichtigsten Auftraggeber im Tiefbau sind Kommunen, Wasser- und Abwasserzweckverbände, Landesbetriebe und Straßenbauämter. Auch Autobahnmeistereien vergeben regelmäßig Tiefbauaufträge.",
      },
    ],
  },
  TGA: {
    intro:
      "Die technische Gebäudeausrüstung (TGA) umfasst Heizung, Lüftung, Sanitär, Elektroinstallation und MSR-Technik. Öffentliche Vergaben betreffen Neubauten, Sanierungen und die laufende Wartung von Gebäuden. Besonders im Bereich der energetischen Sanierung steigen die Anforderungen an Effizienz und erneuerbare Energien.",
    tips: [
      "Energetische Anforderungen (GEG, BNGF) sind heute Standard – dokumentieren Sie Erfahrung mit Wärmepumpen, Solarthermie und Lüftungsanlagen mit Wärmerückgewinnung.",
      "MSR-Technik wird zunehmend als BACS (Building Automation) nach DIN EN ISO 16484 vergaben – kennen Sie Ihre Leistungstiefe.",
      "Wartungsverträge werden oft separat vergeben – bieten Sie sich auch als Servicepartner an, nicht nur für die Erstinbetriebnahme.",
    ],
    requirements: [
      "Eintragung in die Handwerksrolle im Anlage- oder Versorgerhandwerk (SHK oder Elektrotechnik)",
      "Nachweis über Ausbildung von Fachpersonal (Meisterbrief oder Techniker)",
      "Berufshaftpflichtversicherung mit Deckungssumme mind. 3 Mio. Euro",
      "Referenzprojekte mit vergleichbarer technischer Komplexität",
    ],
    faq: [
      {
        question: "Wo finde ich TGA-Ausschreibungen?",
        answer: "Technische Gebäudeausrüstung (TGA) wird auf DTVP, TED, evergabe und Bauportal Deutschland ausgeschrieben. Tenderhunter aggregiert alle TGA-Vergaben automatisch nach Heizung, Lüftung, Sanitär und Elektrotechnik.",
      },
      {
        question: "Welche Anforderungen gelten bei TGA-Vergaben?",
        answer: "Typische Anforderungen sind Eintragung in die Handwerksrolle (SHK oder Elektrotechnik), Meisterbrief oder Techniker-Nachweis, Berufshaftpflicht ab 3 Mio. Euro und Referenzprojekte vergleichbarer Komplexität.",
      },
      {
        question: "Welche Auftraggeber schreiben TGA am häufigsten aus?",
        answer: "Die aktivsten TGA-Auftraggeber sind Kommunen, Landesbetriebe, Kliniken und Universitäten. Besonders bei energetischen Sanierungen und Neubauten werden TGA-Leistungen regelmäßig ausgeschrieben.",
      },
    ],
  },
  Gebaeudereinigung: {
    intro:
      "Gebäudereinigung ist eine der am häufigsten ausgeschriebenen Dienstleistungen der öffentlichen Hand. Schulen, Verwaltungsgebäude, Kliniken und Pflegeheime benötigen regelmäßig Unterhaltsreinigung, Glasreinigung und Grundreinigung. Vergaben erfolgen meist als Rahmenvereinbarungen über 2–4 Jahre mit monatlichen oder jährlichen Abrechnungen.",
    tips: [
      "Personalintensität ist der größte Kostenfaktor – berechnen Sie Ihren Stundenlohn inkl. LNK (Lohnnebenkosten) sorgfältig, eine nachträgliche Anpassung ist bei öffentlichen Vergaben kaum möglich.",
      "Reinigungsleistung wird nach DIN 77400 oder subjektbezogenen Leistungsverzeichnissen beschrieben – studieren Sie die Leistungsbeschreibung im Detail.",
      "Nachhaltigkeit wird zunehmend bewertet – zertifizierte Reinigungsmittel und Umweltschutz (z.B. EU-Blume) können den Zuschlag beeinflussen.",
    ],
    requirements: [
      "Gewerbeanmeldung für Gebäudereinigung (überwachungspflichtiges Gewerbe bei FFT-Flächenreinigung)",
      "Berufshaftpflichtversicherung (mindestens 1 Mio. Euro deckung)",
      "Ausbildungsnachweis des Personals (Gebäudereiniger-Gehilfenbrief oder vergleichbar)",
      "Nachhaltigkeitszertifikat oder AMSIII-Zertifikat (Reinigungsmittelsicherheit)",
    ],
    faq: [
      {
        question: "Wo finde ich Gebäudereinigung-Ausschreibungen?",
        answer: "Gebäudereinigung-Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie regionalen Vergabeportalen. Tenderhunter zeigt Ihnen täglich aktualisiert alle passenden Reinigungsaufträge aus der öffentlichen Hand.",
      },
      {
        question: "Welche Anforderungen gelten bei Gebäudereinigung-Vergaben?",
        answer: "Typische Anforderungen sind Gewerbeanmeldung für Gebäudereinigung, Berufshaftpflicht ab 1 Mio. Euro, Ausbildungsnachweis des Personals sowie zunehmend Nachhaltigkeitszertifikate.",
      },
      {
        question: "Welche Auftraggeber schreiben Gebäudereinigung am häufigsten aus?",
        answer: "Die häufigsten Auftraggeber sind Schulen, Verwaltungsgebäude, Kliniken und Pflegeheime. Vergaben erfolgen meist als Rahmenvereinbarungen über 2–4 Jahre.",
      },
    ],
  },
  Winterdienst: {
    intro:
      "Winterdienst umfasst Räum- und Streuarbeiten auf öffentlichen Straßen, Wegen und Flächen. Vergaben werden meist von Kommunen, Straßenbauämtern oder Autobahnmeistereien vergeben, oft als Saisonverträge von November bis April. Die Vergabe kann regional oder nach Streckenabschnitten erfolgen.",
    tips: [
      "Reaktionszeiten sind kritisch – Räumpflicht beginnt oft ab 5:00 Uhr oder früher, an Bundesstraßen sogar rund um die Uhr.",
      "Streckenführung und Gerätelage sind entscheidend – prüfen Sie die Zugänglichkeit, besonders bei engen Ortsdurchfahrten oder Brücken.",
      "Umweltverträgliche Streugüter (Feuchtsalz, Splitt) werden zunehmend vorgeschrieben – Tau- und Streusalz allein ist oft nicht mehr zulässig.",
    ],
    requirements: [
      "Fahrzeuge mit Räum- und Streutechnik (Schild und Streugerät)",
      "Lagerkapazität für Streugut (Taumittellager oder Splittlager)",
      "Erreichbarkeit/Leitstand 24/7 während der Wintersaison",
      "Berufshaftpflicht und ggf. Umwelthaftpflicht (Gewässerschaden)",
    ],
    faq: [
      {
        question: "Wo finde ich Winterdienst-Ausschreibungen?",
        answer: "Winterdienst-Ausschreibungen werden von Kommunen, Straßenbauämtern und Autobahnmeistereien auf DTVP und regionalen Portalen veröffentlicht. Tenderhunter aggregiert alle Saisonverträge automatisch.",
      },
      {
        question: "Welche Anforderungen gelten bei Winterdienst-Vergaben?",
        answer: "Typische Anforderungen sind Räum- und Streutechnik, Lagerkapazität für Streugut, 24/7-Erreichbarkeit während der Wintersaison sowie Berufshaftpflicht und Umwelthaftpflicht.",
      },
      {
        question: "Wann werden Winterdienst-Ausschreibungen veröffentlicht?",
        answer: "Winterdienst-Vergaben werden meist zwischen Juli und Oktober für die kommende Saison ausgeschrieben. Die Vertragslaufzeit beträgt in der Regel eine Saison von November bis April.",
      },
    ],
  },
  Immobilienverwaltung: {
    intro:
      "Immobilienverwaltung für die öffentliche Hand umfasst das Management von Liegenschaften, Vermietung, Instandhaltungssteuerung und Wohnungsbetreuung. Auftraggeber sind kommunale Wohnungsbauunternehmen, Landesbetriebe und Bundesimmobilien. Vergaben erfolgen oft als mehrjährige Dienstleistungsverträge.",
    tips: [
      "Kennzahlenbasiertes Reporting (Wirtschaftliche Verbrauchs- und Nebenkostenabrechnung) wird zunehmend gefordert – IT-Systeme wie SAP RE-FX sind ein Wettbewerbsvorteil.",
      "Mieterservice und Beschwerdemanagement sind sensible Bereiche – benennen Sie qualifiziertes Personal und Notfallkonzepte.",
      "Energie- und Verbrauchscontrolling wird separat vergaben – bieten Sie sich als Full-Service-Partner an.",
    ],
    requirements: [
      "IHK-Zulassung als Immobilienverwalter (oder Sparkassenfachbetrieb)",
      "Erfahrung mit comparable Objektgrößen (Anzahl WE / m²)",
      "EDV-Systeme für die Liegenschaftsverwaltung (SAP RE-FX, APUS oder ähnlich)",
      "Berufshaftpflicht (Vermögensschadenhaftpflicht mindestens 1 Mio. Euro)",
    ],
    faq: [
      {
        question: "Wo finde ich Immobilienverwaltung-Ausschreibungen?",
        answer: "Immobilienverwaltung-Ausschreibungen finden Sie auf DTVP, TED und evergabe. Tenderhunter zeigt Ihnen alle aktuellen Vergaben von kommunalen Wohnungsbauunternehmen und Landesbetrieben.",
      },
      {
        question: "Welche Anforderungen gelten bei Immobilienverwaltung-Vergaben?",
        answer: "Typische Anforderungen sind IHK-Zulassung als Immobilienverwalter, Erfahrung mit vergleichbaren Objektgrößen, EDV-Systeme für Liegenschaftsverwaltung und Vermögensschadenhaftpflicht ab 1 Mio. Euro.",
      },
      {
        question: "Welche Auftraggeber schreiben Immobilienverwaltung am häufigsten aus?",
        answer: "Die wichtigsten Auftraggeber sind kommunale Wohnungsbauunternehmen, Landesbetriebe und Bundesimmobilien. Vergaben erfolgen oft als mehrjährige Dienstleistungsverträge.",
      },
    ],
  },
  "Facility Management": {
    intro:
      "Facility Management umfasst die ganzheitliche Bewirtschaftung von Gebäuden und Liegenschaften. Dazu gehören technisches Management (Wartung, Instandsetzung), infrastrukturelles Management (Reinigung, Sicherheit, Catering) und kaufmännisches Management (Flächenmanagement, Controlling). Öffentliche Vergaben richten sich an integrierte Dienstleister.",
    tips: [
      "Integrierte Konzepte (Hard + Soft FM) werden bevorzugt – zeigen Sie Ihre Fähigkeit, Subunternehmen zu koordinieren.",
      "SLA-basierte Vergaben mit KPIs sind Standard – definieren Sie Reaktions- und Lösungszeiten klar in Ihrem Angebot.",
      "Digitalisierung (CAFM, IoT) wird zunehmend bewertet – dokumentieren Sie Ihre Systeme und Dashboards.",
    ],
    requirements: [
      "Zertifizierung nach DIN EN ISO 41001 (Facility Management) oder vergleichbar",
      "Mehrjährige Referenzen im integrierten Facility Management",
      "CAFM-System und 24/7-Service-Hotline",
      "Berufshaftpflicht mit ausreichender Deckungssumme (mind. 5 Mio. Euro)",
    ],
    faq: [
      {
        question: "Wo finde ich Facility-Management-Ausschreibungen?",
        answer: "Facility-Management-Ausschreibungen werden auf DTVP, TED, evergabe und Bauportal Deutschland veröffentlicht. Tenderhunter aggregiert alle FM-Vergaben – von Hard FM bis Soft FM – automatisch für Sie.",
      },
      {
        question: "Welche Anforderungen gelten bei Facility-Management-Vergaben?",
        answer: "Typische Anforderungen sind DIN EN ISO 41001-Zertifizierung, mehrjährige Referenzen im integrierten FM, CAFM-System und 24/7-Service-Hotline sowie Berufshaftpflicht ab 5 Mio. Euro.",
      },
      {
        question: "Welche Auftraggeber schreiben Facility Management am häufigsten aus?",
        answer: "Die aktivsten FM-Auftraggeber sind Bund, Länder, Kommunen und öffentliche Unternehmen. Besonders Universitäten, Kliniken und Verwaltungsgebäude werden regelmäßig als FM-Leistungen ausgeschrieben.",
      },
    ],
  },
  Gruenflaechenpflege: {
    intro:
      "Grünflächenpflege umfasst die Pflege von Parks, öffentlichen Grünanlagen, Straßenbegleitgrün und Friedhöfen. Vergaben betreffen Rasenpflege, Gehölzschnitt, Pflanzarbeiten und Saisonpflege. Auftraggeber sind Kommunen, Stadtwerke und Landesbetriebe.",
    tips: [
      "Saisonale Schwankungen erfordern flexibles Personal – dokumentieren Sie Ihre Personalplanung und Kapazitätsreserven.",
      "Pflanzenkenntnisse und fachgerechte Pflege (z.B. Baumprüfung nach Baumkontrollrichtlinie) sind oft Eignungsvoraussetzung.",
      "Pestizidverzicht und ökologische Pflege werden zunehmend gefordert – UZ 21 (Blauer Engel) oder vergleichbare Zertifikate sind ein Plus.",
    ],
    requirements: [
      "Berufshaftpflicht (mindestens 2 Mio. Euro)",
      "Fachpersonal mit Garten- und Landschaftsbau-Ausbildung",
      "Geräte und Maschinen (Mähtraktoren, Häcksler, Freischneider)",
      "Referenzen in der Grünflaechenpflege für vergleichbare Flächen",
    ],
    faq: [
      {
        question: "Wo finde ich Grünflächenpflege-Ausschreibungen?",
        answer: "Grünflächenpflege-Ausschreibungen finden Sie auf DTVP, evergabe und regionalen Vergabeportalen. Tenderhunter zeigt Ihnen alle aktuellen Vergaben für Parks, Grünanlagen und Friedhöfe.",
      },
      {
        question: "Welche Anforderungen gelten bei Grünflächenpflege-Vergaben?",
        answer: "Typische Anforderungen sind Berufshaftpflicht ab 2 Mio. Euro, Fachpersonal mit Garten- und Landschaftsbau-Ausbildung, Geräte und Maschinen sowie Referenzen vergleichbarer Flächen.",
      },
      {
        question: "Welche Auftraggeber schreiben Grünflächenpflege am häufigsten aus?",
        answer: "Die wichtigsten Auftraggeber sind Kommunen, Stadtwerke und Landesbetriebe. Vergaben betreffen Rasenpflege, Gehölzschnitt, Pflanzarbeiten und Saisonpflege.",
      },
    ],
  },
  Gartenarbeiten: {
    intro:
      "Garten- und Landschaftsbau (GaLaBau) umfasst Neuanlagen von Grünflächen, Pflasterarbeiten, Pflanzungen, Wegebau und Wasserbau in Gärten und Freianlagen. Öffentliche Vergaben betreffen Neubau und Umgestaltung von Parks, Spielplätzen, Schulhöfen und Ortskernen.",
    tips: [
      "Vegetationstechnische Anforderungen (DIN 18918 für Bodenbefestigungen, DIN 18916 für Pflanzarbeiten) sind Standard – kennen Sie die relevanten Normen.",
      "Spielplatzsicherheit (DIN EN 1176/1177) ist bei Schulen und Kindergärten kritisch – benennen Sie zertifizierte Sicherheitsfachkräfte.",
      "Begrünung von Dach und Fassade wird zunehmend ausgeschrieben – spezialisieren Sie sich auf diese Nische.",
    ],
    requirements: [
      "Eintragung in die Handwerksrolle als Garten- und Landschaftsbauer",
      "Berufshaftpflicht (mindestens 2 Mio. Euro)",
      "Ausbildungsnachweis (Gärtnermeister oder GaLaBau-Meister)",
      "Referenzprojekte vergleichbarer Art und Größenordnung",
    ],
    faq: [
      {
        question: "Wo finde ich Garten- und Landschaftsbau-Ausschreibungen?",
        answer: "Garten- und Landschaftsbau-Ausschreibungen werden auf DTVP, evergabe und Bauportal Deutschland veröffentlicht. Tenderhunter zeigt Ihnen alle GaLaBau-Vergaben – von Pflasterarbeiten bis Dachbegrünung.",
      },
      {
        question: "Welche Anforderungen gelten bei GaLaBau-Vergaben?",
        answer: "Typische Anforderungen sind Eintragung in die Handwerksrolle als Garten- und Landschaftsbauer, Berufshaftpflicht ab 2 Mio. Euro, Gärtnermeister- oder GaLaBau-Meister-Nachweis und Referenzprojekte.",
      },
      {
        question: "Welche Auftraggeber schreiben Garten- und Landschaftsbau am häufigsten aus?",
        answer: "Die aktivsten Auftraggeber sind Kommunen, Schulen, Kindergärten und Stadtwerke. Vergaben betreffen Neuanlagen von Grünflächen, Pflasterarbeiten, Spielplätze und Ortskerngestaltung.",
      },
    ],
  },
  Planungsleistungen: {
    intro:
      "Planungsleistungen umfassen Architektur, Ingenieurbau, TGA-Planung, Landschaftsarchitektur und Projektsteuerung. Öffentliche Vergaben richten sich an freiberuflich tätige Planer und Planungsgemeinschaften. Vergaben erfolgen nach VgV oder UVgO, oft als Verhandlungsverfahren mit Teilnahmewettbewerb.",
    tips: [
      "Die Honorarzone und -satz berechnen sich nach HOAI (bzw. dem neuen Honorarrahmen) – prüfen Sie, ob die geforderte Leistungstiefe zur Honorarzone passt.",
      "Planungswerkzeuge wie BIM (Building Information Modeling) werden zunehmend Vergabevoraussetzung – dokumentieren Sie Ihre Softwarekompetenz (Revit, Allplan, Archicad).",
      "Projektsteuerung und Bauoberleitung werden oft als Paket vergeben – bieten Sie sich als Full-Service-Planer an.",
    ],
    requirements: [
      "Eintragung in ein Berufsregister (Architektenkammer oder Ingenieurkammer)",
      "Berufshaftpflicht-/Vermögensschadenhaftpflicht (mind. 1,5 Mio. Euro)",
      "Referenzprojekte der letzten 5 Jahre mit vergleichbarer Nutzung und Größe",
      "BIM-Kompetenz (z.B. Zertifizierung buildingSMART) bei vielen Vergaben",
    ],
    faq: [
      {
        question: "Wo finde ich Planungsleistungen-Ausschreibungen?",
        answer: "Planungsleistungen werden auf DTVP, TED und evergabe ausgeschrieben. Tenderhunter aggregiert alle Architektur-, Ingenieurbau- und TGA-Planungsvergaben automatisch für Ihr Unternehmen.",
      },
      {
        question: "Welche Anforderungen gelten bei Planungsleistungen-Vergaben?",
        answer: "Typische Anforderungen sind Eintragung in ein Berufsregister (Architekten- oder Ingenieurkammer), Berufshaftpflicht ab 1,5 Mio. Euro, Referenzprojekte der letzten 5 Jahre und zunehmend BIM-Kompetenz.",
      },
      {
        question: "Welche Auftraggeber schreiben Planungsleistungen am häufigsten aus?",
        answer: "Die wichtigsten Auftraggeber sind Bund, Länder, Kommunen und öffentliche Unternehmen. Vergaben erfolgen nach VgV oder UVgO, oft als Verhandlungsverfahren mit Teilnahmewettbewerb.",
      },
    ],
  },
  "IT-Dienstleistungen": {
    intro:
      "IT-Dienstleistungen in der öffentlichen Verwaltung umfassen Softwareentwicklung, IT-Betrieb, Cloud-Services, Cybersecurity und Digitalisierungsvorhaben. Vergaben richten sich nach UVgO oder VgV und erfordern oft hohe Sicherheitsstandards (BSI-Grundschutz, ISO 27001). Der Trend geht zu Rahmenvereinbarungen und agilen Vergaben.",
    tips: [
      "Datenschutz und Informationssicherheit sind kritisch – BSI-Grundschutz-Kompatibilität oder ISO 27001-Zertifizierung sind oft Mindestanforderung.",
      "Open-Source-Präferenz: Viele Bundes- und Landesbehörden bevorzugen Open-Source-Lösungen – dokumentieren Sie Ihre Kompetenz.",
      "Sovereign Cloud (Gaia-X, BSI C5) wird zunehmend gefordert – nicht jede Public-Cloud-Lösung ist zulässig.",
    ],
    requirements: [
      "ISO/IEC 27001-Zertifizierung (Information Security Management)",
      "Erfahrung mit öffentlichen Auftraggebern (Referenzprojekte)",
      "Sicherheitsüberprüfung des Personals (Ü3 oder Φ nach SÜG bei Bundesbehörden)",
      "SLA-basierte Service-Level-Agreements mit Verfügbarkeitsgarantien",
    ],
    faq: [
      {
        question: "Wo finde ich IT-Ausschreibungen der öffentlichen Hand?",
        answer: "IT-Ausschreibungen werden auf DTVP, TED und evergabe veröffentlicht. Tenderhunter zeigt Ihnen alle aktuellen IT-Vergaben – von Softwareentwicklung über Cloud-Services bis Cybersecurity.",
      },
      {
        question: "Welche Anforderungen gelten bei IT-Vergaben?",
        answer: "Typische Anforderungen sind ISO 27001-Zertifizierung, Erfahrung mit öffentlichen Auftraggebern, Sicherheitsüberprüfung des Personals bei Bundesbehörden und SLA-basierte Verfügbarkeitsgarantien.",
      },
      {
        question: "Welche Auftraggeber schreiben IT-Dienstleistungen am häufigsten aus?",
        answer: "Die aktivsten IT-Auftraggeber sind Bundes- und Landesbehörden, Kommunen und öffentliche Unternehmen. Der Trend geht zu Rahmenvereinbarungen und agilen Vergaben im Bereich Digitalisierung.",
      },
    ],
  },
  Lieferung: {
    intro:
      "Lieferung und Material umfassen die Beschaffung von Produkten, Verbrauchsgütern, Möbeln, medizinischem Material und Ausrüstung für die öffentliche Hand. Vergaben reichen von der Papierlieferung über Schulmöbel bis zu spezialisierten Technikprodukten. Häufig werden Rahmenvereinbarungen geschlossen.",
    tips: [
      "Rahmenvereinbarungen binden Sie über mehrere Jahre an Konditionen – kalkulieren Sie Preissteigerungen bei Material und Logistik ein.",
      "Liefertreue und Avise sind kritisch – nicht oder spät gelieferte Waren führen zu Vertragsstrafen.",
      "Nachhaltigkeit und soziale Kriterien (Bio, Fairtrade, recyclingfähig) werden zunehmend als Zuschlagskriterium gewichtet.",
    ],
    requirements: [
      "Gewerbeanmeldung für den Handel mit den betreffenden Warengruppen",
      "Logistik- und Lagerkapazität für die geforderte Lieferfrequenz",
      "Produkthaftpflicht (insbesondere bei medizinischen oder technischen Produkten)",
      "Zertifikate der Hersteller (Händlerbindung) bei Markenprodukten",
    ],
    faq: [
      {
        question: "Wo finde ich Lieferaufträge der öffentlichen Hand?",
        answer: "Lieferaufträge werden auf DTVP, TED und evergabe ausgeschrieben. Tenderhunter aggregiert alle Material- und Produktvergaben – von Büromöbeln über medizinisches Material bis IT-Hardware.",
      },
      {
        question: "Welche Anforderungen gelten bei Liefervergaben?",
        answer: "Typische Anforderungen sind Gewerbeanmeldung für die betreffenden Warengruppen, Logistik- und Lagerkapazität, Produkthaftpflicht und Herstellerzertifikate bei Markenprodukten.",
      },
      {
        question: "Welche Auftraggeber schreiben Lieferungen am häufigsten aus?",
        answer: "Die wichtigsten Auftraggeber sind Bund, Länder, Kommunen, Kliniken und Universitäten. Häufig werden Rahmenvereinbarungen über mehrere Jahre geschlossen.",
      },
    ],
  },
  Sonstiges: {
    intro:
      "Diverse Leistungen umfassen Ausschreibungen, die nicht eindeutig einer anderen Kategorie zuzuordnen sind – von Entsorgung über Beratung bis zu spezialisierten Dienstleistungen. Die Vergabeanforderungen variieren stark je nach Auftragsart und Auftraggeber.",
    tips: [
      "Prüfen Sie die Leistungsbeschreibung genau – 'sonstige' Ausschreibungen haben oft besondere technische Anforderungen, die nicht standardisiert sind.",
      "Klären Sie vorab, ob eine Fachkundenachweis oder besondere Genehmigung erforderlich ist.",
      "Bei Dienstleistungen mit Personenbezug (z.B. Betreuung, Beratung) sind Qualitätsnachweise und Referenzen entscheidend.",
    ],
    requirements: [
      "Spezifische Nachweise je nach Auftragsart (z.B. Entsorgungsfachbetrieb, Beratungs-Zertifizierung)",
      "Gewerbeanmeldung oder Zulassung im entsprechenden Bereich",
      "Berufshaftpflicht (Höhe je nach Risiko)",
      "Referenzen aus vergleichbaren Aufträgen",
    ],
    faq: [
      {
        question: "Wo finde ich diverse Ausschreibungen?",
        answer: "Diverse Ausschreibungen, die nicht eindeutig einer Kategorie zuzuordnen sind, finden Sie auf DTVP, TED und evergabe. Tenderhunter kategorisiert diese automatisch und zeigt Ihnen relevante Ergebnisse.",
      },
      {
        question: "Welche Anforderungen gelten bei sonstigen Vergaben?",
        answer: "Die Anforderungen variieren stark je nach Auftragsart. Typisch sind spezifische Nachweise (z.B. Entsorgungsfachbetrieb), Gewerbeanmeldung, Berufshaftpflicht und Referenzen aus vergleichbaren Aufträgen.",
      },
      {
        question: "Welche Auftraggeber vergeben sonstige Leistungen?",
        answer: "Alle öffentlichen Auftraggeber können diverse Leistungen vergeben – von Entsorgung über Beratung bis zu spezialisierten Dienstleistungen. Die Vergabeanforderungen variieren je nach Auftragsart.",
      },
    ],
  },
};
