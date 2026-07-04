// SEO: City-level taxonomy for /ausschreibungen/stadt/[slug] landing pages.
// Covers ~50 largest German cities with slug, display label, Bundesland mapping, and intro text.
// Slugs use URL-safe lowercase with umlauts replaced (ae/oe/ue/ss) to avoid encoding issues.

export interface CityEntry {
  slug: string;
  label: string;
  bundesland: string;
  intro: string;
  // SEO: Enriched content for city landing pages — procurement authorities and local context
  procurementAuthorities?: string[];
  localInfo?: string;
}

export const CITIES: CityEntry[] = [
  {
    slug: "muenchen",
    label: "München",
    bundesland: "Bayern",
    intro: "München als Landeshauptstadt und größte Stadt Bayerns ist einer der aktivsten öffentlichen Auftraggeber in Süddeutschheit. Die Landeshauptstadt München, städtische Betriebe und die Ludwig-Maximilians-Universität schreiben regelmäßig Bauarbeiten, IT-Dienstleistungen, Facility Management und Lieferaufträge aus.",
    procurementAuthorities: ["Landeshauptstadt München", "Stadtwerke München", "Ludwig-Maximilians-Universität München"],
    localInfo: "München hat als Millionenstadt ein besonders hohes Auftragsvolumen in den Bereichen Facility Management und IT-Dienstleistungen. Die starke Wirtschaftskraft der Region sorgt für ein überdurchschnittliches Vergabevolumen.",
  },
  {
    slug: "berlin",
    label: "Berlin",
    bundesland: "Berlin",
    intro: "Berlin als Bundeshauptstadt und Stadtstaat ist einer der größten öffentlichen Auftraggeber in Deutschland. Die Senatsverwaltungen, Bezirke und Landesbetriebe vergeben Aufträge in allen Leistungsbereichen – von Großbauprojekten über IT-Services bis hin zu Gebäudereinigung.",
    procurementAuthorities: ["Senatsverwaltung Berlin", "Berliner Wasserbetriebe", "Berlin Partner für Wirtschaft und Technologie"],
    localInfo: "Berlin vergibt als Stadtstaat mit 12 Bezirken besonders viele kommunale Aufträge. Die Digitalisierungsstrategie treibt IT-Ausschreibungen stark voran.",
  },
  {
    slug: "hamburg",
    label: "Hamburg",
    bundesland: "Hamburg",
    intro: "Hamburg als größter deutscher Hafenstadtstaat ist ein bedeutender Vergabemarkt. Die Stadt, ihre Bezirke und städtischen Unternehmen schreiben regelmäßig Bauarbeiten, IT-Services, Facility Management und maritime Dienstleistungen aus.",
    procurementAuthorities: ["Freie und Hansestadt Hamburg", "Hamburger Verkehrsverbund", "Hamburg Port Authority"],
    localInfo: "Hamburg profitiert als Hafenstadt von einem überdurchschnittlichen Volumen an Logistik- und Infrastrukturaufträgen. Die Hafenerweiterung und Stadtentwicklung sorgen für kontinuierliche Bauvergaben.",
  },
  {
    slug: "koeln",
    label: "Köln",
    bundesland: "Nordrhein-Westfalen",
    intro: "Köln ist eine der größten Städte Nordrhein-Westfalens mit hoher Vergabeaktivität. Die Stadtverwaltung, städtische Betriebe und die Universität zu Köln vergeben regelmäßig Aufträge für Bauarbeiten, IT, Reinigung und Grünflächenpflege.",
    procurementAuthorities: ["Stadt Köln", "Kölner Verkehrsbetriebe", "Universität zu Köln"],
    localInfo: "Köln ist als Medienmetropole ein Hotspot für IT- und Digitalisierungsaufträge. Die Rheinische Friedrich-Wilhelms-Universität und zahlreiche Bundesbehörden sorgen für ein breites Vergabespektrum.",
  },
  {
    slug: "frankfurt",
    label: "Frankfurt am Main",
    bundesland: "Hessen",
    intro: "Frankfurt am Main als Finanzmetropole und eine der größten Städte Hessens hat eine aktive Vergabelandschaft. Die Stadtverwaltung, städtische Gesellschaften und das Land Hessen vergeben Aufträge insbesondere im IT-Bereich, bei Bauleistungen und in der energetischen Gebäudesanierung.",
    procurementAuthorities: ["Stadt Frankfurt am Main", "Stadtwerke Frankfurt", "Fraunhofer-Institut"],
    localInfo: "Frankfurt als Finanzzentrum hat einen hohen Bedarf an IT-Sicherheits- und Digitalisierungsdienstleistungen. Der Flughafen und die Messegesellschaft sind zusätzliche große Auftraggeber.",
  },
  {
    slug: "stuttgart",
    label: "Stuttgart",
    bundesland: "Baden-Württemberg",
    intro: "Stuttgart als Landeshauptstadt von Baden-Württemberg ist ein bedeutender Vergabestandort. Die Landeshauptstadt, Landesbetriebe und die Universität Stuttgart schreiben regelmäßig Bauarbeiten, IT-Dienstleistungen und Facility Management aus.",
  },
  {
    slug: "duesseldorf",
    label: "Düsseldorf",
    bundesland: "Nordrhein-Westfalen",
    intro: "Düsseldorf als Landeshauptstadt von Nordrhein-Westfalen ist ein aktiver öffentlicher Auftraggeber. Die Landesregierung, Stadtverwaltung und städtische Betriebe vergeben Aufträge in den Bereichen IT, Bau, Reinigung und Veranstaltungsmanagement.",
  },
  {
    slug: "leipzig",
    label: "Leipzig",
    bundesland: "Sachsen",
    intro: "Leipzig ist eine der am schnellsten wachsenden Städte Ostdeutschlands mit zunehmender Vergabeaktivität. Die Stadtverwaltung und städtische Unternehmen vergeben regelmäßig Aufträge für Infrastrukturprojekte, Digitalisierung und energieeffiziente Sanierung.",
  },
  {
    slug: "dortmund",
    label: "Dortmund",
    bundesland: "Nordrhein-Westfalen",
    intro: "Dortmund als Großstadt im Ruhrgebiet hat eine vielfältige Vergabelandschaft. Die Stadtverwaltung und städtische Betriebe vergeben Aufträge insbesondere in den Bereichen Stadtentwicklung, IT-Infrastruktur und kommunale Dienstleistungen.",
  },
  {
    slug: "essen",
    label: "Essen",
    bundesland: "Nordrhein-Westfalen",
    intro: "Essen als ehemalige Europäische Grüne Hauptstadt ist ein aktiver Vergabemarkt. Die Stadtverwaltung, städtische Unternehmen und Landesbetriebe vergeben Aufträge in den Bereichen Energiewende, Stadtentwicklung und kommunale Infrastruktur.",
  },
  {
    slug: "bremen",
    label: "Bremen",
    bundesland: "Bremen",
    intro: "Bremen als Stadtstaat vergeben öffentliche Aufträge insbesondere im Hafenbereich, in der Logistik und in der maritimen Wirtschaft. Auch klassische kommunale Vergaben wie Reinigung und Winterdienst sind regelmäßig ausgeschrieben.",
  },
  {
    slug: "dresden",
    label: "Dresden",
    bundesland: "Sachsen",
    intro: "Dresden als Landeshauptstadt Sachsens profitiert vom wirtschaftlichen Aufschwung. Öffentliche Vergaben umfassen insbesondere Infrastrukturprojekte, Digitalisierung der Verwaltung und energieeffiziente Sanierung öffentlicher Gebäude.",
  },
  {
    slug: "hannover",
    label: "Hannover",
    bundesland: "Niedersachsen",
    intro: "Hannover als Landeshauptstadt von Niedersachsen ist ein bedeutender Vergabestandort. Die Landeshauptstadt, Landesbetriebe und die Leibniz Universität vergeben regelmäßig Aufträge für Bauarbeiten, IT und Facility Management.",
  },
  {
    slug: "nuernberg",
    label: "Nürnberg",
    bundesland: "Bayern",
    intro: "Nürnberg als zweitgrößte Stadt Bayerns hat eine aktive Vergabelandschaft. Die Stadtverwaltung, städtische Betriebe und das Bundesamt für Migration und Flüchtlinge vergeben regelmäßig Aufträge in verschiedenen Leistungsbereichen.",
  },
  {
    slug: "duisburg",
    label: "Duisburg",
    bundesland: "Nordrhein-Westfalen",
    intro: "Duisburg als Standort des größten Binnenhafens der Welt vergeben öffentliche Aufträge insbesondere im Hafenbereich, in der Logistik und in der Stadtentwicklung. Die Stadtverwaltung und städtische Unternehmen sind aktive Auftraggeber.",
  },
  {
    slug: "bochum",
    label: "Bochum",
    bundesland: "Nordrhein-Westfalen",
    intro: "Bochum als Universitätsstadt im Ruhrgebiet vergeben öffentliche Aufträge in den Bereichen Bildungsinfrastruktur, Stadtentwicklung und kommunale Dienstleistungen. Die Ruhr-Universität Bochum ist ein zusätzlicher relevanter Auftraggeber.",
  },
  {
    slug: "wuppertal",
    label: "Wuppertal",
    bundesland: "Nordrhein-Westfalen",
    intro: "Wuppertal als bergische Großstadt vergeben öffentliche Aufträge insbesondere im Verkehrsbereich (Schwebebahn), in der Stadtentwicklung und bei kommunalen Infrastrukturprojekten.",
  },
  {
    slug: "bielefeld",
    label: "Bielefeld",
    bundesland: "Nordrhein-Westfalen",
    intro: "Bielefeld als Großstadt in Ostwestfalen-Lippe hat eine aktive Vergabelandschaft. Die Stadtverwaltung und städtische Betriebe vergeben Aufträge in den Bereichen Bau, IT und kommunale Dienstleistungen.",
  },
  {
    slug: "bonn",
    label: "Bonn",
    bundesland: "Nordrhein-Westfalen",
    intro: "Bonn als ehemalige Bundeshauptstadt und UNO-Standort ist ein bedeutender Vergabemarkt. Bundesbehörden, die Stadtverwaltung und internationale Organisationen vergeben regelmäßig Aufträge in verschiedenen Leistungsbereichen.",
  },
  {
    slug: "muenster",
    label: "Münster",
    bundesland: "Nordrhein-Westfalen",
    intro: "Münster als Universitäts- und Verwaltungsstadt in Westfalen vergeben öffentliche Aufträge insbesondere in den Bereichen Bildungsinfrastruktur, Stadtentwicklung und Nachhaltigkeit. Die Westfälische Wilhelms-Universität ist ein relevanter Auftraggeber.",
  },
  {
    slug: "karlsruhe",
    label: "Karlsruhe",
    bundesland: "Baden-Württemberg",
    intro: "Karlsruhe als Technologiestandort und Sitz des Bundesverfassungsgerichts hat eine aktive Vergabelandschaft. Die Stadtverwaltung, Bundesbehörden und das KIT vergeben regelmäßig Aufträge für IT, Bau und Forschungsinfrastruktur.",
  },
  {
    slug: "mannheim",
    label: "Mannheim",
    bundesland: "Baden-Württemberg",
    intro: "Mannheim als industrielle Großstadt in der Metropolregion Rhein-Neckar vergeben öffentliche Aufträge insbesondere in den Bereichen Stadtentwicklung, Hafeninfrastruktur und kommunale Dienstleistungen.",
  },
  {
    slug: "augsburg",
    label: "Augsburg",
    bundesland: "Bayern",
    intro: "Augsburg als eine der ältesten Städte Deutschlands und UNESCOWelterbe vergeben öffentliche Aufträge in den Bereichen Altstadtsanierung, kommunale Infrastruktur und Stadtentwicklung.",
  },
  {
    slug: "wiesbaden",
    label: "Wiesbaden",
    bundesland: "Hessen",
    intro: "Wiesbaden als Landeshauptstadt von Hessen ist ein bedeutender Vergabestandort. Die Landesregierung, Stadtverwaltung und Landesbetriebe vergeben regelmäßig Aufträge in verschiedenen Leistungsbereichen.",
  },
  {
    slug: "moenchengladbach",
    label: "Mönchengladbach",
    bundesland: "Nordrhein-Westfalen",
    intro: "Mönchengladbach als Großstadt am Niederrhein vergeben öffentliche Aufträge in den Bereichen Stadtentwicklung, Textilindustrie-Nachfolge und kommunale Infrastruktur.",
  },
  {
    slug: "aachen",
    label: "Aachen",
    bundesland: "Nordrhein-Westfalen",
    intro: "Aachen als Universitätsstadt und Technologiestandort vergeben öffentliche Aufträge insbesondere in den Bereichen Forschungsinfrastruktur, IT und energetische Sanierung. Die RWTH Aachen ist ein bedeutender Auftraggeber.",
  },
  {
    slug: "kiel",
    label: "Kiel",
    bundesland: "Schleswig-Holstein",
    intro: "Kiel als Landeshauptstadt von Schleswig-Holstein und Hafenstadt vergeben öffentliche Aufträge insbesondere im Küsten- und Meeresschutz, in der maritimen Wirtschaft und bei kommunalen Infrastrukturprojekten.",
  },
  {
    slug: "rostock",
    label: "Rostock",
    bundesland: "Mecklenburg-Vorpommern",
    intro: "Rostock als größte Stadt Mecklenburg-Vorpommerns und Hansestadt vergeben öffentliche Aufträge insbesondere in den Bereichen Hafeninfrastruktur, Tourismus und maritime Wirtschaft.",
  },
  {
    slug: "halle",
    label: "Halle (Saale)",
    bundesland: "Sachsen-Anhalt",
    intro: "Halle (Saale) als größte Stadt Sachsen-Anhalts vergeben öffentliche Aufträge in den Bereichen Infrastruktur, Digitalisierung und kommunale Modernisierung. Die Martin-Luther-Universität ist ein relevanter Auftraggeber.",
  },
  {
    slug: "magdeburg",
    label: "Magdeburg",
    bundesland: "Sachsen-Anhalt",
    intro: "Magdeburg als Landeshauptstadt von Sachsen-Anhalt profitiert vom Intel-Werk-Boom. Die Stadtverwaltung und Landesbetriebe vergeben regelmäßig Aufträge für Infrastrukturprojekte und kommunale Dienstleistungen.",
  },
  {
    slug: "freiburg",
    label: "Freiburg im Breisgau",
    bundesland: "Baden-Württemberg",
    intro: "Freiburg im Breisgau als Universitäts- und Sonnenstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Nachhaltigkeit, erneuerbare Energien und ökologische Stadtentwicklung.",
  },
  {
    slug: "luebeck",
    label: "Lübeck",
    bundesland: "Schleswig-Holstein",
    intro: "Lübeck als Hansestadt und UNESCO-Welterbe vergeben öffentliche Aufträge in den Bereichen Altstadterhaltung, Tourismusinfrastruktur und maritime Dienstleistungen.",
  },
  {
    slug: "erfurt",
    label: "Erfurt",
    bundesland: "Thüringen",
    intro: "Erfurt als Landeshauptstadt Thüringens vergeben öffentliche Aufträge in den Bereichen Altstadtsanierung, Verwaltungsdigitalisierung und kommunale Infrastruktur.",
  },
  {
    slug: "oberhausen",
    label: "Oberhausen",
    bundesland: "Nordrhein-Westfalen",
    intro: "Oberhausen als Stadt im Ruhrgebiet vergeben öffentliche Aufträge insbesondere in den Bereichen Stadtentwicklung, Energie und kommunale Infrastruktur.",
  },
  {
    slug: "mainz",
    label: "Mainz",
    bundesland: "Rheinland-Pfalz",
    intro: "Mainz als Landeshauptstadt von Rheinland-Pfalz und Universitätsstadt vergeben öffentliche Aufträge in den Bereichen Verwaltung, Bildung und kommunale Infrastruktur. Die Johannes Gutenberg-Universität ist ein relevanter Auftraggeber.",
  },
  {
    slug: "braunschweig",
    label: "Braunschweig",
    bundesland: "Niedersachsen",
    intro: "Braunschweig als Wissenschaftsstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Forschungsinfrastruktur, IT und energetische Sanierung. Die TU Braunschweig und das DLR sind relevante Auftraggeber.",
  },
  {
    slug: "kassel",
    label: "Kassel",
    bundesland: "Hessen",
    intro: "Kassel als documenta-Stadt vergeben öffentliche Aufträge in den Bereichen Kulturinfrastruktur, Stadtentwicklung und energetische Sanierung. Die Universität Kassel ist ein zusätzlicher relevanter Auftraggeber.",
  },
  {
    slug: "saarbruecken",
    label: "Saarbrücken",
    bundesland: "Saarland",
    intro: "Saarbrücken als Landeshauptstadt des Saarlandes vergeben öffentliche Aufträge in den Bereichen Verwaltung, IT und kommunale Infrastruktur. Als kleinste Landeshauptstadt ist die Vergabelandschaft überschaubar, aber aktiv.",
  },
  {
    slug: "potsdam",
    label: "Potsdam",
    bundesland: "Brandenburg",
    intro: "Potsdam als Landeshauptstadt Brandenburgs und UNESCO-Welterbe-Stadt vergeben öffentliche Aufträge insbesondere in den Bereichen Denkmalschutz, Verwaltung und Bildungsinfrastruktur.",
  },
  {
    slug: "oldenburg",
    label: "Oldenburg",
    bundesland: "Niedersachsen",
    intro: "Oldenburg als Universitätsstadt in Nordwestdeutschland vergeben öffentliche Aufträge in den Bereichen Bildung, Stadtentwicklung und kommunale Infrastruktur.",
  },
  {
    slug: "osnabrueck",
    label: "Osnabrück",
    bundesland: "Niedersachsen",
    intro: "Osnabrück als Friedensstadt und Universitätsstadt vergeben öffentliche Aufträge in den Bereichen Bildungsinfrastruktur, Stadtentwicklung und kommunale Dienstleistungen.",
  },
  {
    slug: "heidelberg",
    label: "Heidelberg",
    bundesland: "Baden-Württemberg",
    intro: "Heidelberg als Universitäts- und Wissenschaftsstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Forschungsinfrastruktur, IT und Altstadtsanierung. Die Ruprecht-Karls-Universität ist ein bedeutender Auftraggeber.",
  },
  {
    slug: "darmstadt",
    label: "Darmstadt",
    bundesland: "Hessen",
    intro: "Darmstadt als Wissenschaftsstadt und Standort der ESOC vergeben öffentliche Aufträge insbesondere in den Bereichen IT-Sicherheit, Forschung und Digitalisierung.",
  },
  {
    slug: "regensburg",
    label: "Regensburg",
    bundesland: "Bayern",
    intro: "Regensburg als UNESCO-Welterbe-Stadt und Universitätsstadt vergeben öffentliche Aufträge in den Bereichen Altstadterhaltung, Bildung und kommunale Infrastruktur.",
  },
  {
    slug: "ingolstadt",
    label: "Ingolstadt",
    bundesland: "Bayern",
    intro: "Ingolstadt als Industriestandort und Universitätsstadt vergeben öffentliche Aufträge in den Bereichen Verkehr, Bildung und kommunale Infrastruktur.",
  },
  {
    slug: "wuerzburg",
    label: "Würzburg",
    bundesland: "Bayern",
    intro: "Würzburg als Universitäts- und Weinstadt vergeben öffentliche Aufträge in den Bereichen Bildungsinfrastruktur, Denkmalschutz und kommunale Dienstleistungen.",
  },
  {
    slug: "cottbus",
    label: "Cottbus",
    bundesland: "Brandenburg",
    intro: "Cottbus als zweitgrößte Stadt Brandenburgs vergeben öffentliche Aufträge insbesondere in den Bereichen Strukturwandel, Energie und Stadtentwicklung.",
  },
  {
    slug: "erlangen",
    label: "Erlangen",
    bundesland: "Bayern",
    intro: "Erlangen als Siemens-Standort und Universitätsstadt vergeben öffentliche Aufträge in den Bereichen Technologie, Forschung und kommunale Infrastruktur.",
  },
  {
    slug: "tuebingen",
    label: "Tübingen",
    bundesland: "Baden-Württemberg",
    intro: "Tübingen als Universitätsstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Bildung, Nachhaltigkeit und kommunale Infrastruktur. Die Eberhard Karls Universität ist ein relevanter Auftraggeber.",
  },
  {
    slug: "jena",
    label: "Jena",
    bundesland: "Thüringen",
    intro: "Jena als Optik- und Universitätsstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Forschung, Technologie und Stadtentwicklung. Die Friedrich-Schiller-Universität und das Fraunhofer IOF sind relevante Auftraggeber.",
  },
  {
    slug: "gottingen",
    label: "Göttingen",
    bundesland: "Niedersachsen",
    intro: "Göttingen als Wissenschaftsstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Forschungsinfrastruktur, Bildung und kommunale Dienstleistungen. Die Georg-August-Universität ist ein bedeutender Auftraggeber.",
  },
  {
    slug: "schwerin",
    label: "Schwerin",
    bundesland: "Mecklenburg-Vorpommern",
    intro: "Schwerin als Landeshauptstadt von Mecklenburg-Vorpommern vergeben öffentliche Aufträge in den Bereichen Verwaltung, Denkmalschutz (Schloss) und kommunale Infrastruktur.",
  },
  {
    slug: "chemnitz",
    label: "Chemnitz",
    bundesland: "Sachsen",
    intro: "Chemnitz als Industriestandort und Kulturhauptstadt vergeben öffentliche Aufträge insbesondere in den Bereichen Stadtentwicklung, Industriekultur und kommunale Infrastruktur.",
  },
  {
    slug: "hildesheim",
    label: "Hildesheim",
    bundesland: "Niedersachsen",
    intro: "Hildesheim als UNESCO-Welterbe-Stadt vergeben öffentliche Aufträge in den Bereichen Denkmalschutz, Bildung und kommunale Infrastruktur.",
  },
  {
    slug: "bayreuth",
    label: "Bayreuth",
    bundesland: "Bayern",
    intro: "Bayreuth als Universitäts- und Festspielstadt vergeben öffentliche Aufträge in den Bereichen Kulturinfrastruktur, Bildung und kommunale Dienstleistungen.",
  },
  {
    slug: "wolfsburg",
    label: "Wolfsburg",
    bundesland: "Niedersachsen",
    intro: "Wolfsburg als Industriestandort vergeben öffentliche Aufträge insbesondere in den Bereichen Stadtentwicklung, Mobilität und kommunale Infrastruktur.",
  },
];

