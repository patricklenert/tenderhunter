import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";
import { BrandLockup } from "@/components/BrandLockup";
import { BRAND_COLORS } from "@/lib/brand-tokens";
import { getSiteHost } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tenderhunter Funktionen – Automatische Suche, KI-Analyse, Intelligentes Matching";

export default function FunktionenOgImage() {
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
            }}
          >
            So funktioniert Tenderhunter
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 10 }}>
            {["Automatische Suche", "KI-Analyse", "Passung bewerten"].map((label) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: BRAND_COLORS.brandSignalSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BrandMark size={22} color={BRAND_COLORS.brandSignal} />
                </div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: BRAND_COLORS.textPrimary, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: BRAND_COLORS.textSecondary }}>
          {getSiteHost()}/funktionen
        </div>
      </div>
    ),
    size,
  );
}
