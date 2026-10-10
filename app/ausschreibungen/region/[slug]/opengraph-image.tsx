import { ImageResponse } from "next/og";
import { SLUG_TO_BUNDESLAND } from "@/lib/bundesland";
import { BrandLockup } from "@/components/BrandLockup";
import { BRAND_COLORS } from "@/lib/brand-tokens";
import { getSiteHost } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ausschreibungen nach Bundesland auf Tenderhunter";

// SEO: Dynamic OG image for region/Bundesland pages — improves social sharing CTR
export default async function RegionOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundesland = SLUG_TO_BUNDESLAND[slug] ?? slug;

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
            {bundesland}
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
            Ausschreibungen in {bundesland}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: BRAND_COLORS.textSecondary, maxWidth: 800, lineHeight: 1.5 }}>
            Aktuelle öffentliche Vergaben und Aufträge in {bundesland}
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
