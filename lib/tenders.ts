export interface Tender {
  id: number;
  title: string;
  client: string;
  location: string;
  deadline?: string;
  publishDate: string;
  category: string;
  description?: string;
  referenceNumber?: string;
  area?: string;
  source: string;
  sourceUrl?: string;
  detailUrl?: string;
  searchUrl?: string;
}

export const tenders: Tender[] = [
  {
    id: 1,
    title: "Oberstufenzentrum Medizin und Gesundheit - Dienstleistungskonzession",
    client: "Land Berlin (Sondervermögen Immobilien des Landes Berlin)",
    location: "Berlin",
    deadline: "30. Januar 2026",
    publishDate: "Januar 2026",
    category: "Dienstleistungskonzession",
    description: "Rahel-Hirsch-Schule, Peter-Weiss-Gasse 8 in 12627",
    source: "BIM Berliner Immobilienmanagement GmbH",
    sourceUrl: "https://www.bim-berlin.de/zusammenarbeit/aktuelle-ausschreibungen",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=Oberstufenzentrum+Medizin+Gesundheit"
  },
  {
    id: 2,
    title: "Gas-, Wasser- und Entwässerungsanlagen - Gastronomie",
    client: "Land Berlin (Sondervermögen Immobilien des Landes Berlin)",
    location: "Berlin",
    deadline: "29. Januar 2026",
    publishDate: "Januar 2026",
    category: "Technische Gebäudeausrüstung",
    description: "Austausch Fettabscheider, Erneuerung Grundleitungen Gastronomie",
    referenceNumber: "B20029-30376000-001-411-01",
    source: "BIM Berliner Immobilienmanagement GmbH",
    sourceUrl: "https://www.bim-berlin.de/zusammenarbeit/aktuelle-ausschreibungen",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=B20029-30376000-001-411-01"
  },
  {
    id: 3,
    title: "Facility Management - Avenue Michel-Ange, Bruxelles",
    client: "Land Berlin (Sondervermögen Immobilien des Landes Berlin)",
    location: "Bruxelles, Belgien",
    deadline: "29. Januar 2026",
    publishDate: "Januar 2026",
    category: "Facility Management",
    description: "Avenue Michel-Ange 71 - 1000 Bruxelles",
    referenceNumber: "V-2026-000003",
    source: "BIM Berliner Immobilienmanagement GmbH",
    sourceUrl: "https://www.bim-berlin.de/zusammenarbeit/aktuelle-ausschreibungen",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=V-2026-000003"
  },
  {
    id: 4,
    title: "Innentüren",
    client: "Land Berlin (Sondervermögen Immobilien des Landes Berlin)",
    location: "Berlin",
    deadline: "27. Januar 2026",
    publishDate: "Januar 2026",
    category: "Bauarbeiten",
    referenceNumber: "BZ1031-30349000-001-334-02",
    source: "BIM Berliner Immobilienmanagement GmbH",
    sourceUrl: "https://www.bim-berlin.de/zusammenarbeit/aktuelle-ausschreibungen",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=BZ1031-30349000-001-334-02"
  },
  {
    id: 5,
    title: "Dachdeckungs- und Dachabdichtungsarbeiten",
    client: "Land Berlin (Sondervermögen Immobilien des Landes Berlin)",
    location: "Berlin",
    deadline: "26. Januar 2026",
    publishDate: "Januar 2026",
    category: "Bauarbeiten - Dacharbeiten",
    description: "Dachöffnungen herstellen",
    referenceNumber: "N24046-30007000-002-362-01",
    source: "BIM Berliner Immobilienmanagement GmbH",
    sourceUrl: "https://www.bim-berlin.de/zusammenarbeit/aktuelle-ausschreibungen",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=N24046-30007000-002-362-01"
  },
  {
    id: 6,
    title: "Technisches Gebäudemanagement - Bundesministerium für Wirtschaft und Energie",
    client: "Bundesanstalt für Immobilienaufgaben",
    location: "Berlin",
    publishDate: "Januar 2026",
    category: "Technisches Gebäudemanagement",
    referenceNumber: "VOEK 024-24",
    source: "Bundesanstalt für Immobilienaufgaben (BImA)",
    sourceUrl: "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb",
    searchUrl: "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb?search=VOEK+024-24"
  },
  {
    id: 7,
    title: "Technisches Gebäudemanagement - Presse- und Informationsamt",
    client: "Bundesanstalt für Immobilienaufgaben",
    location: "Berlin",
    publishDate: "Januar 2026",
    category: "Technisches Gebäudemanagement",
    description: "Liegenschaften für das Presse- und Informationsamt der Bundesregierung",
    referenceNumber: "VOEK 457-25",
    source: "Bundesanstalt für Immobilienaufgaben (BImA)",
    sourceUrl: "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb",
    searchUrl: "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb?search=VOEK+457-25"
  },
  {
    id: 8,
    title: "Technisches Gebäudemanagement - GMH Hamburg",
    client: "GMH | Gebäudemanagement Hamburg GmbH",
    location: "Hamburg",
    publishDate: "19. Januar 2026",
    category: "Technisches Gebäudemanagement",
    description: "Haus der Erde (Bundesstraße 57) und MIN-Forum (Sedanstraße 16-18)",
    referenceNumber: "63635-2026",
    source: "TED / Hamburg.de",
    searchUrl: "https://ted.europa.eu/TED/browse/browseByBuyerProfile.html?searchText=63635-2026"
  },
  {
    id: 9,
    title: "Sanitärarbeiten - Universitätsklinikum Magdeburg",
    client: "Universitätsklinikum Magdeburg",
    location: "Magdeburg",
    publishDate: "15. Januar 2026",
    category: "Technische Gebäudeausrüstung - Sanitär",
    description: "910 m Trinkwasserleitung, 240 m Schmutzwasserleitung, 11 Stk. Strömungsteiler, 50 Stk. Absperrventile",
    referenceNumber: "Los 0.17",
    source: "DTAD - Deutsche Tenders und Ausschreibungsdatenbank",
    sourceUrl: "https://www.dtad.com/de/ausschreibungen/branchen/technische-gebaeudeausruestung-tga",
    searchUrl: "https://www.dtad.com/de/ausschreibungen/branchen/technische-gebaeudeausruestung-tga?search=Universit%C3%A4tsklinikum+Magdeburg"
  },
  {
    id: 10,
    title: "Raumlufttechnische Anlagen - Bibliothek Rotenburg",
    client: "Stadt Rotenburg an der Fulda",
    location: "Rotenburg an der Fulda",
    publishDate: "15. Januar 2026",
    category: "Technische Gebäudeausrüstung - Lüftung",
    description: "Umbau Lüftung Bibliothek - Raumlufttechnische Anlagen (DIN 18 379)",
    source: "DTAD - Deutsche Tenders und Ausschreibungsdatenbank",
    sourceUrl: "https://www.dtad.com/de/ausschreibungen/branchen/technische-gebaeudeausruestung-tga",
    searchUrl: "https://www.dtad.com/de/ausschreibungen/branchen/technische-gebaeudeausruestung-tga?search=Rotenburg+Bibliothek+L%C3%BCftung"
  },
  {
    id: 11,
    title: "Facility Management - Allgemeiner Bestand, Gewerbe und Polizei Berlin",
    client: "Land Berlin – Sondervermögen Immobilien des Landes Berlin (SILB) c/o BIM",
    location: "Berlin",
    deadline: "30. November 2026",
    publishDate: "07. Januar 2026",
    category: "Facility Management",
    description: "86 Liegenschaften in 6 Losen. Los 1: 14 Objekte (ca. 140.000 m² BGF), Los 2: 16 Objekte (ca. 110.000 m² BGF). Facilitäre Leistungen zur ganzheitlichen technischen Betriebsführung.",
    referenceNumber: "7184-2026",
    area: "250.000 m²",
    source: "ICC Hofmann - TED Datenbank",
    sourceUrl: "http://www.icc-hofmann.de/",
    searchUrl: "https://www.icc-hofmann.de/cgi-bin/SimpleQuery?method=showExtendedSearch&searchText=7184-2026"
  },
  {
    id: 12,
    title: "Beschaffung und Einführung eines Computer Aided Facility Management Systems (CAFM)",
    client: "Stadt Köln - Amt für Recht, Vergabe und Versicherungen",
    location: "Köln, NRW",
    deadline: "09. März 2026",
    publishDate: "27. Januar 2026",
    category: "Facility Management",
    description: "CAFM-System für Facility Management",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=CAFM+K%C3%B6ln"
  },
  {
    id: 13,
    title: "BLB Aachen | JVA Euskirchen | Neubau Rotationsanstalt | BIM Management",
    client: "Bau- und Liegenschaftsbetrieb NRW Aachen",
    location: "Aachen, NRW",
    deadline: "04. März 2026",
    publishDate: "01. Februar 2026",
    category: "Technisches Gebäudemanagement",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=JVA+Euskirchen+BIM"
  },
  {
    id: 14,
    title: "Universität zu Köln - Vorbereitung und Begleitung CAFM-System und Einführung",
    client: "Universität zu Köln, Abteilung 64",
    location: "Köln, NRW",
    deadline: "26. Februar 2026",
    publishDate: "27. Januar 2026",
    category: "Facility Management",
    description: "Beratung und Begleitung zur CAFM-System Einführung",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=Universit%C3%A4t+K%C3%B6ln+CAFM"
  },
  {
    id: 15,
    title: "BLB NRW Köln, Deutsche Sporthochschule Köln, HKop Modernisierung Hörsaalgebäude BIM-Management",
    client: "Bau- und Liegenschaftsbetrieb NRW Köln",
    location: "Köln, NRW",
    deadline: "27. Februar 2026",
    publishDate: "28. Januar 2026",
    category: "Technisches Gebäudemanagement",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=Deutsche+Sporthochschule+K%C3%B6ln+BIM"
  },
  {
    id: 16,
    title: "Universitätsklinikum Münster - 3800 Zentral-Laborgebäude Betriebsführung Technische Ausrüstung",
    client: "UKM Infrastruktur Management GmbH",
    location: "Münster, NRW",
    deadline: "17. Februar 2026",
    publishDate: "16. Januar 2026",
    category: "Technisches Gebäudemanagement",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=Universit%C3%A4tsklinikum+M%C3%BCnster+Zentral-Labor"
  },
  {
    id: 17,
    title: "BLB NRW DU / Hochschule Rhein-Waal - Gebäudemanagement",
    client: "Bau- und Liegenschaftsbetrieb NRW Duisburg",
    location: "Duisburg, NRW",
    deadline: "17. Februar 2026",
    publishDate: "16. Januar 2026",
    category: "Technisches Gebäudemanagement",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=Hochschule+Rhein-Waal+Duisburg"
  },
  {
    id: 18,
    title: "IPSS Hygienemanagement",
    client: "Universitätsklinikum Düsseldorf",
    location: "Düsseldorf, NRW",
    publishDate: "01. Februar 2023",
    category: "Facility Management",
    description: "Hygienemanagement und Reinigungsdienstleistungen",
    source: "eVergabe NRW",
    sourceUrl: "https://www.evergabe.nrw.de/",
    searchUrl: "https://www.evergabe.nrw.de/VMPCenter/common/project/search.do?method=showExtendedSearch&searchText=IPSS+Hygienemanagement+D%C3%BCsseldorf"
  },
  {
    id: 19,
    title: "KRU_EN_6106A6 Fassadenarbeiten Fassadensanierung",
    client: "Krankenhaus Rummelsberg GmbH",
    location: "Rummelsberg, Bayern",
    publishDate: "30. Januar 2026",
    category: "Facility Management",
    description: "Fassadensanierung und Instandhaltung",
    source: "Bayern Vergabe",
    sourceUrl: "https://www.vergabe.bayern.de/",
    searchUrl: "https://www.vergabe.bayern.de/veroeffentlichungen/auftragsbekanntmachungen/index.html?search=KRU_EN_6106A6"
  },
  {
    id: 20,
    title: "KRU_EN_6105A3 Ligenkrankenhaus Systemhalle",
    client: "Krankenhaus Rummelsberg GmbH",
    location: "Rummelsberg, Bayern",
    publishDate: "30. Januar 2026",
    category: "Technisches Gebäudemanagement",
    description: "Systemhalle und technische Gebäudeausrüstung",
    source: "Bayern Vergabe",
    sourceUrl: "https://www.vergabe.bayern.de/",
    searchUrl: "https://www.vergabe.bayern.de/veroeffentlichungen/auftragsbekanntmachungen/index.html?search=KRU_EN_6105A3"
  }
];

export const categories = [
  "Alle Kategorien",
  "Facility Management",
  "Technisches Gebäudemanagement",
  "Technische Gebäudeausrüstung",
  "Bauarbeiten",
  "Dienstleistungskonzession"
];

export const locations = [
  "Alle Standorte",
  "Berlin",
  "Hamburg",
  "Magdeburg",
  "Rotenburg an der Fulda",
  "Bruxelles"
];

export function getCategoryStats() {
  const stats = tenders.reduce((acc, tender) => {
    const category = tender.category.split(" - ")[0];
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(stats).map(([name, value]) => ({ name, value }));
}

export function getLocationStats() {
  const stats = tenders.reduce((acc, tender) => {
    const location = tender.location.split(",")[0];
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(stats).map(([name, value]) => ({ name, value }));
}