// SEO: Generate FAQPage JSON-LD data for city landing pages from existing city metadata.
// Avoids manually maintaining 150 FAQ entries — derives unique Q&A per city from CityEntry fields.
export function generateCityFaq(city: CityEntry): Array<{ question: string; answer: string }> {
  const authorities = city.procurementAuthorities && city.procurementAuthorities.length > 0
    ? city.procurementAuthorities.join(", ")
    : `die Stadtverwaltung ${city.label}, kommunale Betriebe und das ${city.bundesland}`;

  return [
    {
      question: `Wo finde ich Ausschreibungen in ${city.label}?`,
      answer: `Ausschreibungen in ${city.label} werden über die Vergabeportale DTVP, TED und evergabe veröffentlicht. Tenderhunter aggregiert alle Quellen automatisch und zeigt Ihnen passende Ergebnisse für ${city.label} und Umgebung.`,
    },
    {
      question: `Welche Vergabestellen gibt es in ${city.label}?`,
      answer: `Die wichtigsten Vergabestellen in ${city.label} sind ${authorities}. Diese Institutionen schreiben regelmäßig öffentliche Aufträge in verschiedenen Leistungsbereichen aus.`,
    },
    {
      question: `Wie oft werden neue Ausschreibungen in ${city.label} veröffentlicht?`,
      answer: `In ${city.label} werden täglich neue Ausschreibungen veröffentlicht. Tenderhunter aktualisiert die Datenbank kontinuierlich und benachrichtigt Sie über passende neue Vergaben per E-Mail.`,
    },
  ];
}

// Lookup maps for efficient access
export const CITY_SLUG_MAP: Record<string, CityEntry> = Object.fromEntries(
  CITIES.map((city) => [city.slug, city]),
);

export const ALL_CITY_SLUGS = CITIES.map((c) => c.slug);

export const CITY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CITIES.map((city) => [city.slug, city.label]),
);
