import { ImageResponse } from "next/og";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { BrandLockup } from "@/components/BrandLockup";
import { BRAND_COLORS } from "@/lib/brand-tokens";
import { getSiteHost } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ausschreibungen auf Tenderhunter";

// SEO: Dynamic OG image for category pages — improves social sharing CTR
export default async function CategoryOgImage({
  params,
}: {
  params: Promise<{ kategorie: string }>;
}) {
  const { kategorie } = await params;
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  const label = categoryKey ? (CATEGORY_LABELS[categoryKey] ?? categoryKey) : "Ausschreibungen";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
           background: BRAND_COLORS.surfaceElevated,
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <BrandLockup />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
               display: "flex",
               background: BRAND_COLORS.brandSignalSoft,
               color: BRAND_COLORS.brandSignalDark,
              padding: "8px 20px",
              borderRadius: 20,
              fontSize: 22,
              fontWeight: 600,
              alignSelf: "flex-start",
            }}
          >
            {label}
          </div>
          <div
            style={{
               display: "flex",
               fontSize: 52,
              fontWeight: 800,
               color: BRAND_COLORS.textPrimary,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              maxWidth: 1000,
            }}
          >
            {label} – Aktuelle Ausschreibungen
          </div>
          <div style={{ display: "flex", fontSize: 24, color: BRAND_COLORS.textSecondary, maxWidth: 800, lineHeight: 1.5 }}>
            Öffentliche Vergabeverfahren für {label.toLowerCase()} in Deutschland
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: BRAND_COLORS.textSecondary }}>
          {getSiteHost()}
        </div>
      </div>
    ),
    size,
  );
}
