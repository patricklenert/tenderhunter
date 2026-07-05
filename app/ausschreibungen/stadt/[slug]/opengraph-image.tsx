import { ImageResponse } from "next/og";
import { CITY_SLUG_MAP } from "@/lib/cities";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ausschreibungen nach Stadt auf Tenderhunter";

// SEO: Dynamic OG image for city pages — improves social sharing CTR
export default async function CityOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cityEntry = CITY_SLUG_MAP[slug];
  const cityName = cityEntry?.label ?? slug;

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
                background: "#e9644d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                color: "#fff",
                fontWeight: 800,
              }}
            >
              T
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
            {cityName}
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
            Ausschreibungen in {cityName}
          </div>
          <div style={{ fontSize: 24, color: "#667288", maxWidth: 800, lineHeight: 1.5 }}>
            Aktuelle öffentliche Vergaben und Aufträge in {cityName}
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
