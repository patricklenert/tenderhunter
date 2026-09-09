// SEO: Branche-Profile — deep, industry-specific context for public procurement niches
// Target: "tiefbau ausschreibungen", "it dienstleistungen vergabe", "gebäudereinigung öffentliche aufträge" etc.
// Each profile is GENUINELY DIFFERENT — not name-swapping. Industry-specific CPV codes, Eignungskriterien, Besonderheiten.

export interface BrancheEntry {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  cpvCodes: Array<{ code: string; label: string }>;
  typischeVerfahren: string[];
  schwellenwert: string;
  eignungskriterien: string[];
  besonderheiten: string[];
  saison?: string;
  faq: Array<{ question: string; answer: string }>;
  relatedCategories: string[];
}

export const BRANCHEN: BrancheEntry[] = [
  {
    slug: "tiefbau-infrastruktur",
    name: "Tiefbau & Infrastruktur",
    metaTitle: "Tiefbau & Infrastruktur Ausschreibungen – Öffentliche Aufträge für Straßen, Kanal, Leitungsbau",
    metaDescription:
      "Öffentliche Ausschreibungen für Tiefbau und Infrastruktur: Straßenbau, Kanalisation, Leitungsbau, Brückenbau. CPV-Codes, Verfahren, Eignungskriterien und Besonderheiten der Tiefbauvergabe.",
    intro: [
      "Der Tiefbau ist einer der umsatzstärksten Bereiche der öffentlichen Vergabe in Deutschland. Straßen-, Wege- und Kanalbau, aber auch Leitungsbau für Wasser, Gas, Strom und Telekommunikation werden fast ausschließlich öffentlich vergeben — von Bund, Ländern, Kommunen und Versorgern.",
      "Charakteristisch für den Tiefbau sind große Auftragsvolumina, lange Projektlaufzeiten und hohe Anforderungen an die technische Eignung. Viele Vergaben erfolgen als Generalunternehmer-Verträge mit komplexen Leistungsbeschreibungen nach VOB/StLB.",
      "Die Vergabe erfolgt meist als offenes Verfahren oberhalb der EU-Schwellenwerte. Präqualifikation (PQ-VOL V) ist Standard, die VOB Vergabe- und Vertragsordnung ist die maßgebliche Rechtsgrundlage.",
    ],
    cpvCodes: [
      { code: "45200000", label: "Bauarbeiten, Hoch- und Tiefbau" },
      { code: "45230000", label: "Bauarbeiten für Leitungen, Fernmelde- und Stromleitungen" },
      { code: "45233000", label: "Bauarbeiten für Wasser- und Abwasserleitungen" },
      { code: "45233140", label: "Kanalbauarbeiten" },
      { code: "45233200", label: "Bauarbeiten für Wasser- und Abwasserbehandlung" },
      { code: "45233141", label: "Bau von Abwasserkanälen" },
    ],
    typischeVerfahren: ["Offenes Verfahren (VgV)", "Verhandlungsverfahren bei komplexen GU-Verträgen"],
    schwellenwert: "5.404.000 € (EU-Schwellenwert für Bauaufträge 2026/2027) — darunter VOB/A Abschnitt 1 und anwendbares Landes-/Haushaltsrecht",
    eignungskriterien: [
      "Präqualifikation nach PQ-VOL V (in der Regel erforderlich)",
      "Referenzen vergleichbarer Größenordnung (mind. 2 Referenzen der letzten 3 Jahre)",
      "Nachweis Fachkunde: Bauleiter mit entsprechendem Qualifikationsnachweis",
      "Nachweis Leistungsfähigkeit: Maschinenpark, Personalstärke, Jahresumsatz",
      "Berufsgenossenschafts-Bescheinigung und Steuernachweise",
      "Eigenerklärung zur Zuverlässigkeit (keine Eintragung im Gewerbezentralregister)",
    ],
    besonderheiten: [
      "VOB Teil A und Teil B sind verbindlich — Abweichungen von der VOB müssen explizit vereinbart werden",
      "Leistungsbeschreibung mit Standardleistungsbeschreibung für das Bauwesen (StLB) ist häufig",
      "Sicherheitsleistung: 5 % Vertragssicherheit und 2 % Gewährleistungssicherheit sind üblich",
      "Bauhandwerkersicherungshypothek nach § 648a BGB bei Bauvorhaben > 500.000 €",
      "GAEB-Austausch ist Standard — Angebote meist im D83- oder X83-Format einzureichen",
      "Bauzeitenplan und Baustelleneinrichtung sind oft Vertragsbestandteil",
    ],
    saison: "Hauptsaison April bis Oktober (witterungsabhängig)",
    faq: [
      {
        question: "Brauche ich eine Präqualifikation für Tiefbauausschreibungen?",
        answer:
          "Die Präqualifikation nach PQ-VOL V ist nicht gesetzlich vorgeschrieben, wird aber von den meisten öffentlichen Auftraggebern als Eignungsnachweis akzeptiert und beschleunigt das Verfahren erheblich. Ohne PQ müssen Sie alle Eignungsnachweise individuell für jede Vergabe erbringen.",
      },
      {
        question: "Was ist der Unterschied zwischen VOB und VgV beim Tiefbau?",
        answer:
          "Die VOB (Vergabe- und Vertragsordnung für Bauleistungen) regelt die Durchführung der Vergabe und die Vertragsbedingungen für Bauleistungen. Das VgV (Vergabeverordnung) regelt das Vergabeverfahren oberhalb der EU-Schwellenwerte. Beide greifen ineinander: oberhalb 5,538 Mio. € gilt VgV + VOB, darunter UVgO + VOB.",
      },
      {
        question: "Wie finde ich Tiefbauausschreibungen in meiner Region?",
        answer:
          "Tiefbauausschreibungen werden überregional im TED (EU-Schwellenwert) und in dtvp / evergabe veröffentlicht. Regionale Vergaben finden sich auf den Vergabeportalen der Bundesländer und Kommunen. Tenderhunter aggregiert alle Quellen und filtert nach CPV-Codes für Tiefbau.",
      },
    ],
    relatedCategories: ["Tiefbau", "Bauarbeiten"],
  },
  {
    slug: "hochbau",
    name: "Hochbau",
    metaTitle: "Hochbau Ausschreibungen – Öffentliche Bauaufträge für Gebäude, Schlüsselbau, Sanierung",
    metaDescription:
      "Öffentliche Ausschreibungen für Hochbau: Neubau, Sanierung, Schlüsselbau, Fassade, Dach. CPV-Codes, Verfahren, Eignungskriterien und Besonderheiten der Hochbauvergabe.",
    intro: [
      "Der Hochbau umfasst die Errichtung, Sanierung und Instandhaltung von Gebäuden aller Art — von Schulen und Verwaltungsgebäuden über Krankenhäuser bis zu Wohngebäuden. Öffentliche Auftraggeber vergeben Hochbauaufträge nach VOB und VgV, bei Sanierungen oft als Generalunternehmer-Vertrag.",
      "Die Besonderheit des Hochbaus liegt in der Komplexität: Viele Gewerke (Rohbau, Fassade, Dach, Ausbau) müssen koordiniert werden. Häufig werden Generalunternehmer beauftragt, die die Gesamtverantwortung tragen.",
      "Schlüsselfertigbau-Vergaben nach VgV sind verbreitet — hier bietet der Generalunternehmer ein Komplettpaket aus Bau und Technik an.",
    ],
    cpvCodes: [
      { code: "45210000", label: "Bauwerke, Hochbau" },
      { code: "45211100", label: "Wohnungsbau" },
      { code: "45213250", label: "Schulgebäude" },
      { code: "45210000", label: "Bauwerke" },
      { code: "45262520", label: "Fassadenarbeiten" },
      { code: "45261000", label: "Dachdeckungs- und Dachabdichtungsarbeiten" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Verhandlungsverfahren bei GU/Schlüsselfertig"],
    schwellenwert: "5.404.000 € (EU-Schwellenwert für Bauaufträge 2026/2027) — darunter VOB/A Abschnitt 1 und anwendbares Landes-/Haushaltsrecht",
    eignungskriterien: [
      "Präqualifikation nach PQ-VOL V empfohlen",
      "Referenzen aus vergleichbaren Bauvorhaben (Schule, Verwaltung, Krankenhaus)",
      "Nachweis Bauleiter mit Hochbau-Qualifikation",
      "Finanzkraft: Umsatz der letzten 3 Jahre ≥ 2× Auftragswert",
      "Berufshaftpflichtversicherung (mindestens 3 Mio. €)",
      "Gewerbeanmeldung und Eintragung im Handelsregister",
    ],
    besonderheiten: [
      "VOB Teil A/B zwingend — Gewährleistungsfrist 4 Jahre (§ 13 VOB/B)",
      "Schlüsselfertigbau: Gewährleistungsfrist 5 Jahre nach BGB, wenn VOB nicht vereinbart",
      "Bauhandwerkersicherungshypothek (§ 648a BGB) bei Bauvorhaben > 500.000 € möglich",
      "Sicherheitsleistung: 5 % Vertragssicherheit, 2 % Gewährleistungssicherheit",
      "GAEB-D83/X83 für die Angebotsabgabe ist Standard",
      "Bei Sanierungen: Bestandspläne und Schadstoffgutachten (PCB, Asbest) prüfen",
    ],
    faq: [
      {
        question: "Was bedeutet Generalunternehmer (GU) im Hochbau?",
        answer:
          "Der Generalunternehmer übernimmt die Gesamtverantwortung für ein Bauvorhaben und schließt mit den Subunternehmen (Nachunternehmern) eigene Verträge ab. Der AG hat nur mit dem GU einen Vertrag. GU-Vergaben erfordern erhöhte Finanzkraft und Projektmanagement-Kompetenz.",
      },
      {
        question: "Welche Gewährleistungsfrist gilt beim Hochbau?",
        answer:
          "Nach VOB/B beträgt die Gewährleistungsfrist 4 Jahre für das Bauwerk als Ganzes, 2 Jahre für Nachträge. Wird BGB vereinbart (ohne VOB), gelten 5 Jahre. Bei Schlüsselfertigbau sind 5 Jahre nach BGB üblich.",
      },
    ],
    relatedCategories: ["Bauarbeiten"],
  },
  {
    slug: "tga-technische-gebaeudeausruestung",
    name: "Technische Gebäudeausrüstung (TGA)",
    metaTitle: "TGA Ausschreibungen – Heizung, Sanitär, Elektro, Lüftung in öffentlichen Gebäuden",
    metaDescription:
      "Öffentliche Ausschreibungen für Technische Gebäudeausrüstung: Heizung, Sanitär, Elektro, Lüftung, MSR. CPV-Codes, Eignungskriterien und Besonderheiten der TGA-Vergabe.",
    intro: [
      "Die Technische Gebäudeausrüstung (TGA) umfasst die Gewerke Heizung, Sanitär, Elektro, Lüftung/Klima sowie Mess-, Steuer- und Regeltechnik (MSR). In öffentlichen Gebäuden wird die TGA meist lostrennt vergeben — pro Gewerk ein eigenes Verfahren.",
      "Die TGA ist stark reguliert: Energieeffizienz (GEG, EnEV), Brandschutz und Barrierefreiheit sind Standardanforderungen. Smart-Building und Gebäudeautomation gewinnen an Bedeutung.",
      "Charakteristisch: Lose-Vergabe (getrennt nach Gewerken) ist häufig, bei schlüsselfertiger Vergabe auch GU-Pakete mit Gesamttga.",
    ],
    cpvCodes: [
      { code: "45300000", label: "Bauarbeiten für Installationen in Gebäuden" },
      { code: "45310000", label: "Elektroinstallationsarbeiten" },
      { code: "45330000", label: "Klempner- und Sanitärarbeiten" },
      { code: "45321000", label: "Wärmeisolierearbeiten" },
      { code: "45232100", label: "Heizwerksarbeiten" },
      { code: "45331200", label: "Lüftungs- und Klimaanlagenarbeiten" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Verhandlungsverfahren bei komplexer MSR/Gebäudeautomation"],
    schwellenwert: "140.000 € / 216.000 € (bestimmte öffentliche Auftraggeber, Liefer/Dienst; 2026/2027) — 5,404 Mio. € bei Bauaufträgen",
    eignungskriterien: [
      "Meisterbetrieb oder gleichwertige Qualifikation",
      "Registrierung bei der Handwerkskammer (HWK)",
      "Referenzen aus vergleichbaren TGA-Projekten",
      "Nachweis Fachkraft für MSR-Technik (bei Gebäudeautomation)",
      "Nachweis Energieberater (bei energetischen Sanierungen)",
      "Berufshaftpflichtversicherung (1–3 Mio. €)",
    ],
    besonderheiten: [
      "Lose-Vergabe: Jedes Gewerk (Heizung, Sanitär, Elektro, Lüftung) ist ein eigener Auftrag",
      "GEG (Gebäudeenergiegesetz) muss eingehalten werden — Energieeffizienz ist Prüfkriterium",
      "Brandschutz: Nachweis nach Landesbauordnung (Akustik, Brandmeldung, Entrauchung)",
      "Smart-Building: BACnet, KNX oder LONMARK als Kommunikationsprotokolle spezifiziert",
      "Inbetriebnahmeprotokoll und Dokumentation nach DIN 18380 (Heizung), DIN 18381 (Gas), DIN 18382 (Elektro)",
      "Wartungsverträge: Häufig als Folgewartung im Anschluss vereinbart",
    ],
    faq: [
      {
        question: "Was bedeutet Lose-Vergabe bei der TGA?",
        answer:
          "Bei einer Lose-Vergabe wird die TGA in einzelne Gewerke (Lose) aufgeteilt — z. B. Los 1: Heizung, Los 2: Sanitär, Los 3: Elektro. Jedes Los wird separat vergeben. Bieter können sich für ein oder mehrere Lose bewerben. Vorteile: Spezialisierung, Nachteile: Koordinationsaufwand beim AG.",
      },
      {
        question: "Welche Normen gelten für die TGA-Vergabe?",
        answer:
          "Die TGA-Vergabe richtet sich nach VOB Teil C mit den einzelnen DIN-Normen: DIN 18380 (Heizungsanlagen), DIN 18381 (Gas-, Wasser- und Abwasseranlagen), DIN 18382 (Elektroanlagen), DIN 18384 (Lüftungsanlagen). Diese Normen sind Vertragsbestandteil bei VOB-Vergaben.",
      },
    ],
    relatedCategories: ["TGA"],
  },
  {
    slug: "it-dienstleistungen-software",
    name: "IT-Dienstleistungen & Software",
    metaTitle: "IT-Dienstleistungen & Software Ausschreibungen – Öffentliche Vergaben für Digitalisierung",
    metaDescription:
      "Öffentliche Ausschreibungen für IT-Dienstleistungen: Softwareentwicklung, Cloud, IT-Infrastruktur, Cybersecurity, Digitalisierung. CPV-Codes, Verfahren und Besonderheiten der IT-Vergabe.",
    intro: [
      "IT-Dienstleistungen sind der am stärksten wachsende Vergabebereich in Deutschland. Digitalisierung von Behörden (Onlinezugangsgesetz), Cloud-Migration, Cybersecurity und Softwareentwicklung treiben das Volumen. Charakteristisch: Verhandlungsverfahren ist hier der Standard, weil Anforderungen oft nicht abschließend spezifiziert werden können.",
      "Die Vergabe erfolgt bei EU-relevanten Werten nach dem einschlägigen Regelwerk; für Liefer- und Dienstleistungen gelten 2026/2027 je nach Auftraggeber 140.000 € oder 216.000 €. Rahmenverträge über 4 Jahre sind verbreitet, um Flexibilität zu gewährleisten.",
      "Besonderheiten: Due Diligence des Auftraggebers (Referenzkunden, Sicherheitskonzept), Pilotphase im Verfahren, TOTAL-Cost-of-Ownership (TCO) als Bewertungskriterium.",
    ],
    cpvCodes: [
      { code: "72000000", label: "IT-Dienste" },
      { code: "72200000", label: "Software-Entwicklung" },
      { code: "72210000", label: "Programmierung von Software" },
      { code: "72250000", label: "IT-Dienstleistungen für Kunden" },
      { code: "72320000", label: "Datenbankdienste" },
      { code: "72600000", label: "Softwaredienstleistungen" },
    ],
    typischeVerfahren: [
      "Verhandlungsverfahren mit Teilnahmewettbewerb (Standard bei komplexer Software)",
      "Offenes Verfahren bei Standard-IT (Hardware, Lizenzen)",
      "Wettbewerblicher Dialog bei Großprojekten (z. B. Behörden-IT)",
    ],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Referenzprojekte vergleichbarer Größe und Technologie",
      "ISO 27001 (Informationssicherheit) für Cloud und Security",
      "BSI C5-Zertifizierung für Cloud-Dienste an Bund und Länder",
      "Nachweis Entwicklerteam: Qualifikation, Personalausstattung",
      "IT-Sicherheitskonzept nach BSI IT-Grundschutz",
      "Nachweis Datenschutz: DS-GVO-Konformität, Auftragsverarbeitungsvertrag (AVV)",
      "Membership in Bitkom oder digitalem Vereine (optional, aber vertrauensbildend)",
    ],
    besonderheiten: [
      "Verhandlungsverfahren ist Standard — Bieter müssen im Dialog Lösungen entwickeln",
      "Rahmenvertrag über 4 Jahre mit Laufzeitverlängerung ist typisch",
      "TOTAL Cost of Ownership (TCO) als Zuschlagskriterium, nicht nur Anschaffungspreis",
      "Sicherheitsanforderungen: BSI IT-Grundschutz-Kompendium, AVV, Verschlusssachenverordnung",
      "Open Source wird bevorzugt (Sovereign Cloud, Open Source Strategy des Bundes)",
      "Sanktionsprüfung: Lieferkettengesetz, keine IT aus China/Russland (Bund/Länder)",
      "Beta-Test oder Prototyp als Verfahrensbestandteil bei komplexer Software",
    ],
    faq: [
      {
        question: "Warum wird IT meist im Verhandlungsverfahren vergeben?",
        answer:
          "IT-Projekte sind oft komplex und die Anforderungen lassen sich vorab nicht abschließend spezifizieren. Das Verhandlungsverfahren (§ 15 VgV) erlaubt den Dialog mit Bietern, um Lösungen zu entwickeln. Voraussetzung: Teilnahmewettbewerb, d. h. Vorqualifikation der Bieter vor Verhandlungsbeginn.",
      },
      {
        question: "Was ist ein Rahmenvertrag in der IT-Vergabe?",
        answer:
          "Ein Rahmenvertrag legt die Konditionen für zukünftige Einzelaufträge fest. Laufzeit maximal 4 Jahre nach VgV. Vorteile für AG: Flexibilität, kurze Reaktionszeiten. Bieter liefern nach Bedarf ab. Rahmenverträge sind in der IT besonders verbreitet, weil Anforderungen oft erst im Verlauf konkretisiert werden.",
      },
      {
        question: "Brauche ich ISO 27001 für öffentliche IT-Aufträge?",
        answer:
          "Für Cloud-Dienste und sicherheitsrelevante IT ist ISO 27001 oft Eignungskriterium. Für den Bund und viele Länder ist zudem BSI C5 (Cloud Computing Compliance Criteria Catalog) erforderlich. Bei behördenkritischer IT kann das BSI IT-Grundschutz-Kompendium verpflichtend sein.",
      },
    ],
    relatedCategories: ["Lieferung", "Sonstiges"],
  },
  {
    slug: "gebaeudereinigung",
    name: "Gebäudereinigung",
    metaTitle: "Gebäudereinigung Ausschreibungen – Öffentliche Vergaben für Unterhalts- und Glasreinigung",
    metaDescription:
      "Öffentliche Ausschreibungen für Gebäudereinigung: Unterhaltsreinigung, Glasreinigung, Fassadenreinigung, Sonderreinigung. CPV-Codes, Verfahren und Besonderheiten der Reinigung-Vergabe.",
    intro: [
      "Gebäudereinigung ist ein klassischer Dienstleistungsbereich der öffentlichen Vergabe. Schulen, Verwaltungsgebäude, Krankenhäuser, Kindergärten — alle öffentlichen Liegenschaften müssen regelmäßig gereinigt werden. Vergaben erfolgen meist als Rahmenvertrag mit 2–4 Jahren Laufzeit.",
      "Die Vergabe ist wettbewerbsintensiv und preissensibel. Eine Besonderheit: Nach § 4 Tariftreuegesetz (TTG) bzw. den Landesvergabegesetzen muss sich der Bieter zur Zahlung des Tariflohns verpflichten. In einigen Bundesländern gilt ein Mindestlohn über dem gesetzlichen.",
      "Bewertung: Wirtschaftlichkeit dominiert, aber Qualität (Qualitätsmanagement, Personalfluktuation) gewinnt an Bedeutung.",
    ],
    cpvCodes: [
      { code: "90900000", label: "Reinigungsdienste" },
      { code: "90911000", label: "Unterhaltsreinigung" },
      { code: "90911200", label: "Glasreinigung" },
      { code: "90910000", label: "Reinigungsdienste" },
      { code: "90913000", label: "Fassadenreinigung" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Nicht offenes Verfahren bei Rahmenverträgen"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Gewerbeanmeldung Gebäudereinigung",
      "Mitgliedschaft im Bundesverband Gebäudereinigung (BIV) — vertrauensbildend",
      "RAL-Gütezeichen Reinigung (qualitätsgesichert)",
      "Referenzobjekte vergleichbarer Größenordnung",
      "Nachweis Tariftreue (Tarifvertrag Gebäudereinigung) bzw. Anerkennung TVG",
      "Qualitätsmanagement: DIN EN ISO 9001 (optional, aber vorteilhaft)",
      "Berufshaftpflichtversicherung (mindestens 1 Mio. €)",
    ],
    besonderheiten: [
      "Tariftreue: Pflicht zur Zahlung des Tariflohns nach TVG / Landesvergabegesetz",
      "Mindestlohn: In einigen Bundesländern gilt ein Branchenmindestlohn (Berlin, NRW, Hessen)",
      "Rahmenvertrag 2–4 Jahre, Verlängerungsoption um 1–2 Jahre",
      "Leistungsbeschreibung nach Reinigungsleistung (m²) oder nach Objekt mit Leistungsverzeichnis",
      "Personalfluktuation ist Problem — hohe Fluktuation führt zu Qualitätsverlust",
      "Biozid-Verordnung: Nachweis für Desinfektionsmittel in Krankenhäusern/Praxen",
      "Subunternehmer: Erlaubt, aber Offenlegung und Tariftreue auch für Subunternehmen erforderlich",
    ],
    faq: [
      {
        question: "Was bedeutet Tariftreue bei der Gebäudereinigung?",
        answer:
          "Nach § 4 Tariftreuegesetz (TTG) bzw. den Landesvergabegesetzen muss sich der Auftragnehmer verpflichten, seinen Beschäftigten mindestens den tarifvertraglichen Lohn zu zahlen. Bei der Gebäudereinigung gilt der flächentarifvertrag mit einem Branchenmindestlohn, der über dem gesetzlichen Mindestlohn liegt.",
      },
      {
        question: "Wie läuft eine Gebäudereinigungs-Vergabe typischerweise ab?",
        answer:
          "Meist offenes Verfahren mit europaweiter Bekanntmachung oberhalb des einschlägigen Schwellenwerts. Der AG veröffentlicht ein Leistungsverzeichnis nach m²-Preis oder Objekt-Pauschale. Bieter reichen Angebot mit Eigenerklärung zur Tariftreue ein. Zuschlag auf das wirtschaftlichste Angebot (Preis-Leistungs-Verhältnis). Rahmenvertrag über 2–4 Jahre.",
      },
    ],
    relatedCategories: ["Gebaeudereinigung"],
  },
  {
    slug: "gruenflaechenpflege-galabau",
    name: "Grünflächenpflege & GaLaBau",
    metaTitle: "Grünflächenpflege & GaLaBau Ausschreibungen – Öffentliche Gärtnnerische Vergaben",
    metaDescription:
      "Öffentliche Ausschreibungen für Grünflächenpflege und Garten- und Landschaftsbau: Parkpflege, Gehölzschnitt, Rasenpflege, Pflanzarbeiten. CPV-Codes und Besonderheiten.",
    intro: [
      "Garten- und Landschaftsbau (GaLaBau) sowie Grünflächenpflege sind saisonal geprägte Bereiche der öffentlichen Vergabe. Kommunen unterhalten Parks, Spielplätze, Straßenbegleitgrün und Sportplätze — die Pflege wird meist als Rahmenvertrag vergeben.",
      "Der GaLaBau umfasst auch Neuanlagen: Pflanzungen, Pflasterarbeiten im Außenbereich, Teichanlagen, Spielplatzbau. Hier verschwimmt die Grenze zum Tiefbau.",
      "Saisonales Problem: Die Hauptlast liegt zwischen März und Oktober. Rahmenverträge sichern den Unternehmen ganzjährige Beschäftigung.",
    ],
    cpvCodes: [
      { code: "77000000", label: "Umwelt- und Landschaftsschutz" },
      { code: "77300000", label: "Garten- und Landschaftsbau" },
      { code: "77310000", label: "Garten- und Landschaftsbauarbeiten" },
      { code: "77200000", label: "Forst- und Baumschularbeiten" },
      { code: "77312000", label: "Pflege von Grünanlagen" },
      { code: "90720000", label: "Landschaftspflege" },
    ],
    typischeVerfahren: ["Offenes Verfahren", "Nicht offenes Verfahren bei kleinräumigen Vergaben"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Meisterbetrieb GaLaBau oder gleichwertig (Höhere Fachschule)",
      "Gewerbeanmeldung Garten- und Landschaftsbau",
      "Mitgliedschaft im BGL (Bundesverband Garten-, Landschafts- und Sportplatzbau)",
      "Referenzen: Pflege vergleichbarer Grünanlagen",
      "Nachweis Fachkraft Pflanzenschutz (Sachkunde nach PflSchG)",
      "Maschinenpark: Nachweis Mähfahrzeuge, Häcksler, Transportfahrzeuge",
      "Berufshaftpflichtversicherung (1 Mio. €)",
    ],
    besonderheiten: [
      "Saisonbetrieb: Hauptarbeitszeit März–Oktober, Winterdienst separat",
      "Rahmenvertrag 2–4 Jahre sichert ganzjährige Beschäftigung",
      "Pflanzenschutz: Sachkundenachweis nach Pflanzenschutzgesetz (PflSchG)",
      "Biozid-Verordnung bei Algen- und Moosbekämpfung",
      "Spielgerätesicherheit: Nachweis nach DIN EN 1176 (Spielplatzgeräte)",
      "Naturschutz: Berücksichtigung von Biodiversität und Bienenweide",
      "Subunternehmer möglich, aber Offenlegung erforderlich",
    ],
    saison: "März bis Oktober (Hauptsaison), Winter: Baumschnitt und Winterdienst",
    faq: [
      {
        question: "Brauche ich eine Sachkunde für Pflanzenschutz bei Grünflächenpflege?",
        answer:
          "Ja, wer Pflanzenschutzmittel im öffentlichen Raum anwendet, benötigt den Sachkundenachweis nach § 12 Pflanzenschutzgesetz. Die Sachkunde wird durch einen Lehrgang und Prüfung erworben und ist Voraussetzung für die Vergabe von Pflegeverträgen mit Pflanzenschutz.",
      },
    ],
    relatedCategories: ["Gruenflaechenpflege", "Gartenarbeiten"],
  },
  {
    slug: "sicherheitsdienstleistungen",
    name: "Sicherheitsdienstleistungen",
    metaTitle: "Sicherheitsdienstleistungen Ausschreibungen – Objekt- und Personenschutz für Behörden",
    metaDescription:
      "Öffentliche Ausschreibungen für Sicherheitsdienstleistungen: Objektschutz, Personenschutz, Veranstaltungssicherheit, Alarmverfolgung. CPV-Codes, Verfahren und Besonderheiten.",
    intro: [
      "Sicherheitsdienstleistungen sind ein personalintensiver Vergabebereich. Behörden, Krankenhäuser, Schulen und Verkehrsbetriebe benötigen Objektschutz, Empfangsdienste und Alarmverfolgung. Die Vergabe ist stark reguliert — GewO § 34a (Bewachungsgewerbe) ist Pflicht.",
      "Besonderheit: Tariftreue und Branchenmindestlohn sind verpflichtend. Der Mindestlohn in der Sicherheitsbranche liegt über dem gesetzlichen. Subunternehmer müssen offengelegt werden und denselben Anforderungen entsprechen.",
      "Vergaben erfolgen meist als Rahmenvertrag über 2–4 Jahre mit Schichtbetrieb 24/7.",
    ],
    cpvCodes: [
      { code: "79700000", label: "Sicherheitsdienstleistungen" },
      { code: "79710000", label: "Wachdienstleistungen" },
      { code: "79711000", label: "Objektschutz" },
      { code: "79713000", label: "Personenschutz" },
      { code: "79712000", label: "Alarmverfolgung" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Nicht offenes Verfahren bei Spezialaufträgen"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Gewerbeanmeldung nach § 34a GewO (Bewachungsgewerbe)",
      "Zuverlässigkeitsprüfung nach § 34a GewO (Führungszeugnis)",
      "Sachkundenachweis nach § 34a GewO (IHK-Prüfung)",
      "Referenzobjekte vergleichbarer Art (Behörde, Krankenhaus, Schule)",
      "Nachweis Tariftreue nach TVG / Landesvergabegesetz",
      "Berufshaftpflichtversicherung (mindestens 3 Mio. €)",
      "24/7-Erreichbarkeit und Leitstelle (TÜV-geprüft)",
    ],
    besonderheiten: [
      "§ 34a GewO: Zwingende Voraussetzung für das Bewachungsgewerbe",
      "Branchenmindestlohn: Liegt über dem gesetzlichen Mindestlohn, Aktualisierung alle 6 Monate",
      "Tariftreue: Pflicht zur Zahlung des Branchenmindestlohns nach TVG",
      "Subunternehmer: Erlaubt, aber Offenlegung und Nachweis § 34a GewO erforderlich",
      "Objektschutz: Schichtbetrieb 24/7, Wochenendarbeit, Feiertagszuschläge",
      "Alarmverfolgung: VdS-anerkannte Leitstelle (VdS 3138) erforderlich",
      "Personenschutz: Sonderqualifikation (Personenschutz-Fachkraft) erforderlich",
    ],
    faq: [
      {
        question: "Was ist der Branchenmindestlohn in der Sicherheitsbranche?",
        answer:
          "Der Branchenmindestlohn für Sicherheitsdienstleistungen wird halbjährlich angepasst und liegt aktuell (2025) bei ca. 13,38 € (West) bzw. 12,98 € (Ost) pro Stunde. Er gilt branchenweit und ist auch für Subunternehmer verpflichtend.",
      },
      {
        question: "Brauche ich eine IHK-Prüfung für Wachdienste?",
        answer:
          "Für die Betriebsbeauftragten nach § 34a GewO ist die Sachkundeprüfung bei der IHK erforderlich. Ausnahme: Meister für Schutz und Sicherheit oder gleichwertige Qualifikation. Ohne Sachkunde darf das Unternehmen keine Bewachungsaufgaben übernehmen.",
      },
    ],
    relatedCategories: ["Sonstiges"],
  },
  {
    slug: "transport-logistik",
    name: "Transport & Logistik",
    metaTitle: "Transport & Logistik Ausschreibungen – Öffentliche Vergaben für Beförderung und Spedition",
    metaDescription:
      "Öffentliche Ausschreibungen für Transport und Logistik: Beförderung, Spedition, Fuhrpark, Lagerhaltung, Entsorgungstransport. CPV-Codes, Eignungskriterien und Besonderheiten.",
    intro: [
      "Transport- und Logistikleistungen sind ein wichtiger Bereich der öffentlichen Vergabe. Behörden, Krankenhäuser und Kommunen benötigen Beförderungsdienste, Fuhrparkmanagement und Entsorgungslogistik. Vergaben erfolgen meist als Rahmenvertrag.",
      "Charakteristisch: Kombination aus Personen- und Gütertransport, oft mit Spezialfahrzeugen (Rollstuhltransport, Krankenwagen, Gütertransport mit Hebebühne). Die Vergabe ist reguliert durch GüKG (Güterkraftverkehrsgesetz) und PBefG (Personenbeförderungsgesetz).",
    ],
    cpvCodes: [
      { code: "60000000", label: "Transportdienstleistungen" },
      { code: "60100000", label: "Straßentransport" },
      { code: "60130000", label: "Gütertransport" },
      { code: "60170000", label: "Personenverkehr" },
      { code: "63000000", label: "Logistikdienstleistungen" },
      { code: "90500000", label: "Abfall- und Abwassertransport" },
    ],
    typischeVerfahren: ["Offenes Verfahren", "Nicht offenes Verfahren bei Spezialdiensten"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Güterkraftverkehrsgenehmigung nach § 3 GüKG (für Gütertransport)",
      "Personenbeförderungsschein nach PBefG (für Personentransport)",
      "Berufsgenossenschaftsverkehr (BGV D29) für Fahrer",
      "Nachweis Fuhrpark: Fahrzeugliste mit Zulassungen und TÜV",
      "Referenzkunden aus vergleichbaren Dienstleistungen",
      "Nachweis Fahrerqualifikation (BKrFQG) für LKW-Fahrer",
      "Berufshaftpflichtversicherung (mindestens 3 Mio. €)",
    ],
    besonderheiten: [
      "GüKG: Genehmigungspflicht für den gewerblichen Güterkraftverkehr",
      "PBefG: Genehmigungspflicht für Personentransport (außer Werkverkehr)",
      "BKrFQG: Pflicht zur Fahrerqualifikation für LKW ab 3,5 t",
      "Fahrtenbuch und digitaler Fahrtenschreiber (Kontrollnachweis)",
      "Rollstuhltransport: Sonderqualifikation nach BOKraft",
      "Umwelt: CO2-Bilanz wird zunehmend Zuschlagskriterium",
    ],
    faq: [
      {
        question: "Brauche ich eine Genehmigung nach dem GüKG?",
        answer:
          "Für den gewerblichen Güterkraftverkehr mit Kraftfahrzeugen über 3,5 t Gesamtgewicht benötigen Sie eine Genehmigung nach § 3 GüKG. Voraussetzungen: Fachkunde, Zuverlässigkeit, finanzielle Leistungsfähigkeit. Für den Werkverkehr (eigene Güter) entfällt die Genehmigungspflicht.",
      },
    ],
    relatedCategories: ["Lieferung", "Sonstiges"],
  },
  {
    slug: "catering-gemeinschaftsverpflegung",
    name: "Catering & Gemeinschaftsverpflegung",
    metaTitle: "Catering & Gemeinschaftsverpflegung Ausschreibungen – Schulverpflegung, Kantine, Krankenhaus",
    metaDescription:
      "Öffentliche Ausschreibungen für Catering und Gemeinschaftsverpflegung: Schulen, Kitas, Krankenhäuser, Behördenkantinen. CPV-Codes, Verfahren und Besonderheiten.",
    intro: [
      "Catering und Gemeinschaftsverpflegung sind ein stark wachsender Vergabebereich. Schulverpflegung (angesichts des Rechtsanspruchs auf Ganztagsbetreuung), Kantine in Behörden und Krankenhäusern — die öffentliche Hand ist ein großer Auftraggeber.",
      "Die Vergabe folgt der DSE (Dienstleistungsvorschrift für Essen) und der European Meaurege (EU-Verordnung 852/2004 über Lebensmittelhygiene). Bio und Regionalität werden zunehmend Zuschlagskriterien.",
      "Rahmenverträge 2–4 Jahre sind Standard, mit Option auf Verlängerung.",
    ],
    cpvCodes: [
      { code: "55000000", label: "Gemeinschaftsverpflegung" },
      { code: "55500000", label: "Catering" },
      { code: "55520000", label: "Verpflegung in Bildungseinrichtungen" },
      { code: "55300000", label: "Kantinen- und Cafeteriadienstleistungen" },
      { code: "55510000", label: "Krankenhauscatering" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Verhandlungsverfahren bei Bio/Regional-Konzept"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Gewerbeanmeldung Gaststätten- oder Cateringgewerbe",
      "Lebensmittelhygiene-Belehrung nach § 43 IfSG",
      "HACCP-Konzept (EU-Verordnung 852/2004)",
      "Referenzküche und Transportlogistik",
      "Bio-Zertifizierung (für Bio-Catering)",
      "Nachweis Diätküche (für Krankenhäuser)",
      "Berufshaftpflichtversicherung (1 Mio. €)",
    ],
    besonderheiten: [
      "Hygiene: HACCP-Konzept nach EU-Verordnung 852/2004 ist Pflicht",
      "Belehrung nach § 43 IfSG für alle Mitarbeiter (jährlich)",
      "Bio und Regional: Werden zunehmend Zuschlagskriterium (Nachhaltigkeit)",
      "Allergenkennzeichnung nach LMIV (Lebensmittel-Informationsverordnung)",
      "DGE-Qualitätsstandard für Schulverpflegung (empfohlen)",
      "Transport: Kühlkette (warm/kalt) muss eingehalten werden",
      "Tariftreue: In einigen Bundesländern verpflichtend",
    ],
    faq: [
      {
        question: "Was ist HACCP und warum ist es Pflicht?",
        answer:
          "HACCP (Hazard Analysis Critical Control Points) ist ein System zur Lebensmittelsicherheit, das Gefahren identifiziert und kontrolliert. Es ist nach EU-Verordnung 852/2004 für alle Lebensmittelunternehmen verpflichtend. Ohne HACCP-Konzept keine Vergabe von Catering-Leistungen.",
      },
    ],
    relatedCategories: ["Lieferung", "Sonstiges"],
  },
  {
    slug: "energieversorgung",
    name: "Energieversorgung",
    metaTitle: "Energieversorgung Ausschreibungen – Strom, Gas, Wärme für öffentliche Auftraggeber (SektVO)",
    metaDescription:
      "Öffentliche Ausschreibungen für Energieversorgung: Strom, Gas, Wärme. SektVO-relevant bei Versorgern. CPV-Codes, Verfahren und Besonderheiten der Energie-Vergabe.",
    intro: [
      "Energieversorgung ist ein Sektorbereich nach § 100 GWB, wenn die gesetzlichen Voraussetzungen für einen Sektorenauftraggeber erfüllt sind. Vergaben erfolgen nach der SektVO; der Schwellenwert für Liefer-/Dienstleistungen beträgt 432.000 € in 2026/2027. Für Strom, Gas und Wärme werden häufig langfristige Lieferverträge vergeben.",
      "Die Energiewende treibt die Vergabe erneuerbarer Energielieferverträge (PPA, Power Purchase Agreements) und bei Energieversorgern auch die Vergabe von Netzausbau, Messdienstleistungen und Energieberatung.",
      "Green Public Procurement (GPS): Öffentliche Auftraggeber müssen zunehmend Ökostrom beziehen — Nachweis durch Herkunftsnachweise (HKN).",
    ],
    cpvCodes: [
      { code: "09000000", label: "Erdölprodukte, Brennstoffe, Strom" },
      { code: "09100000", label: "Strom" },
      { code: "09200000", label: "Erdöl und Erdgas" },
      { code: "09300000", label: "Wärme, Kälte, Dampf" },
      { code: "09310000", label: "Fernwärme" },
      { code: "71310000", label: "Energieberatung" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Verhandlungsverfahren bei PPA und komplexer Beschaffung"],
    schwellenwert: "432.000 € (SektVO Lieferung/Dienstleistung) — 5.404.000 € (Bau), 2026/2027",
    eignungskriterien: [
      "Gewerbeanmeldung Energiehandel oder Energieversorger",
      "Konzession nach EnWG (für Strom/Gas-Versorger)",
      "Bilanzkreisvertrag (für Stromlieferung)",
      "Referenzkunden aus dem öffentlichen Sektor",
      "Nachweis Herkunftsnachweise (HKN) für Ökostrom",
      "Bonitätsnachweis (Energy Trading Intrinsic Risk)",
      "Berufshaftpflicht- und Vermögensschadenhaftpflicht",
    ],
    besonderheiten: [
      "SektVO anwendbar bei Versorgern (§ 100 GWB)",
      "Green Public Procurement: Ökostrom bevorzugt, HKN erforderlich",
      "Langfristige Lieferverträge (1–5 Jahre) sichern Preisstabilität",
      "Power Purchase Agreements (PPA) gewinnen an Bedeutung",
      "Bilanzkreisvertrag (Strom) bzw. Netznutzungsvertrag (Gas) erforderlich",
      "Energie-Steuer: Entlastung nach StromStG/MinöStG möglich",
      "Mess- und Zähldienstleistungen oft separat vergeben",
    ],
    faq: [
      {
        question: "Was ist der Unterschied zwischen SektVO und VgV?",
        answer:
          "Die SektVO (Sektorenvergabeverordnung) gilt für Auftraggeber in den Sektoren Trinkwasser, Energie, Verkehr und Post (§ 100 GWB). Für 2026/2027 beträgt der Schwellenwert 432.000 € für Liefer-/Dienstleistungen bzw. 5.404.000 € für Bauaufträge. Für Energieversorger ist die SektVO maßgeblich.",
      },
    ],
    relatedCategories: ["Lieferung"],
  },
  {
    slug: "immobilienverwaltung-facility-management",
    name: "Immobilienverwaltung & Facility Management",
    metaTitle: "Immobilienverwaltung & Facility Management Ausschreibungen – Öffentliche Vergaben",
    metaDescription:
      "Öffentliche Ausschreibungen für Immobilienverwaltung und Facility Management: Hausmeister, WEG-Verwaltung, Technisches FM, Infrastruktur. CPV-Codes und Besonderheiten.",
    intro: [
      "Immobilienverwaltung und Facility Management (FM) sind Wachstumsbereiche der öffentlichen Vergabe. Der Bund und die Länder verwalten große Liegenschaftsportfolios und vergeben越来越多 FM-Dienstleistungen an externe Dienstleister.",
      "Charakteristisch: Integrierte Gesamtpakete aus technischem FM (Heizung, Aufzug), infrastrukturellem FM (Reinigung, Catering, Post) und kaufmännischem FM (Controlling, Reporting). Generalunternehmer-Modelle sind verbreitet.",
      "Die Vergabe erfolgt meist als offenes Verfahren oder Verhandlungsverfahren bei komplexen FM-Paketen.",
    ],
    cpvCodes: [
      { code: "70000000", label: "Immobilienmarkt- und Immobilienverwaltungsdienstleistungen" },
      { code: "70300000", label: "Hausmeistertätigkeiten" },
      { code: "71300000", label: "Ingenieurdienstleistungen" },
      { code: "50700000", label: "Instandhaltungsdienste für Gebäude" },
      { code: "71000000", label: "Architektur- und Ingenieurdienstleistungen" },
    ],
    typischeVerfahren: ["Offenes Verfahren", "Verhandlungsverfahren bei integrierten FM-Paketen"],
    schwellenwert: "140.000 € (bestimmte zentrale Behörden) / 216.000 € (sonstige bestimmte Auftraggeber) — Dienstleistung, 2026/2027",
    eignungskriterien: [
      "Gewerbeanmeldung Immobilienverwaltung oder FM-Dienstleister",
      "ISO 41001 (Facility Management) — empfohlen",
      "Referenzobjekte vergleichbarer Größe",
      "IT-System für CAFM (Computer Aided Facility Management)",
      "Nachweis Technisches FM: Meisterbetrieb für SHK/Elektro",
      "Nachweis Kaufmännisches FM: Bilanzbuchhalter / Controller",
      "Berufshaftpflicht- und Vermögensschadenhaftpflicht (3 Mio. €)",
    ],
    besonderheiten: [
      "Integriertes FM: Technik + Infrastruktur + Kaufmännisches in einem Vertrag",
      "CAFM-System für Dokumentation und Reporting (Standard)",
      "SLA (Service Level Agreements) definieren Reaktionszeiten und Qualität",
      "Rahmenvertrag 3–5 Jahre, Verlängerungsoption",
      "Generalunternehmer-Modell: AN haftet für Subunternehmen",
      "Energiecontrolling: Verbrauchserfassung und Einsparcontracting",
      "Notfallorganisation: 24/7-Erreichbarkeit für Störungen",
    ],
    faq: [
      {
        question: "Was ist der Unterschied zwischen technischem und infrastrukturellem FM?",
        answer:
          "Technisches FM umfasst die Instandhaltung und Wartung von Gebäudetechnik (Heizung, Aufzug, Elektro). Infrastrukturelles FM umfasst Reinigung, Catering, Post, Sicherheit. Kaufmännisches FM umfasst das Controlling, Reporting und Vertragsmanagement. Integrierte FM-Pakete umfassen alle drei Bereiche.",
      },
    ],
    relatedCategories: ["Immobilienverwaltung", "Sonstiges"],
  },
  {
    slug: "gesundheitswesen-medizintechnik",
    name: "Gesundheitswesen & Medizintechnik",
    metaTitle: "Gesundheitswesen & Medizintechnik Ausschreibungen – Krankenhäuser, Praxen, Rehakliniken",
    metaDescription:
      "Öffentliche Ausschreibungen für Gesundheitswesen und Medizintechnik: Krankenhausbedarf, Medizingeräte, Pflegedienstleistungen, Rettungsdienst. CPV-Codes und Besonderheiten.",
    intro: [
      "Das Gesundheitswesen ist ein hochregulierter Vergabebereich. Öffentliche Krankenhäuser, Universitätskliniken und Rehabilitationseinrichtungen vergeben Medizintechnik, Pflegedienstleistungen, Rettungsdienste und Medizinbedarf. Die Vergabe folgt dem SektVO-Regime für Krankenhäuser (§ 100 GWB).",
      "Medizinprodukte müssen CE-gekennzeichnet sein und den Anforderungen des MPG (Medizinproduktegesetz) und der MDR (Medical Device Regulation) entsprechen. Bei Arzneimitteln gilt das AMG.",
      "Charakteristisch: Lange Rahmenverträge (4 Jahre), hohe Qualitätsanforderungen, Bieter-Due Diligence mit Audit.",
    ],
    cpvCodes: [
      { code: "33100000", label: "Medizinische Geräte" },
      { code: "33140000", label: "Medizinische Ausrüstung" },
      { code: "85100000", label: "Krankenhaus- und Klinikdienste" },
      { code: "85140000", label: "Dienstleistungen im Gesundheitswesen" },
      { code: "33600000", label: "Pharmazeutische Produkte" },
      { code: "85141000", label: "Rettungsdienste" },
    ],
    typischeVerfahren: ["Offenes Verfahren (Standard)", "Verhandlungsverfahren bei komplexer Medizintechnik"],
    schwellenwert: "432.000 € (SektVO, soweit einschlägig) — sonst 140.000 € / 216.000 €, 2026/2027",
    eignungskriterien: [
      "CE-Kennzeichnung nach MPG / MDR für Medizinprodukte",
      "Zulassung nach AMG (für Arzneimittel)",
      "ISO 13485 (Qualitätsmanagement Medizinprodukte)",
      "Referenzkunden aus dem Gesundheitswesen",
      "Krankenhaus-Audit: Vor-Ort-Begehung für Großaufträge",
      "Medizinprodukteberater: Nachweis Fachpersonal",
      "Berufshaftpflicht und Produkthaftpflicht (5 Mio. €)",
    ],
    besonderheiten: [
      "SektVO: Krankenhäuser der öffentlichen Hand sind Sektorenauftraggeber",
      "MDR (Medical Device Regulation): Ersetzt seit 2021 die MDD, Übergangsfristen bis 2028",
      "AMG (Arzneimittelgesetz): Zulassungspflicht für Arzneimittel",
      "Rahmenvertrag 4 Jahre, oft mit Option auf Verlängerung",
      "Audit: Vor-Ort-Begehung des Herstellers/Lieferanten bei Großaufträgen",
      "Medizinprodukteberater: Fachpersonal für Schulung und Wartung",
      "Versicherung: Produkthaftpflicht für Medizinprodukte (mindestens 5 Mio. €)",
    ],
    faq: [
      {
        question: "Was ist die MDR und betrifft sie alle Medizinprodukte?",
        answer:
          "Die MDR (Medical Device Regulation, EU 2017/745) ersetzt seit 26. Mai 2021 die bisherige MDD (Medical Device Directive). Sie gilt für alle Medizinprodukte, die in der EU in Verkehr gebracht werden. Übergangsfristen für alt zugelassene Produkte laufen bis 2028. Die MDR erhöht die Anforderungen an Klinische Bewertung und Post-Market Surveillance.",
      },
      {
        question: "Sind öffentliche Krankenhäuser Sektorenauftraggeber?",
        answer:
          "Ob ein öffentliches Krankenhaus als Sektorenauftraggeber einzuordnen ist, hängt von den gesetzlichen Voraussetzungen und der konkreten Tätigkeit ab. Eine öffentliche Finanzierung allein entscheidet das nicht pauschal; die einschlägigen Schwellenwerte und Regelwerke sind im Einzelfall zu prüfen.",
      },
    ],
    relatedCategories: ["Lieferung", "Sonstiges"],
  },
];

export const BRANCHE_MAP: Record<string, BrancheEntry> = Object.fromEntries(
  BRANCHEN.map((b) => [b.slug, b]),
);

export const ALL_BRANCHE_SLUGS: string[] = BRANCHEN.map((b) => b.slug);
