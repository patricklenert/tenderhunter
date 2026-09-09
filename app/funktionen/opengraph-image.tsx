import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";

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
          background: "#ffffff",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#1e3a5f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e9644d",
            }}
          >
            <BrandMark size={30} color="#e9644d" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>
            Tenderhunter
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#1a1a2e",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            So funktioniert Tenderhunter
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef0ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                🔍
              </div>
              <div style={{ fontSize: 24, color: "#1a1a2e", fontWeight: 600 }}>Automatische Suche</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef0ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                🧠
              </div>
              <div style={{ fontSize: 24, color: "#1a1a2e", fontWeight: 600 }}>KI-Analyse</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef0ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                🎯
              </div>
              <div style={{ fontSize: 24, color: "#1a1a2e", fontWeight: 600 }}>Intelligentes Matching</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#667288" }}>
          tenderhunter.palemadigital.com/funktionen
        </div>
      </div>
    ),
    size,
  );
}
