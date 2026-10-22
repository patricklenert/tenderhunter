import { Suspense } from "react";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { CompanyProfileHeader } from "@/components/profile/CompanyProfileHeader";
import { PageFooter } from "@/components/profile/PageFooter";
import { PublicProfileMatches } from "@/components/profile/PublicProfileMatches";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";

export const revalidate = 300;
export const runtime = "nodejs";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const rows = await db
    .select({ id: companyProfiles.id, name: companyProfiles.name, description: companyProfiles.description })
    .from(companyProfiles)
    .where(eq(companyProfiles.slug, slug))
    .limit(1);

  if (rows.length === 0) return { title: "Firma nicht gefunden", robots: { index: false, follow: true } };

  const title = `${rows[0].name} – Passende Ausschreibungen`;
  const description = rows[0].description ?? `Aktuelle passende Ausschreibungen für ${rows[0].name}`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}`, languages: { "de-DE": `/p/${slug}` } },
    robots: getListingRobots(resolvedSearchParams, 1, true),
    openGraph: {
      title,
      description,
      type: "profile",
      locale: "de_DE",
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;

  const companies = await db
    .select({
      id: companyProfiles.id,
      name: companyProfiles.name,
      description: companyProfiles.description,
      industry: companyProfiles.industry,
      logoUrl: companyProfiles.logoUrl,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      address: companyProfiles.address,
    })
    .from(companyProfiles)
    .where(eq(companyProfiles.slug, slug))
    .limit(1);

  if (companies.length === 0) notFound();

  const company = companies[0];
  const capabilities = Array.isArray(company.capabilitiesJson) ? company.capabilitiesJson as string[] : [];
  const certifications = Array.isArray(company.certificationsJson) ? company.certificationsJson as string[] : [];
  const regions = Array.isArray(company.regionsJson) ? company.regionsJson as string[] : [];

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: `${siteUrl}/p/${slug}`,
    ...(company.logoUrl && { logo: company.logoUrl }),
    ...(company.description && { description: company.description.slice(0, 300) }),
    ...(company.address && { address: { "@type": "PostalAddress", streetAddress: company.address } }),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: company.name, item: `${siteUrl}/p/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "#edf3f7" }}>
        <Container maxWidth={false} sx={{ maxWidth: "1240px", mx: "auto", px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
          {/* Breadcrumbs */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 2,
              fontSize: "0.8125rem",
            }}
          >
            <Link
              href="/"
              style={{
                color: "#475569",
                textDecoration: "none",
              }}
            >
              Start
            </Link>
            <ChevronRight size={14} color="#94a3b8" />
            <Link
              href="/ausschreibungen"
              style={{
                color: "#475569",
                textDecoration: "none",
              }}
            >
              Ausschreibungen
            </Link>
            <ChevronRight size={14} color="#94a3b8" />
            <Typography
              component="span"
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              {company.name}
            </Typography>
          </Box>

          {/* Profile Header */}
          <CompanyProfileHeader
            name={company.name}
            industry={company.industry}
            description={company.description?.trim() && company.description.trim() !== company.name.trim() ? company.description : null}
            logoUrl={company.logoUrl}
            capabilities={capabilities}
            certifications={certifications}
            regions={regions}
            teamSize={company.teamSize}
            address={company.address}
          />
          <Suspense fallback={<Box component="section" aria-label="Ausschreibungen werden geladen" sx={{ mt: 3, minHeight: 120 }} />}>
            <PublicProfileMatches company={company} />
          </Suspense>

          <PageFooter />
        </Container>
      </Box>
    </>
  );
}
