import { ImageResponse } from "next/og";
import { BrandLockup } from "@/components/BrandLockup";
import { BRAND_COLORS, BRAND_METADATA } from "@/lib/brand-tokens";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = BRAND_METADATA.defaultTitle;

export default function OgImage() {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 800,
              color: BRAND_COLORS.textPrimary,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            KI-Ausschreibungssoftware für deutsche Unternehmen
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: BRAND_COLORS.textSecondary,
              maxWidth: 800,
              lineHeight: 1.5,
            }}
          >
            Automatisch passende öffentliche Ausschreibungen finden. KI analysiert
            Anforderungen, Ihre Website wird gescannt.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 22,
            color: BRAND_COLORS.textSecondary,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: BRAND_COLORS.brandSignal, fontWeight: 700 }}>•</span> DTVP
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: BRAND_COLORS.brandSignal, fontWeight: 700 }}>•</span> TED
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: BRAND_COLORS.brandSignal, fontWeight: 700 }}>•</span> evergabe
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: BRAND_COLORS.brandSignal, fontWeight: 700 }}>•</span> Bauportal
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: BRAND_COLORS.brandSignal, fontWeight: 700 }}>•</span> Niedersachsen
          </div>
        </div>
      </div>
    ),
    size,
  );
}
