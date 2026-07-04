// SEO: Redaktionelle Inhalte für Bundesland-Landingpages.
// Analog zu category-content.ts — liefert Tips, Requirements und FAQs pro Bundesland,
// um FAQPage JSON-LD zu generieren und die Seiten mit nutzlichem Content anzureichern.

export interface BundeslandContent {
  tips: string[];
  requirements: string[];
  faq: Array<{ question: string; answer: string }>;
}

export const BUNDESLAND_CONTENT: Record<string, BundeslandContent> = {
  "Baden-Württemberg": {
    tips: [
      "Die L-Bank und das Landesvergaberecht Baden-Württemberg haben eigene Schwellenwerte — prüfen Sie, ob Ihre Ausschreibung unter die Landes- oder Bundesvergabeordnung fällt.",
      "Stuttgart, Karlsruhe und Mannheim sind die vergabestärksten Städte — konzentrieren Sie Ihre Bietersuche auf diese Ballungsräume.",
      "Baden-Württemberg legt großen Wert auf Nachhaltigkeit bei öffentlichen Aufträgen — dokumentieren Sie Umweltmanagement-Zertifikate (ISO 14001) in Ihren Eignungsunterlagen.",
    ],
    requirements: [
      "Eintragung im Handelsregister oder Gewerbeanmeldung mit Sitz oder Niederlassung in Deutschland",
      "Berufshaftpflichtversicherung mit branchenüblicher Deckungssumme",
      "Referenzen vergleichbarer Projekte aus den letzten 3–5 Jahren",
      "Unbedenklichkeitsbescheinigungen von Finanzamt und Krankenkasse",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Baden-Württemberg?",
        answer: "Ausschreibungen in Baden-Württemberg finden Sie auf den Portalen DTVP, TED, evergabe sowie über die Vergabestellen der Kommunen und des Landes. Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Welche Auftraggeber schreiben in Baden-Württemberg am häufigsten aus?",
        answer: "Die aktivsten Auftraggeber in Baden-Württemberg sind das Land, die Städte Stuttgart, Karlsruhe und Mannheim, Universitäten wie die Universität Stuttgart sowie Landesbetriebe und kommunale Unternehmen.",
      },
      {
        question: "Gibt es besondere Vergaberegeln in Baden-Württemberg?",
        answer: "Baden-Württemberg hat seit 2024 ein eigenes Landesvergabegesetz (LVerG BW) für Unterschwellenvergaben. Oberhalb der EU-Schwellenwerte gelten die bundesweiten Regelungen (VgV, VOB/A).",
      },
    ],
  },
  Bayern: {
    tips: [
      "Bayern hat mit dem BayVgG ein eigenes Vergabegesetz — beachten Sie die Besonderheiten bei der Nachprüfungsinstanz (Bayerische Vergabekammer).",
      "Die Städte München, Nürnberg und Augsburg haben die höchste Vergabedichte — nutzen Sie die Stadt×Kategorie-Filter für gezielte Suchen.",
      "Bei Bauaufträgen in Bayern gelten oft zusätzliche Anforderungen an die Bayerische Bauordnung — prüfen Sie die Leistungsbeschreibung auf landespezifische Normen.",
    ],
    requirements: [
      "Eintragung in die Handwerksrolle oder das Handelsregister",
      "Berufshaftpflichtversicherung (Höhe je nach Auftragsart)",
      "Referenzprojekte vergleichbarer Art und Größe",
      "PQ-VOLK-Zertifikat wird bei vielen bayerischen Kommunen gefordert",
    ],
    faq: [
      {
        question: "Wie finde ich Ausschreibungen in Bayern?",
        answer: "Ausschreibungen in Bayern werden über DTVP, TED, evergabe und das Bayerische Vergabeportal veröffentlicht. Tenderhunter durchsucht alle Portale automatisch und zeigt passende Ergebnisse für Ihr Unternehmen.",
      },
      {
        question: "Welche Bereiche werden in Bayern besonders häufig ausgeschrieben?",
        answer: "In Bayern werden besonders häufig Bauarbeiten, IT-Dienstleistungen (Digitalisierung der Verwaltung), Facility Management und energietechnische Sanierungen ausgeschrieben.",
      },
      {
        question: "Gibt es Förderprogramme für Bieter in Bayern?",
        answer: "Das Bayerische Wirtschaftsministerium bietet über die IHK-Netzwerke Beratung für KMU bei öffentlichen Ausschreibungen. Die BayernLB und die LfA Förderbank Bayern unterstützen bei der Finanzierung größerer Projekte.",
      },
    ],
  },
  Berlin: {
    tips: [
      "Berlin ist als Stadtstaat einer der größten öffentlichen Auftraggeber — die Senatsverwaltungen und 12 Bezirke vergeben getrennt voneinander.",
      "Die Berliner Digitalisierungsstrategie treibt IT-Ausschreibungen stark voran — besonders BSI-Grundschutz und Cloud-Infrastruktur sind gefragt.",
      "Bei Bauaufträgen in Berlin gelten besondere Anforderungen an den Denkmalschutz — prüfen Sie, ob das Objekt in einem Sanierungsgebiet liegt.",
    ],
    requirements: [
      "Gewerbeanmeldung mit Sitz in Deutschland (Berlin-Sitz ist kein Muss, aber vorteilhaft)",
      "Berufshaftpflichtversicherung mit ausreichender Deckung",
      "Referenzen aus vergleichbaren öffentlichen Projekten",
      "Sicherheitsüberprüfung des Personals bei Aufträgen für Bundesbehörden",
    ],
    faq: [
      {
        question: "Wo werden Berliner Ausschreibungen veröffentlicht?",
        answer: "Berliner Ausschreibungen erscheinen auf DTVP, TED, evergabe sowie auf der Seite der Senatsverwaltung für Finanzen. Tenderhunter aggregiert alle Berliner Quellen automatisch.",
      },
      {
        question: "Welche Bezirke in Berlin schreiben am häufigsten aus?",
        answer: "Die vergabestärksten Berliner Bezirke sind Mitte, Charlottenburg-Wilmersdorf und Friedrichshain-Kreuzberg. Die Senatsverwaltungen sind als Landesebene die größten Auftraggeber.",
      },
      {
        question: "Gibt es Besonderheiten bei Berliner IT-Ausschreibungen?",
        answer: "Ja, Berliner IT-Ausschreibungen fordern häufig BSI-Grundschutz-Kompatibilität und die Einhaltung der Berliner Open-Data-Strategie. Cloud-Lösungen müssen oft auf deutschen Servern gehostet werden.",
      },
    ],
  },
  Brandenburg: {
    tips: [
      "Brandenburg profitiert von der Nähe zu Berlin — viele Ausschreibungen betreffen Infrastrukturprojekte im Berliner Umland.",
      "Die Energiestrategie Brandenburg treibt Ausschreibungen für erneuerbare Energien und Netzausbau voran.",
      "Ländliche Kommunen in Brandenburg vergeben oft kleinere Lose — auch für KMU interessant.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Energieprojekten: Nachweis technischer Qualifikation",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Brandenburg?",
        answer: "Brandenburgische Ausschreibungen finden Sie auf DTVP, TED, evergabe und dem Vergabeportal des Landes Brandenburg. Tenderhunter durchsucht automatisch alle diese Quellen.",
      },
      {
        question: "Welche Branchen sind in Brandenburg besonders aktiv?",
        answer: "In Brandenburg werden besonders häufig Infrastrukturprojekte (Straßen, Brücken), erneuerbare Energien, Tourismus-Infrastruktur und kommunale Grundversorgung ausgeschrieben.",
      },
      {
        question: "Gibt es Förderungen für Bieter in Brandenburg?",
        answer: "Das Land Brandenburg unterstützt KMU über die ILB (Investitionsbank des Landes Brandenburg) mit Beratungs- und Förderprogrammen für öffentliche Aufträge.",
      },
    ],
  },
  Bremen: {
    tips: [
      "Bremen und Bremerhaven vergeben als Stadtstaaten gemeinsam Ausschreibungen — achten Sie auf den richtigen Bezirk in der Leistungsbeschreibung.",
      "Der Hafenbereich ist ein Schwerpunkt der Vergabetätigkeit — Logistik und maritime Dienstleistungen sind stark nachgefragt.",
      "Die Hansestadt Bremen bevorzugt nachhaltige Beschaffung — Umweltzertifikate sind oft ein Zuschlagskriterium.",
    ],
    requirements: [
      "Gewerbeanmeldung mit Sitz in Deutschland",
      "Berufshaftpflichtversicherung",
      "Referenzen aus vergleichbaren Projekten",
      "Bei Hafenaufträgen: spezielle Sicherheitsnachweise",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Bremen?",
        answer: "Bremer Ausschreibungen werden auf DTVP, TED, evergabe sowie dem Vergabeportal der Freien Hansestadt Bremen veröffentlicht. Tenderhunter aggregiert diese automatisch.",
      },
      {
        question: "Was wird in Bremen besonders häufig ausgeschrieben?",
        answer: "In Bremen werden besonders häufig Logistik- und Hafenaufträge, maritime Dienstleistungen, Facility Management und kommunale Infrastrukturprojekte ausgeschrieben.",
      },
      {
        question: "Gibt es Besonderheiten bei Bremer Vergaben?",
        answer: "Ja, als Stadtstaat gelten in Bremen teils andere Schwellenwerte als in Flächenländern. Die Vergabestelle des Zentralen Beschaffungsamtes ist der zentrale Ansprechpartner.",
      },
    ],
  },
  Hamburg: {
    tips: [
      "Hamburg ist als Hafenstadtstaat ein bedeutender Vergabemarkt mit Schwerpunkt auf Logistik, IT und Bau.",
      "Die Hamburger Verkehrsverbund (HVV) und Hamburg Port Authority (HPA) sind zusätzliche große Auftraggeber neben der Stadtverwaltung.",
      "Hamburg bevorzugt agile Vergabemodelle bei IT-Projekten — SCRUM und Kanban-Kompetenz werden zunehmend gefordert.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung mit angemessener Deckung",
      "Referenzen vergleichbarer Projekte",
      "Bei IT-Aufträgen: BSI-Grundschutz oder ISO 27001",
    ],
    faq: [
      {
        question: "Wo werden Hamburger Ausschreibungen veröffentlicht?",
        answer: "Hamburger Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal der Freien und Hansestadt Hamburg. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Welche Auftraggeber sind in Hamburg besonders aktiv?",
        answer: "Die aktivsten Hamburger Auftraggeber sind die Stadtverwaltung, die HPA, der HVV, die Hamburg-Energie und das Universitätsklinikum Hamburg-Eppendorf (UKE).",
      },
      {
        question: "Gibt es Hafen-spezifische Ausschreibungen in Hamburg?",
        answer: "Ja, die Hamburg Port Authority vergibt regelmäßig Aufträge für Hafeninfrastruktur, Kaianlagen, Schifffahrtsdienste und Logistik. Diese erscheinen meist auf DTVP und TED.",
      },
    ],
  },
  Hessen: {
    tips: [
      "Hessen mit der Finanzmetropole Frankfurt am Main ist ein hochaktiver Vergabemarkt — IT-Sicherheit und Digitalisierung sind besonders gefragt.",
      "Die Landeshauptstadt Wiesbaden und Frankfurt vergeben getrennt voneinander — prüfen Sie beide Vergabestellen.",
      "Hessen legt Wert auf energetische Sanierung — GEG-Konformität ist bei Bauvergaben Standard.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei IT-Aufträgen: ISO 27001 oder BSI-Grundschutz",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Hessen?",
        answer: "Hessische Ausschreibungen erscheinen auf DTVP, TED, evergabe sowie dem e-Vergabeportal des Landes Hessen. Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Welche Branchen sind in Hessen besonders aktiv?",
        answer: "In Hessen werden besonders häufig IT-Dienstleistungen (Finanzsektor), Bauleistungen, energetische Gebäudesanierung und Facility Management ausgeschrieben.",
      },
      {
        question: "Gibt es Besonderheiten bei Frankfurter Ausschreibungen?",
        answer: "Ja, Frankfurt am Main hat als Finanzzentrum erhöhte Anforderungen an IT-Sicherheit und Datenschutz. Viele Ausschreibungen richten sich an spezialisierte IT-Dienstleister.",
      },
    ],
  },
  "Mecklenburg-Vorpommern": {
    tips: [
      "Mecklenburg-Vorpommern vergeben öffentliche Aufträge vor allem im Küstenschutz, Tourismus und in der ländlichen Entwicklung.",
      "Rostock und Schwerin sind die wichtigsten Vergabestandorte — die anderen Kommunen vergeben oft kleinere Lose.",
      "Bei Küstenschutzprojekten gelten besondere technische Anforderungen — prüfen Sie die DIN-Normen für Wasserbau.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Küstenschutz: Fachkundenachweis Wasserbau",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Mecklenburg-Vorpommern?",
        answer: "Ausschreibungen aus Mecklenburg-Vorpommern finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Landes. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Was wird in Mecklenburg-Vorpommern besonders häufig ausgeschrieben?",
        answer: "Besonders häufig werden Küstenschutzprojekte, Tourismus-Infrastruktur, ländliche Entwicklung und kommunale Grundversorgung ausgeschrieben.",
      },
      {
        question: "Gibt es Förderprogramme für Bieter in Mecklenburg-Vorpommern?",
        answer: "Die Investitionsbank Mecklenburg-Vorpommern (IB MV) fördert Unternehmen bei öffentlichen Aufträgen, besonders im Bereich erneuerbare Energien und ländliche Entwicklung.",
      },
    ],
  },
  Niedersachsen: {
    tips: [
      "Niedersachsen als zweitgrößtes Bundesland hat eine vielfältige Vergabelandschaft — von der Landwirtschaft bis zur Automobilindustrie.",
      "Hannover, Braunschweig und Oldenburg sind die vergabestärksten Städte — nutzen Sie die Stadt-Filter für gezielte Suchen.",
      "Niedersachsen hat seit 2024 ein eigenes Vergabegesetz (NVgG) — beachten Sie die Besonderheiten bei Unterschwellenvergaben.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "PQ-VOLK-Zertifikat wird bei vielen niedersächsischen Kommunen gefordert",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Niedersachsen?",
        answer: "Niedersächsische Ausschreibungen erscheinen auf DTVP, TED, evergabe sowie dem Niedersächsischen Vergabeportal (NVP). Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Welche Branchen sind in Niedersachsen besonders aktiv?",
        answer: "In Niedersachsen werden besonders häufig Bauleistungen, IT-Dienstleistungen, Lieferaufträge (insb. Automobilzulieferer) und Landwirtschaftsprojekte ausgeschrieben.",
      },
      {
        question: "Gibt es Besonderheiten bei niedersächsischen Vergaben?",
        answer: "Ja, Niedersachsen hat mit dem NVgG eigene Vergaberegeln für Unterschwellenvergaben. Die Vergabekammer Niedersachsen ist zuständig für Nachprüfungsverfahren.",
      },
    ],
  },
  "Nordrhein-Westfalen": {
    tips: [
      "NRW ist das bevölkerungsreichste Bundesland und damit der größte Vergabemarkt — Köln, Düsseldorf, Dortmund und Essen sind die Hotspots.",
      "NRW nutzt verstärkt evergabe.nrw.de für elektronische Vergaben — registrieren Sie sich auf dieser Plattform.",
      "Die Metropole Ruhr vergibt besonders viele Aufträge im Bereich Stadtentwicklung und Strukturwandel.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung mit angemessener Deckung",
      "Referenzen vergleichbarer Projekte",
      "Registrierung auf evergabe.nrw.de für elektronische Submissionen",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Nordrhein-Westfalen?",
        answer: "NRW-Ausschreibungen finden Sie auf DTVP, TED, evergabe, evergabe.nrw.de sowie den Vergabeportalen der Kommunen. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Welche Städte in NRW schreiben am häufigsten aus?",
        answer: "Die vergabestärksten Städte in NRW sind Köln, Düsseldorf, Dortmund, Essen und Duisburg. Die Metropole Ruhr hat insgesamt ein besonders hohes Vergabevolumen.",
      },
      {
        question: "Was ist evergabe.nrw.de?",
        answer: "evergabe.nrw.de ist die zentrale elektronische Vergabeplattform des Landes NRW. Hier werden Vergabebekanntmachungen veröffentlicht und Angebote digital eingereicht.",
      },
    ],
  },
  "Rheinland-Pfalz": {
    tips: [
      "Rheinland-Pfalz vergeben öffentliche Aufträge überwiegend in den Bereichen Weinbau-Infrastruktur, Tourismus und Kommunalbau.",
      "Mainz, Koblenz und Ludwigshafen sind die wichtigsten Vergabezentren.",
      "Das Landesvergabegesetz Rheinland-Pfalz (LVO RP) gilt für Unterschwellenvergaben — prüfen Sie die Schwellenwerte.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Weinbauprojekten: Fachkundenachweis",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Rheinland-Pfalz?",
        answer: "Ausschreibungen aus Rheinland-Pfalz finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Landes. Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Was wird in Rheinland-Pfalz besonders häufig ausgeschrieben?",
        answer: "Besonders häufig werden Weinbau-Infrastruktur, Tourismusprojekte, Kommunalbau und IT-Modernisierung ausgeschrieben.",
      },
      {
        question: "Gibt es Besonderheiten bei rheinland-pfälzischen Vergaben?",
        answer: "Ja, Rheinland-Pfalz hat eigene Vergaberegeln (LVO RP) für Unterschwellenvergaben. Die Vergabekammer Rheinland-Pfalz ist zuständig für Nachprüfungsverfahren.",
      },
    ],
  },
  Saarland: {
    tips: [
      "Das Saarland als kleinstes Flächenbundesland hat eine überschaubare, aber aktive Vergabelandschaft.",
      "Saarbrücken und die Landesverwaltung vergeben regelmäßig Aufträge — die Konzentration auf wenige Auftraggeber erleichtert die Marktbeobachtung.",
      "Grenzüberschreitende Vergaben mit Frankreich sind im Saarland häufiger — prüfen Sie, ob EU-Vergaberegeln gelten.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei grenzüberschreitenden Aufträgen: Kenntnis der EU-Vergaberichtlinien",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen im Saarland?",
        answer: "Saarländische Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Saarlandes. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Was wird im Saarland besonders häufig ausgeschrieben?",
        answer: "Im Saarland werden besonders häufig Bauarbeiten, IT-Dienstleistungen und kommunale Infrastrukturprojekte ausgeschrieben.",
      },
      {
        question: "Gibt es Besonderheiten bei saarländischen Vergaben?",
        answer: "Das Saarland hat als kleinstes Flächenbundesland eine besonders überschaubare Vergabelandschaft. Grenzüberschreitende Vergaben mit Frankreich sind häufiger als in anderen Bundesländern.",
      },
    ],
  },
  Sachsen: {
    tips: [
      "Sachsen profitiert vom wirtschaftlichen Aufschwung in Dresden, Leipzig und Chemnitz — die Vergabeaktivität steigt kontinuierlich.",
      "Infrastrukturprojekte und Digitalisierung der Verwaltung sind die wichtigsten Vergabeschwerpunkte.",
      "Die Sächsische Aufbaubank (SAB) fördert Unternehmen bei öffentlichen Aufträgen im Bereich Energie und Digitalisierung.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Digitalisierungsprojekten: BSI-Grundschutz oder ISO 27001",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Sachsen?",
        answer: "Sächsische Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Freistaates Sachsen. Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Welche Städte in Sachsen schreiben am häufigsten aus?",
        answer: "Die vergabestärksten sächsischen Städte sind Dresden, Leipzig und Chemnitz. Der Freistaat Sachsen selbst ist ebenfalls ein großer Auftraggeber.",
      },
      {
        question: "Gibt es Förderprogramme für Bieter in Sachsen?",
        answer: "Die Sächsische Aufbaubank (SAB) fördert Unternehmen bei öffentlichen Aufträgen, besonders im Bereich erneuerbare Energien und Digitalisierung.",
      },
    ],
  },
  "Sachsen-Anhalt": {
    tips: [
      "Sachsen-Anhalt vergeben öffentliche Aufträge vor allem in den Bereichen Infrastruktur, Landwirtschaft und kommunale Daseinsvorsorge.",
      "Magdeburg und Halle (Saale) sind die wichtigsten Vergabestandorte.",
      "Das Intel-Werk in Magdeburg treibt die Vergabeaktivität in der Region stark voran.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Infrastrukturprojekten: Fachkundenachweis",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Sachsen-Anhalt?",
        answer: "Ausschreibungen aus Sachsen-Anhalt finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Landes. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Was wird in Sachsen-Anhalt besonders häufig ausgeschrieben?",
        answer: "Besonders häufig werden Infrastrukturprojekte, Landwirtschaftsprojekte und kommunale Daseinsvorsorge ausgeschrieben.",
      },
      {
        question: "Welche Auswirkungen hat das Intel-Werk auf die Vergabeaktivität?",
        answer: "Das Intel-Werk in Magdeburg treibt die Vergabeaktivität in der Region stark voran — sowohl direkt (Zuliefereraufträge) als auch indirekt (Infrastruktur, Wohnbau, Dienstleistungen).",
      },
    ],
  },
  "Schleswig-Holstein": {
    tips: [
      "Schleswig-Holstein vergeben öffentliche Aufträge insbesondere im Küsten- und Meeresschutz sowie in der Tourismusinfrastruktur.",
      "Kiel, Lübeck und Flensburg sind die zentralen Vergabestädte.",
      "Windenergie-Projekte sind ein wichtiges Vergabefeld — Offshore- und Onshore-Windparks werden regelmäßig ausgeschrieben.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Windenergie: Fachkundenachweis und Sicherheitszertifikate",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Schleswig-Holstein?",
        answer: "Schleswig-holsteinische Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Landes. Tenderhunter aggregiert alle Quellen automatisch.",
      },
      {
        question: "Was wird in Schleswig-Holstein besonders häufig ausgeschrieben?",
        answer: "Besonders häufig werden Küsten- und Meeresschutzprojekte, Tourismusinfrastruktur, Windenergie und Landwirtschaft ausgeschrieben.",
      },
      {
        question: "Gibt es Offshore-Windenergie-Ausschreibungen in Schleswig-Holstein?",
        answer: "Ja, Schleswig-Holstein ist ein führendes Bundesland bei Windenergie. Offshore-Ausschreibungen erscheinen meist auf TED, Onshore-Projekte auf den Landesportalen.",
      },
    ],
  },
  Thüringen: {
    tips: [
      "Thüringen vergeben öffentliche Aufträge vor allem in den Bereichen Infrastruktur, Tourismus und kommunale Modernisierung.",
      "Erfurt, Jena und Weimar sind die wichtigsten Vergabestandorte mit wachsender Digitalisierungsaktivität.",
      "Die Thüringer Aufbaubank (TAB) fördert Unternehmen bei öffentlichen Aufträgen im Bereich Digitalisierung und Energie.",
    ],
    requirements: [
      "Gewerbeanmeldung oder Handelsregistereintragung",
      "Berufshaftpflichtversicherung",
      "Referenzen vergleichbarer Projekte",
      "Bei Digitalisierungsprojekten: BSI-Grundschutz oder ISO 27001",
    ],
    faq: [
      {
        question: "Wo finde ich Ausschreibungen in Thüringen?",
        answer: "Thüringer Ausschreibungen finden Sie auf DTVP, TED, evergabe sowie dem Vergabeportal des Freistaates Thüringen. Tenderhunter durchsucht automatisch alle Quellen.",
      },
      {
        question: "Welche Städte in Thüringen schreiben am häufigsten aus?",
        answer: "Die vergabestärksten thüringischen Städte sind Erfurt, Jena und Weimar. Der Freistaat Thüringen selbst ist ebenfalls ein großer Auftraggeber.",
      },
      {
        question: "Gibt es Förderprogramme für Bieter in Thüringen?",
        answer: "Die Thüringer Aufbaubank (TAB) fördert Unternehmen bei öffentlichen Aufträgen, besonders im Bereich Digitalisierung und erneuerbare Energien.",
      },
    ],
  },
};
