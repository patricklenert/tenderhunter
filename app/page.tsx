import type { Metadata } from "next";
import { InteractiveApp } from "@/components/seo/InteractiveApp";
import { SeoFooter } from "@/components/seo/SeoFooter";

export const metadata: Metadata = {
  title: "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen",
  description:
    "Finden Sie automatisch passende öffentliche Ausschreibungen in Deutschland. KI analysiert Anforderungen, Ihre Unternehmenswebsite wird gescannt, täglich passende Projekte.",
  alternates: {
    canonical: "/",
    languages: { "de-DE": "/" },
    types: {
      "application/rss+xml": `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com"}/feeds/tender.xml`,
    },
  },
  openGraph: {
    title: "Tenderhunter – KI-Ausschreibungssoftware",
    description:
      "Deutsche Ausschreibungsportale automatisch durchsuchen. KI-gestütztes Matching für Ihr Unternehmen.",
    type: "website",
    locale: "de_DE",
  },
};

export default function HomePage() {
  return (
    <>
      <InteractiveApp />
      <SeoFooter />
    </>
  );
}
