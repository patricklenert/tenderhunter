import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ThemeRegistry } from "@/components/ThemeRegistry";
import { SiteHeader } from "@/components/seo/SiteHeader";
import { SwetrixAnalytics } from "@/components/SwetrixAnalytics";
import { BRAND_COLORS, BRAND_METADATA } from "@/lib/brand-tokens";
import { getSiteUrl } from "@/lib/site-config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.brandPrimary,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND_METADATA.defaultTitle,
    template: BRAND_METADATA.titleTemplate,
  },
  description: BRAND_METADATA.description,
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
  authors: [{ name: BRAND_METADATA.name }],
  creator: BRAND_METADATA.name,
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "/",
      "x-default": "/",
    },
    types: {
      "application/rss+xml": `${siteUrl}/feeds/tender.xml`,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    siteName: BRAND_METADATA.name,
    title: BRAND_METADATA.defaultTitle,
    description: BRAND_METADATA.description,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_METADATA.socialTitle,
    description: BRAND_METADATA.socialDescription,
    images: [`${siteUrl}/opengraph-image`],
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
  // SEO: Google Search Console verification — replace with actual code from GSC
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION ?? "",
  },
  other: {
    "link-preconnect": "https://swetrix.pagestats.win",
  },
};

// SEO: Dual-typed as WebApplication + SoftwareApplication for rich SERP display (category, rating, price)
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["WebApplication", "SoftwareApplication"],
   name: BRAND_METADATA.name,
  description:
    "KI-gestützte Ausschreibungssoftware für deutsche Unternehmen. Automatische Suche, Analyse und Matching von öffentlichen Ausschreibungen.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  screenshot: `${siteUrl}/opengraph-image`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "Kostenlose Testung verfügbar",
    availability: "https://schema.org/OnlineOnly",
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
   name: BRAND_METADATA.name,
  url: siteUrl,
};

const siteOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}#organization`,
   name: BRAND_METADATA.name,
  url: siteUrl,
   logo: `${siteUrl}/apple-icon`,
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
        <ThemeRegistry>
          <SiteHeader />
          {children}
        </ThemeRegistry>
        <SwetrixAnalytics />
      </body>
    </html>
  );
}
