import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen";

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
              maxWidth: 900,
            }}
          >
            KI-Ausschreibungssoftware für deutsche Unternehmen
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#667288",
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
            color: "#667288",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e9644d", fontWeight: 700 }}>✓</span> DTVP
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e9644d", fontWeight: 700 }}>✓</span> TED
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e9644d", fontWeight: 700 }}>✓</span> evergabe
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e9644d", fontWeight: 700 }}>✓</span> Bauportal
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e9644d", fontWeight: 700 }}>✓</span> Niedersachsen
          </div>
        </div>
      </div>
    ),
    size,
  );
}
