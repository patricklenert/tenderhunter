import Link from "next/link";
import { Box, Container, Stack, Typography } from "@mui/material";
import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { eq, and, or, isNull, gt, asc } from "drizzle-orm";
import { formatDeadlineDE, deadlineLabel, deadlineColor } from "@/lib/date-utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface TenderItem {
  id: number;
  title: string;
  description: string;
  deadline: string | null;
  location: string | null;
  category: string | null;
}

async function getLatestTenders(): Promise<TenderItem[]> {
  const now = new Date();
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      deadlineAt: tenders.deadlineAt,
      category: tenders.category,
      rawText: tenders.rawText,
      jsonBlob: structuredData.jsonBlob,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(
      and(
        or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
      ),
    )
    .orderBy(asc(tenders.deadlineAt))
    .limit(12);

  return rows.map((row) => {
    const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
    const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
    const description =
      typeof blob.description === "string"
        ? blob.description.slice(0, 250)
        : typeof blob.summary === "string"
          ? blob.summary.slice(0, 250)
          : (row.rawText ?? "").slice(0, 250);

    return {
      id: row.id,
      title: row.title ?? `Ausschreibung #${row.id}`,
      description,
      deadline: row.deadlineAt ? row.deadlineAt.toISOString() : null,
      location: typeof hardFacts.location === "string" ? hardFacts.location : null,
      category: row.category,
    };
  });
}

export async function HomeTenderList() {
  const tenders = await getLatestTenders();

  if (tenders.length === 0) return null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Aktuelle Ausschreibungen",
    numberOfItems: tenders.length,
    itemListElement: tenders.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}`,
      name: t.title,
    })),
  };

  return (
    <Box component="section" sx={{ bgcolor: "grey.50", borderTop: 1, borderColor: "divider", py: { xs: 5, md: 7 } }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Container maxWidth="lg">
        <Typography
          variant="h2"
          component="h2"
          fontWeight={800}
          sx={{ fontSize: { xs: "1.5rem", md: "2rem" }, letterSpacing: "-0.02em", mb: 3 }}
        >
          Aktuelle Ausschreibungen
        </Typography>
        <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
          {tenders.map((tender) => (
            <Box component="li" key={tender.id} sx={{ mb: 0.75 }}>
              <Link
                href={`/ausschreibung/${tender.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block", padding: "12px 0" }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ color: "primary.main" }}>
                    {tender.title}
                  </Typography>
                  {tender.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {tender.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    {tender.location && (
                      <Typography variant="caption" color="text.secondary">
                        {tender.location}
                      </Typography>
                    )}
                    {tender.category && (
                      <Typography variant="caption" color="text.secondary">
                        {tender.category}
                      </Typography>
                    )}
                    {tender.deadline && (
                      <Typography variant="caption" color={deadlineColor(tender.deadline)}>
                        Frist: {formatDeadlineDE(tender.deadline)} ({deadlineLabel(tender.deadline)})
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Link>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Link
            href="/ausschreibungen"
            style={{
              textDecoration: "none",
              color: "#e9644d",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Alle Ausschreibungen ansehen →
          </Link>
        </Box>
      </Container>
    </Box>
  );
}
