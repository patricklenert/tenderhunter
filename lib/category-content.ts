export interface CategoryContent {
  intro: string;
  tips: string[];
  requirements: string[];
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
  },
};
