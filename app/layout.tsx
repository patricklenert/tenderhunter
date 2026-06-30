import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ThemeRegistry } from "@/components/ThemeRegistry";
import { SwetrixAnalytics } from "@/components/SwetrixAnalytics";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const viewport: Viewport = {
  themeColor: "#e9644d",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen",
    template: "%s | Tenderhunter",
  },
  description:
    "Finden Sie automatisch passende öffentliche Ausschreibungen in Deutschland. KI analysiert Anforderungen, Ihre Unternehmenswebsite wird gescannt, täglich passende Projekte.",
  keywords: [
    "Ausschreibungen",
    "öffentliche Ausschreibungen",
    "Vergabe",
    "Vergabeverfahren",
    "DTVP",
    "TED",
    "Ausschreibungsportal",
    "Aufträge der öffentlichen Hand",
    "KI Ausschreibungssuche",
    "Ausschreibungen Deutschland",
  ],
  authors: [{ name: "Tenderhunter" }],
  creator: "Tenderhunter",
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "/",
    },
    types: {
      "application/rss+xml": `${siteUrl}/feeds/tender.xml`,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    siteName: "Tenderhunter",
    title: "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen",
    description:
      "Finden Sie automatisch passende öffentliche Ausschreibungen. KI analysiert Anforderungen, Unternehmenswebsite scannen, täglich passende Projekte.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tenderhunter – KI-Ausschreibungssoftware",
    description:
      "Deutsche Ausschreibungsportale automatisch durchsuchen. KI-gestütztes Matching für Ihr Unternehmen.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Tenderhunter",
  description:
    "KI-gestützte Ausschreibungssoftware für deutsche Unternehmen. Automatische Suche, Analyse und Matching von öffentlichen Ausschreibungen.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "Kostenlose Testung verfügbar",
  },
  areaServed: {
    "@type": "Country",
    name: "Deutschland",
  },
  featureList: [
    "Automatische Suche deutscher Vergabeportale",
    "KI-Analyse von Ausschreibungsanforderungen",
    "Unternehmenswebsite-Scanner",
    "Intelligentes Matching mit Fit-Score",
    "Tägliche Updates neuer Ausschreibungen",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tenderhunter",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/ausschreibungen?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const siteOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}#organization`,
  name: "Tenderhunter",
  url: siteUrl,
  logo: `${siteUrl}/logo.webp`,
  description:
    "KI-gestützte Ausschreibungssoftware für deutsche Unternehmen. Automatische Suche, Analyse und Matching von öffentlichen Ausschreibungen.",
  areaServed: {
    "@type": "Country",
    name: "Deutschland",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteOrganizationJsonLd) }}
        />
      </head>
      <body className={manrope.className}>
        <ThemeRegistry>{children}</ThemeRegistry>
        <SwetrixAnalytics />
      </body>
    </html>
  );
}
