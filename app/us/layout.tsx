import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Tenderhunter US | Procurement opportunities", template: "%s | Tenderhunter US" },
  description: "U.S. federal, state, and subcontracting procurement opportunities with pursuit readiness guidance and prime contractor research.",
  alternates: {
    canonical: "/us",
    languages: { "en-US": "/us" },
    types: { "application/rss+xml": "/us/feed.xml" },
  },
  openGraph: { locale: "en_US", type: "website" },
};

export default function UsLayout({ children }: { children: React.ReactNode }) {
  return <section lang="en">{children}</section>;
}
