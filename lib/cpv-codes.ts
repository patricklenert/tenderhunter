// SEO: CPV code landing pages — EU procurement vocabulary codes with German labels.
// These codes are extracted from tender data and used for /ausschreibungen/cpv/[code] landing pages.
// Top-level divisions (2-digit) and key subdivisions (4-8 digit) with real search demand.

export interface CpvEntry {
  code: string;
  label: string;
  description: string;
  intro: string;
  faq: Array<{ question: string; answer: string }>;
}

export const CPV_CODES: Record<string, CpvEntry> = {
  "45000000": {
    code: "45000000",
    label: "Bauarbeiten",
    description:
      "Bauarbeiten und bauähnliche Arbeiten — öffentliche Ausschreibungen nach CPV 45000000. Rohbau, Tiefbau, Installationsarbeiten und Baunebenleistungen.",
    intro:
      "Der CPV-Code 45000000 umfasst sämtliche Bauarbeiten und bauähnliche Leistungen der öffentlichen Hand. Dazu gehören Hochbau, Tiefbau, Installationsarbeiten, Abbrucharbeiten und Baunebenleistungen. Dies ist einer der umsatzstärksten Vergabebereiche in Deutschland mit Auftraggebern aus Bund, Ländern und Kommunen.",
    faq: [
      {
        question: "Was sind CPV 45000000 Ausschreibungen?",
        answer:
          "CPV 45000000 ist der EU-weit einheitliche Code für Bauarbeiten und bauähnliche Leistungen. Er umfasst Rohbau, Tiefbau, Installationsarbeiten, Abbrucharbeiten und Baunebenleistungen. Öffentliche Auftraggeber verwenden diesen Code, um Bauvergaben zu klassifizieren.",
      },
      {
        question: "Welche Untercodes gehören zu CPV 45000000?",
        answer:
          "Wichtige Untercodes sind 45200000 (Bauarbeiten für Gebäude), 45230000 (Bauarbeiten für Verkehrswege), 45300000 (Installationsarbeiten), 45100000 (Bauarbeiten für Abbruch und Erdarbeiten) und 45400000 (Baunebenleistungen wie Maler-, Dachdecker- und Trockenbauarbeiten).",
      },
      {
        question: "Wie finde ich Bauarbeiten-Ausschreibungen nach CPV-Code?",
        answer:
          "Tenderhunter erkennt CPV-Codes automatisch aus den Vergabeunterlagen und ordnet sie den passenden Kategorien zu. Sie können direkt nach CPV 45000000 filtern oder die spezialisierten Unterkategorien nutzen.",
      },
    ],
  },
  "45200000": {
    code: "45200000",
    label: "Bauarbeiten für Gebäude",
    description:
      "Bauarbeiten für Gebäude und bauliche Anlagen — öffentliche Ausschreibungen nach CPV 45200000. Neubau, Sanierung und Instandsetzung von öffentlichen Gebäuden.",
    intro:
      "CPV 45200000 steht für Bauarbeiten an Gebäuden und baulichen Anlagen. Dazu zählen Neubau, Umbau, Sanierung und Instandsetzung von Schulen, Rathäusern, Kliniken, Verwaltungsgebäuden und anderen öffentlichen Liegenschaften. Kommunen und Landesbetriebe sind die häufigsten Auftraggeber.",
    faq: [
      {
        question: "Was umfasst CPV 45200000?",
        answer:
          "Dieser Code deckt alle Bauarbeiten an Gebäuden ab — vom Neubau über Umbau bis zur Sanierung und Instandsetzung. Einschließlich Rohbau, Innenausbau, Dacharbeiten und Fassadenarbeiten an öffentlichen Gebäuden.",
      },
      {
        question: "Wer sind die Auftraggeber für Gebäude-Bauarbeiten?",
        answer:
          "Die häufigsten Auftraggeber sind Kommunen, Landesbetriebe, Bundeseinrichtungen, Universitäten, Kliniken und öffentliche Unternehmen wie Stadtwerke.",
      },
    ],
  },
  "45230000": {
    code: "45230000",
    label: "Bauarbeiten für Verkehrswege",
    description:
      "Bauarbeiten für Straßen, Brücken und Verkehrswege — öffentliche Ausschreibungen nach CPV 45230000.",
    intro:
      "CPV 45230000 umfasst Bauarbeiten an Straßen, Brücken, Tunneln, Eisenbahninfrastruktur und anderen Verkehrswegen. Diese Vergaben haben oft hohe Auftragsvolumina und werden von Landesbetrieben, Straßenbaubehörden und Kommunen vergeben.",
    faq: [
      {
        question: "Welche Arten von Verkehrswegebauarbeiten werden ausgeschrieben?",
        answer:
          "Straßenbau, Brückenbau, Tunnelbau, Radwegebau, Gehwegebau, Bahnhofsbau und Infrastrukturmaßnahmen für den öffentlichen Nahverkehr fallen unter diesen CPV-Code.",
      },
    ],
  },
  "45300000": {
    code: "45300000",
    label: "Installationsarbeiten",
    description:
      "Installationsarbeiten in Gebäuden — öffentliche Ausschreibungen nach CPV 45300000. Heizung, Sanitär, Elektro, Klima und Lüftung.",
    intro:
      "CPV 45300000 steht für alle Installationsarbeiten in und an Gebäuden. Dazu gehören Heizungsinstallation, Sanitärinstallation, Elektroinstallation, Klimaanlagen, Lüftungsanlagen und Brandschutztechnik. Diese Leistungen werden häufig als Teillose vergeben.",
    faq: [
      {
        question: "Was gehört zu Installationsarbeiten (CPV 45300000)?",
        answer:
          "Heizungsbau, Sanitärinstallation, Elektroinstallation, Klimaanlagen, Lüftungstechnik, Sprinkleranlagen, Brandmeldeanlagen und Aufzugsinstallationen fallen unter diesen Code.",
      },
      {
        question: "Werden Installationsarbeiten als eigene Lose vergeben?",
        answer:
          "Ja, bei größeren Bauprojekten werden Installationsarbeiten häufig als separate Lose (TGA-Lose) ausgeschrieben. Dies ermöglicht auch spezialisierten Handwerksbetrieben die Teilnahme.",
      },
    ],
  },
  "72000000": {
    code: "72000000",
    label: "IT-Dienstleistungen",
    description:
      "IT-Dienstleistungen und Softwareentwicklung — öffentliche Ausschreibungen nach CPV 72000000. Entwicklung, Wartung und Beratung.",
    intro:
      "CPV 72000000 umfasst das gesamte Spektrum IT-bezogener Dienstleistungen: Softwareentwicklung, Systemintegration, IT-Beratung, Wartung und Support, Hosting und Cloud-Services. Die öffentliche Digitalisierung treibt die Nachfrage in diesem Bereich stark.",
    faq: [
      {
        question: "Welche IT-Leistungen werden von der öffentlichen Hand ausgeschrieben?",
        answer:
          "Softwareentwicklung, IT-Beratung, Systemintegration, Cloud-Migration, Cybersecurity, IT-Infrastruktur, Helpdesk-Services und digitale Verwaltungslösungen werden regelmäßig ausgeschrieben.",
      },
      {
        question: "Welche besonderen Anforderungen gelten bei IT-Ausschreibungen?",
        answer:
          "Neben technischen Referenzen werden oft Informationssicherheitszertifizierungen (ISO 27001), DSGVO-Konformität und Erfahrung mit öffentlicher IT-Infrastruktur verlangt.",
      },
    ],
  },
  "72200000": {
    code: "72200000",
    label: "Softwareentwicklung",
    description:
      "Softwareentwicklung und Softwareprogrammierung — öffentliche Ausschreibungen nach CPV 72200000.",
    intro:
      "CPV 72200000 ist speziell für Softwareentwicklung und -programmierung reserviert. Öffentliche Auftraggeber suchen hier Anbieter für individuelle Softwarelösungen, App-Entwicklung, Webanwendungen und Systemintegration.",
    faq: [
      {
        question: "Was wird unter CPV 72200000 ausgeschrieben?",
        answer:
          "Individuelle Softwareentwicklung, Webanwendungen, Mobile Apps, Datenbankentwicklung, API-Entwicklung und Software-Integration in bestehende Systeme.",
      },
    ],
  },
  "79000000": {
    code: "79000000",
    label: "Dienstleistungen (Business)",
    description:
      "Unternehmensbezogene Dienstleistungen — öffentliche Ausschreibungen nach CPV 79000000. Beratung, Marketing, Personalwesen.",
    intro:
      "CPV 79000000 deckt unternehmensbezogene Dienstleistungen ab: Managementberatung, Marketing, Personalvermittlung, Übersetzungsdienste und Forschung. Ein breites Feld mit vielen Nischen für spezialisierte Anbieter.",
    faq: [
      {
        question: "Welche Beratungsleistungen fallen unter CPV 79000000?",
        answer:
          "Managementberatung, Strategieberatung, IT-Beratung, Personalberatung, Marketingberatung, Organisationsberatung und technische Beratung.",
      },
    ],
  },
  "90900000": {
    code: "90900000",
    label: "Reinigungs- und Entsorgungsdienste",
    description:
      "Reinigungs- und Entsorgungsdienstleistungen — öffentliche Ausschreibungen nach CPV 90900000. Gebäudereinigung, Abfallentsorgung und Schädlingsbekämpfung.",
    intro:
      "CPV 90900000 umfasst Reinigungs- und Entsorgungsdienstleistungen: Gebäudereinigung, Fensterreinigung, Industriereinigung, Abfallentsorgung, Recycling und Schädlingsbekämpfung. Kommunen und öffentliche Einrichtungen vergeben diese Leistungen regelmäßig.",
    faq: [
      {
        question: "Was gehört zu CPV 90900000?",
        answer:
          "Gebäudereinigung, Unterhaltsreinigung, Fensterreinigung, Grundreinigung, Industriereinigung, Abfallentsorgung, Recycling und Schädlingsbekämpfung.",
      },
      {
        question: "Wie groß sind die Auftragsvolumina bei Reinigungsausschreibungen?",
        answer:
          "Die Volumina variieren stark: von kleinen Kommunalgebäuden (unter 50.000 €) bis zu großen Verwaltungsgebäuden und Kliniken (über 1 Million €). Rahmenverträge sind üblich.",
      },
    ],
  },
  "90910000": {
    code: "90910000",
    label: "Reinigungsdienstleistungen",
    description:
      "Reinigungsdienstleistungen — öffentliche Ausschreibungen nach CPV 90910000. Unterhaltsreinigung, Gebäudereinigung und Hausmeisterservice.",
    intro:
      "CPV 90910000 ist der spezifische Code für Reinigungsdienstleistungen. Er umfasst Unterhaltsreinigung von Verwaltungsgebäuden, Schulen, Kliniken und anderen öffentlichen Liegenschaften. Dies ist einer der am häufigsten vergebenen Dienstleistungscodes.",
    faq: [
      {
        question: "Was ist der Unterschied zwischen CPV 90900000 und 90910000?",
        answer:
          "90900000 ist der übergeordnete Code für Reinigung und Entsorgung. 90910000 ist spezifisch für Reinigungsdienstleistungen (ohne Entsorgung). Für reine Reinigungsausschreibungen wird meist 90910000 verwendet.",
      },
      {
        question: "Welche Reinigungsleistungen werden von öffentlichen Auftraggebern nachgefragt?",
        answer:
          "Unterhaltsreinigung (täglich/wöchentlich), Fensterreinigung, Grundreinigung, Teppichreinigung, Graffitientfernung und Winterdienst werden regelmäßig ausgeschrieben.",
      },
    ],
  },
  "90911000": {
    code: "90911000",
    label: "Gebäudereinigung",
    description:
      "Gebäudereinigung und Unterhaltsreinigung — öffentliche Ausschreibungen nach CPV 90911000.",
    intro:
      "CPV 90911000 steht speziell für Gebäudereinigung und Unterhaltsreinigung. Dies schließt die regelmäßige Reinigung von Büros, Schulen, Verwaltungsgebäuden und öffentlichen Einrichtungen ein.",
    faq: [
      {
        question: "Was umfasst Gebäudereinigung nach CPV 90911000?",
        answer:
          "Unterhaltsreinigung, Büroreinigung, Schulreinigung, Klinikreinigung und die Reinigung öffentlicher Verwaltungsgebäude. Häufig als Rahmenvertrag mit festen Leistungsverzeichnissen.",
      },
    ],
  },
  "90920000": {
    code: "90920000",
    label: "Abfallentsorgung",
    description:
      "Abfallentsorgung und Recycling — öffentliche Ausschreibungen nach CPV 90920000.",
    intro:
      "CPV 90920000 umfasst Abfallentsorgung, Müllabfuhr, Recycling und Abfallwirtschaft. Kommunen und Zweckverbände sind die Hauptauftraggeber für diese Leistungen.",
    faq: [
      {
        question: "Welche Entsorgungsleistungen werden ausgeschrieben?",
        answer:
          "Müllabfuhr, Restmüllentsorgung, Biomüllentsorgung, Papierrecycling, Sondermüllentsorgung, Straßenreinigung und Winterdienst werden unter diesem Code vergeben.",
      },
    ],
  },
  "71000000": {
    code: "71000000",
    label: "Architektur- und Ingenieurdienste",
    description:
      "Architektur-, Ingenieur- und Vermessungsleistungen — öffentliche Ausschreibungen nach CPV 71000000.",
    intro:
      "CPV 71000000 steht für Architektur-, Ingenieur- und Vermessungsleistungen. Dazu gehören Entwurfsplanung, Tragwerksplanung, TGA-Planung, Baubegleitung, Gutachten und Vermessungsarbeiten. Diese Leistungen werden häufig in Planungswettbewerben vergeben.",
    faq: [
      {
        question: "Was gehört zu CPV 71000000?",
        answer:
          "Architektenleistungen (HOAI Leistungsphasen1-9), Ingenieurleistungen, Tragwerksplanung, TGA-Planung, Vermessungsleistungen, Gutachten und Baubegleitung.",
      },
      {
        question: "Wie werden Architektenleistungen vergeben?",
        answer:
          "Häufig über Planungswettbewerbe oder freihändige Vergaben. Bei Aufträgen über dem EU-Schwellenwert gelten die VgV-Vorgaben mit besonderen Eignungsanforderungen.",
      },
    ],
  },
  "71300000": {
    code: "71300000",
    label: "Ingenieurdienstleistungen",
    description:
      "Ingenieurdienstleistungen und technische Beratung — öffentliche Ausschreibungen nach CPV 71300000.",
    intro:
      "CPV 71300000 umfasst Ingenieurdienstleistungen wie Tragwerksplanung, TGA-Planung, Verkehrsplanung, Wasserwirtschaft und technische Beratung. Diese Leistungen werden von öffentlichen Auftraggebern für Infrastrukturprojekte vergeben.",
    faq: [
      {
        question: "Welche Ingenieurleistungen werden ausgeschrieben?",
        answer:
          "Tragwerksplanung, HLS-Planung, Verkehrsplanung, Wasserwirtschaft, Umweltgutachten, Energieberatung und technische Projektleitung.",
      },
    ],
  },
  "50000000": {
    code: "50000000",
    label: "Reparatur und Wartung",
    description:
      "Reparatur- und Wartungsdienstleistungen — öffentliche Ausschreibungen nach CPV 50000000.",
    intro:
      "CPV 50000000 umfasst Reparatur und Wartung von Anlagen, Geräten und Gebäuden. Dazu gehören Wartungsverträge für Heizungsanlagen, Aufzüge, Türklingeln, IT-Hardware und Fahrzeuge der öffentlichen Hand.",
    faq: [
      {
        question: "Was wird unter CPV 50000000 ausgeschrieben?",
        answer:
          "Wartungsverträge für technische Anlagen, Reparatur von Gebäuden und Infrastruktur, Instandhaltung von IT-Systemen und Fahrzeugwartung.",
      },
    ],
  },
  "50300000": {
    code: "50300000",
    label: "Wartung von Computern",
    description:
      "Wartung und Reparatur von Computern und IT-Ausstattung — öffentliche Ausschreibungen nach CPV 50300000.",
    intro:
      "CPV 50300000 steht für die Wartung und Reparatur von Computern, Peripheriegeräten und IT-Ausstattung. Öffentliche Einrichtungen vergeben regelmäßig Rahmenverträge für IT-Wartung und Support.",
    faq: [
      {
        question: "Welche IT-Wartungsleistungen werden ausgeschrieben?",
        answer:
          "PC-Wartung, Druckerwartung, Serverwartung, Netzwerkwartung, Helpdesk-Services und Hardware-Reparatur werden unter diesem Code vergeben.",
      },
    ],
  },
  "60000000": {
    code: "60000000",
    label: "Transportdienste",
    description:
      "Transport- und Beförderungsdienstleistungen — öffentliche Ausschreibungen nach CPV 60000000.",
    intro:
      "CPV 60000000 umfasst Transport- und Beförderungsdienstleistungen: Personennahverkehr, Gütertransport, Kurierdienste und Logistikleistungen der öffentlichen Hand.",
    faq: [
      {
        question: "Welche Transportleistungen werden vergeben?",
        answer:
          "Öffentlicher Personennahverkehr (ÖPNV), Schulbusverkehr, Gütertransport, Kurierdienste, Umzugsdienste und Logistikleistungen.",
      },
    ],
  },
  "60100000": {
    code: "60100000",
    label: "Straßentransport",
    description:
      "Straßentransport und Güterkraftverkehr — öffentliche Ausschreibungen nach CPV 60100000.",
    intro:
      "CPV 60100000 steht für Straßentransport und Güterkraftverkehr. Kommunen und Landesbetriebe vergeben Transportaufträge für Baumaterial, Entsorgung und Logistik.",
    faq: [
      {
        question: "Was umfasst Straßentransport nach CPV 60100000?",
        answer:
          "Gütertransport, Stückguttransport, Schwertransport, Krantransport und logistische Dienstleistungen auf der Straße.",
      },
    ],
  },
  "80000000": {
    code: "80000000",
    label: "Bildung und Ausbildung",
    description:
      "Bildungs- und Ausbildungsdienstleistungen — öffentliche Ausschreibungen nach CPV 80000000.",
    intro:
      "CPV 80000000 umfasst Bildungs- und Ausbildungsdienstleistungen: Schulungen, Weiterbildung, Seminare und pädagogische Leistungen. öffentliche Auftraggeber vergeben diese Leistungen für Mitarbeiterfortbildung und Bürgerbildung.",
    faq: [
      {
        question: "Welche Bildungsleistungen werden ausgeschrieben?",
        answer:
          "Mitarbeiterschulungen, Weiterbildungsprogramme, Sprachkurse, IT-Schulungen, Sicherheitsschulungen und pädagogische Konzepte.",
      },
    ],
  },
  "85000000": {
    code: "85000000",
    label: "Gesundheits- und Sozialdienste",
    description:
      "Gesundheits- und Sozialdienstleistungen — öffentliche Ausschreibungen nach CPV 85000000.",
    intro:
      "CPV 85000000 steht für Gesundheits- und Sozialdienstleistungen: Pflege, Rettungsdienste, Sozialarbeit und Gesundheitsförderung. Kommunen und Landesbehörden sind die Hauptauftraggeber.",
    faq: [
      {
        question: "Welche Gesundheitsleistungen werden vergeben?",
        answer:
          "Ambulante Pflege, Rettungsdienste, Sozialarbeit, Gesundheitsförderung, Rehabilitation und medizinische Gutachten.",
      },
    ],
  },
  "77000000": {
    code: "77000000",
    label: "Land- und Forstwirtschaft",
    description:
      "Land- und forstwirtschaftliche Dienstleistungen — öffentliche Ausschreibungen nach CPV 77000000.",
    intro:
      "CPV 77000000 umfasst land- und forstwirtschaftliche Dienstleistungen: Grünflächenpflege, Baumpflege, Landschaftspflege und forstwirtschaftliche Leistungen. Kommunen und Naturschutzbehörden vergeben diese Leistungen regelmäßig.",
    faq: [
      {
        question: "Was gehört zu CPV 77000000?",
        answer:
          "Grünflächenpflege, Baumpflege, Heckenschnitt, Landschaftspflege, Forstarbeiten, Wildwiesenpflege und Biotoppflege.",
      },
    ],
  },
  "77300000": {
    code: "77300000",
    label: "Garten- und Landschaftsbau",
    description:
      "Garten- und Landschaftsbau — öffentliche Ausschreibungen nach CPV 77300000.",
    intro:
      "CPV 77300000 steht für Garten- und Landschaftsbau: Neuanlage, Pflege und Umgestaltung von Grünflächen, Parks und öffentlichen Gärten. Kommunen und öffentliche Einrichtungen vergeben diese Leistungen als GaLaBau-Ausschreibungen.",
    faq: [
      {
        question: "Welche GaLaBau-Leistungen werden ausgeschrieben?",
        answer:
          "Neuanlage von Grünflächen, Spielplatzbau, Parkgestaltung, Bepflanzung, Rasenansaat, Bewässerungsanlagen und Wegebau im Garten- und Landschaftsbau.",
      },
    ],
  },
  "35000000": {
    code: "35000000",
    label: "Sicherheits- und Verteidigung",
    description:
      "Sicherheits- und Verteidigungsausrüstung — öffentliche Ausschreibungen nach CPV 35000000.",
    intro:
      "CPV 35000000 umfasst Sicherheits- und Verteidigungsausrüstung: Überwachungssysteme, Zutrittskontrolle, Alarmanlagen und Sicherheitsdienstleistungen für öffentliche Einrichtungen.",
    faq: [
      {
        question: "Welche Sicherheitsleistungen werden vergeben?",
        answer:
          "Überwachungssysteme, Zutrittskontrolle, Alarmanlagen, Brandschutztechnik, Sicherheitsdienstleistungen und Objektschutz.",
      },
    ],
  },
  "34000000": {
    code: "34000000",
    label: "Fahrzeuge und Transportmittel",
    description:
      "Fahrzeuge und Transportmittel — öffentliche Ausschreibungen nach CPV 34000000.",
    intro:
      "CPV 34000000 steht für Fahrzeuge und Transportmittel: Dienstfahrzeuge, Nutzfahrzeuge, Busse und Spezialfahrzeuge der öffentlichen Hand.",
    faq: [
      {
        question: "Welche Fahrzeuge werden von der öffentlichen Hand ausgeschrieben?",
        answer:
          "Dienstwagen, Nutzfahrzeuge, Busse, Spezialfahrzeuge (Müllfahrzeuge, Feuerwehrfahrzeuge), Elektrofahrzeuge und Fahrräder.",
      },
    ],
  },
  "15000000": {
    code: "15000000",
    label: "Nahrungsmittel",
    description:
      "Nahrungsmittel und Getränke — öffentliche Ausschreibungen nach CPV 15000000.",
    intro:
      "CPV 15000000 umfasst Nahrungsmittel und Getränke: Verpflegung für Kliniken, Schulen, Kitas und öffentliche Einrichtungen. Catering-Dienstleistungen und Lebensmittellieferungen.",
    faq: [
      {
        question: "Welche Nahrungsmittel-Lieferungen werden ausgeschrieben?",
        answer:
          "Kantinenverpflegung, Schulverpflegung, Klinikverpflegung, Catering für Veranstaltungen und Lebensmittellieferungen für öffentliche Einrichtungen.",
      },
    ],
  },
  "18000000": {
    code: "18000000",
    label: "Bekleidung und Schuhe",
    description:
      "Bekleidung und Schuhe — öffentliche Ausschreibungen nach CPV 18000000.",
    intro:
      "CPV 18000000 steht für Bekleidung und Schuhe: Dienstkleidung, Uniformen, Schutzbekleidung und Berufsbekleidung für öffentliche Mitarbeiter.",
    faq: [
      {
        question: "Welche Bekleidung wird von der öffentlichen Hand ausgeschrieben?",
        answer:
          "Dienstkleidung, Uniformen, Schutzbekleidung, Berufsschuhe, Warnkleidung und spezielle Arbeitsbekleidung für verschiedene Berufsgruppen.",
      },
    ],
  },
};

export const ALL_CPV_CODES = Object.keys(CPV_CODES);

// SEO: CPV division prefixes for matching 2-digit codes to their parent division
export const CPV_DIVISION_PREFIXES: Record<string, string> = {
  "03": "03000000", "14": "14000000", "15": "15000000", "16": "16000000",
  "18": "18000000", "19": "19000000", "22": "22000000", "24": "24000000",
  "30": "30000000", "31": "31000000", "32": "32000000", "33": "33000000",
  "34": "34000000", "35": "35000000", "37": "37000000", "38": "38000000",
  "39": "39000000", "41": "41000000", "42": "42000000", "43": "43000000",
  "44": "44000000", "45": "45000000", "48": "48000000", "50": "50000000",
  "51": "51000000", "55": "55000000", "60": "60000000", "63": "63000000",
  "64": "64000000", "65": "65000000", "66": "66000000", "70": "70000000",
  "71": "71000000", "72": "72000000", "73": "73000000", "75": "75000000",
  "76": "76000000", "77": "77000000", "79": "79000000", "80": "80000000",
  "85": "85000000", "90": "90000000", "92": "92000000", "98": "98000000",
};
