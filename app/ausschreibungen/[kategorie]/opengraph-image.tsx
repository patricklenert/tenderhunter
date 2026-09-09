import { ImageResponse } from "next/og";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { BrandMark } from "@/components/BrandMark";

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
          background: "#ffffff",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#1e3a5f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e9644d",
              }}
            >
              <BrandMark size={28} color="#e9644d" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a2e" }}>Tenderhunter</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "inline-flex",
              background: "#fef0ed",
              color: "#e9644d",
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
              fontSize: 52,
              fontWeight: 800,
              color: "#1a1a2e",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              maxWidth: 1000,
            }}
          >
            {label} – Aktuelle Ausschreibungen
          </div>
          <div style={{ fontSize: 24, color: "#667288", maxWidth: 800, lineHeight: 1.5 }}>
            Öffentliche Vergabeverfahren für {label.toLowerCase()} in Deutschland
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#667288" }}>
          tenderhunter.palemadigital.com
        </div>
      </div>
    ),
    size,
  );
}
