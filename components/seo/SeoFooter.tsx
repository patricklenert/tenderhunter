const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

const faqs = [
  {
    q: "Was ist Tenderhunter?",
    a: "Tenderhunter ist eine KI-gestützte Ausschreibungssoftware, die automatisch die wichtigsten deutschen Vergabeportale — DTVP, TED, evergabe und Bauportal Deutschland — durchsucht. Die KI analysiert Vergabeunterlagen, extrahiert Anforderungen und gleicht diese mit Ihrem Unternehmensprofil ab. Sie erhalten täglich aktuelle, passende öffentliche Ausschreibungen mit Fit-Score, Fristen und Auftraggeber-Details — für 13 Leistungsbereiche, alle 16 Bundesländer und über 50 Städte.",
  },
  {
    q: "Welche Arten von Ausschreibungen werden gefunden?",
    a: "Tenderhunter deckt 13 Leistungsbereiche ab – von Bauarbeiten, Tiefbau und technischer Gebäudeausrüstung über Gebäudereinigung, Winterdienst und Facility Management bis hin zu Planungsleistungen, IT-Dienstleistungen und Materiallieferungen.",
  },
  {
    q: "Wie funktioniert das Matching mit meinem Unternehmen?",
    a: "Sie geben Ihre Unternehmenswebsite ein. Tenderhunter analysiert Ihre Leistungen und vergleicht sie mit allen offenen Ausschreibungen. Ein Fit-Score zeigt Ihnen an, wie gut jede Ausschreibung zu Ihrem Profil passt.",
  },
  // SEO: Expanded FAQ items targeting informational queries for broader FAQ rich snippet coverage
  {
    q: "Kostet Tenderhunter etwas?",
    a: "Tenderhunter bietet eine kostenlose Testung an. Sie können die Plattform unverbindlich ausprobieren und passende Ausschreibungen für Ihr Unternehmen finden. Details zu den Abo-Modellen finden Sie auf der Funktionen-Seite.",
  },
  {
    q: "Wie aktuell sind die Ausschreibungen bei Tenderhunter?",
    a: "Tenderhunter aktualisiert die Ausschreibungsdatenbank täglich. Neue Vergaben von DTVP, TED, evergabe und weiteren Portalen werden innerhalb von 24 Stunden erfasst und Ihnen per Dashboard und optional per E-Mail benachrichtigt.",
  },
  {
    q: "Für welche Branchen ist Tenderhunter geeignet?",
    a: "Tenderhunter eignet sich für Unternehmen aus allen vergaberelevanten Branchen: Bauarbeiten, Tiefbau, IT-Dienstleistungen, Facility Management, Gebäudereinigung, Winterdienst, Grünflächenpflege, Planungsleistungen, Lieferungen und mehr. Die KI passt die Ergebnisse automatisch an Ihr Unternehmensprofil an.",
  },
];

export function SeoFooter() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}
