import type { Metadata } from "next";

interface PortalContent {
  slug: string;
  label: string;
  sourceValues: string[];
  title: string;
  description: string;
  h1: string;
  intro: string;
  portalInfo: string;
  ogAlt: string;
  // SEO: FAQ data for FAQPage JSON-LD — targets portal-specific search queries
  faq: Array<{ question: string; answer: string }>;
}

// SEO: Portal landing pages target keywords like "dtvp ausschreibungen", "ted ausschreibungen deutschland"
export const PORTALS: Record<string, PortalContent> = {
  dtvp: {
    slug: "dtvp",
    label: "DTVP",
    sourceValues: ["DTVP"],
    title: "DTVP Ausschreibungen – aktuelle Vergaben aus dem Deutschen Technologievermittlungsportal",
    description:
      "Aktuelle DTVP Ausschreibungen in Deutschland. Öffentliche Aufträge und Vergabeverfahren aus dem Deutschen Technologievermittlungsportal – täglich aktualisiert.",
    h1: "DTVP Ausschreibungen",
    intro:
      "Das Deutsche Technologievermittlungsportal (DTVP) ist eine zentrale Plattform für öffentliche Ausschreibungen in Deutschland. Hier finden Sie alle aktuellen DTVP-Vergaben – von Bauarbeiten über IT-Dienstleistungen bis hin zu Liefer- und Servicedienstleistungen.",
    portalInfo:
      "DTVP bündelt Ausschreibungen von Bund, Ländern und Kommunen und macht sie zentral auffindbare. Die Plattform unterstützt sowohl Auftraggeber bei der Veröffentlichung als auch Bieter bei der Suche nach passenden Aufträgen.",
    ogAlt: "DTVP Ausschreibungen auf Tenderhunter",
    faq: [
      {
        question: "Was ist DTVP?",
        answer: "DTVP (Deutsches Technologievermittlungsportal) ist eine zentrale Plattform für öffentliche Ausschreibungen in Deutschland. Sie bündelt Vergaben von Bund, Ländern und Kommunen an einem Ort.",
      },
      {
        question: "Wie finde ich Ausschreibungen auf DTVP?",
        answer: "Auf DTVP können Sie nach Kategorie, Region und Stichwort suchen. Tenderhunter durchsucht DTVP automatisch und zeigt Ihnen nur die für Ihr Unternehmen relevanten Ausschreibungen.",
      },
      {
        question: "Welche Arten von Aufträgen gibt es auf DTVP?",
        answer: "DTVP umfasst Ausschreibungen aus allen Leistungsbereichen: Bauarbeiten, IT-Dienstleistungen, Facility Management, Lieferungen, Beratungsleistungen und mehr.",
      },
    ],
  },
  ted: {
    slug: "ted",
    label: "TED",
    sourceValues: ["TED"],
    title: "TED Ausschreibungen Deutschland – europäische Vergaben und Tenders Electronic Daily",
    description:
      "TED Ausschreibungen aus Deutschland: Europäische Vergabebekanntmachungen aus Tenders Electronic Daily. Öffentliche Aufträge über EU-Schwellenwerte – täglich aktualisiert.",
    h1: "TED Ausschreibungen Deutschland",
    intro:
      "TED (Tenders Electronic Daily) ist das offizielle Vergabeportal der Europäischen Union. Es veröffentlicht Vergabebekanntmachungen aus allen EU-Mitgliedstaaten. Für Deutschland werden hier Aufträge über den EU-Schwellenwerten publiziert – ein wichtiger Kanal für Unternehmen mit internationaler Ausrichtung.",
    portalInfo:
      "Als Bieter profitieren Sie von TED durch den Zugang zu großen, EU-weit ausgeschriebenen Projekten. Die Bekanntmachungen folgen strikten Vorgaben der EU-Vergaberichtlinien und bieten faire Wettbewerbsbedingungen.",
    ogAlt: "TED Ausschreibungen Deutschland auf Tenderhunter",
    faq: [
      {
        question: "Was ist TED?",
        answer: "TED (Tenders Electronic Daily) ist das offizielle Vergabeportal der Europäischen Union. Es veröffentlicht Vergabebekanntmachungen aus allen EU-Mitgliedstaaten, darunter auch Deutschland.",
      },
      {
        question: "Welche Ausschreibungen stehen auf TED?",
        answer: "Auf TED werden Aufträge oberhalb der EU-Schwellenwerte veröffentlicht — also große Bau-, Liefer- und Dienstleistungsaufträge von öffentlichen Auftraggebern in der gesamten EU.",
      },
      {
        question: "Wie aktuell sind die TED-Ausschreibungen?",
        answer: "TED wird täglich aktualisiert. Tenderhunter aggregiert die TED-Daten für Deutschland und aktualisiert die Ergebnisse ebenfalls täglich.",
      },
    ],
  },
  evergabe: {
    slug: "evergabe",
    label: "evergabe",
    // SEO: Both evergabe.de and evergabe.nrw.de share the "evergabe" brand
    sourceValues: ["evergabe.de", "evergabe.nrw.de"],
    title: "evergabe Ausschreibungen – aktuelle Vergaben von evergabe.de und evergabe.nrw.de",
    description:
      "Alle evergabe Ausschreibungen in Deutschland: Vergaben von evergabe.de und evergabe.nrw.de. Elektronische Vergabeplattform für öffentliche Aufträge – täglich aktualisiert.",
    h1: "evergabe Ausschreibungen",
    intro:
      "evergabe ist eine der führenden elektronischen Vergabeplattformen in Deutschland. Über evergabe.de und die nordrhein-westfälische Variante evergabe.nrw.de werden zahlreiche öffentliche Aufträge abgewickelt – von der Bekanntmachung bis zur Angebotsabgabe.",
    portalInfo:
      "Die Plattform ermöglicht eine vollständig elektronische Abwicklung von Vergabeverfahren. Bieter können Angebote digital einreichen, Vergabeunterlagen herunterladen und am gesamten Prozess teilnehmen, ohne Papierunterlagen zu versenden.",
    ogAlt: "evergabe Ausschreibungen auf Tenderhunter",
    faq: [
      {
        question: "Was ist evergabe?",
        answer: "evergabe ist eine der führenden elektronischen Vergabeplattformen in Deutschland. Über evergabe.de und evergabe.nrw.de werden öffentliche Aufträge digital abgewickelt — von der Bekanntmachung bis zur Angebotsabgabe.",
      },
      {
        question: "Wie finde ich Ausschreibungen auf evergabe?",
        answer: "Auf evergabe.de können Sie nach Kategorie und Region filtern. Tenderhunter durchsucht evergabe automatisch und benachrichtigt Sie über neue passende Ausschreibungen.",
      },
      {
        question: "Was ist der Unterschied zwischen evergabe.de und evergabe.nrw.de?",
        answer: "evergabe.de ist die bundesweite Plattform. evergabe.nrw.de ist die Variante speziell für Nordrhein-Westfalen und wird von vielen NRW-Kommunen und Landesbehörden genutzt.",
      },
    ],
  },
  "bauportal-deutschland": {
    slug: "bauportal-deutschland",
    label: "Bauportal Deutschland",
    sourceValues: ["bauportal-deutschland.de"],
    title: "Bauportal Deutschland Ausschreibungen – Bauleistungen und Bauaufträge",
    description:
      "Aktuelle Ausschreibungen von Bauportal Deutschland: Öffentliche Bauleistungen, Facility Management und Hausverwaltung. Täglich aktualisierte Bauaufträge.",
    h1: "Bauportal Deutschland Ausschreibungen",
    intro:
      "Bauportal Deutschland ist eine spezialisierte Plattform für öffentliche Bauaufträge und verwandte Leistungen. Hier werden Ausschreibungen aus den Bereichen Bauarbeiten, Facility Management, Hausverwaltung und technische Gebäudeausrüstung gebündelt.",
    portalInfo:
      "Das Portal richtet sich an Bauunternehmen, Handwerksbetriebe und Facility-Management-Dienstleister. Es bietet einen fokussierten Zugang zu Bau- und gebäudebezogenen öffentlichen Aufträgen deutschlandweit.",
    ogAlt: "Bauportal Deutschland Ausschreibungen auf Tenderhunter",
    faq: [
      {
        question: "Was ist Bauportal Deutschland?",
        answer: "Bauportal Deutschland ist eine spezialisierte Plattform für öffentliche Bauaufträge und verwandte Leistungen wie Facility Management und Hausverwaltung in Deutschland.",
      },
      {
        question: "Welche Aufträge gibt es auf Bauportal Deutschland?",
        answer: "Das Portal umfasst Ausschreibungen für Bauarbeiten, Tiefbau, technische Gebäudeausrüstung, Facility Management, Gebäudereinigung und Hausverwaltung.",
      },
      {
        question: "Für wen ist Bauportal Deutschland geeignet?",
        answer: "Das Portal richtet sich an Bauunternehmen, Handwerksbetriebe, Facility-Management-Dienstleister und Hausverwaltungen, die öffentliche Aufträge suchen.",
      },
    ],
  },
};

export const ALL_PORTAL_SLUGS = Object.keys(PORTALS);

export function getPortalMetadata(slug: string): Metadata | null {
  const portal = PORTALS[slug];
  if (!portal) return null;
  return {
    title: portal.title,
    description: portal.description,
    alternates: {
      canonical: `/ausschreibungen/${portal.slug}`,
      languages: { "de-DE": `/ausschreibungen/${portal.slug}` },
    },
    openGraph: {
      title: portal.title,
      description: portal.description,
      type: "website",
      locale: "de_DE",
    },
  };
}
