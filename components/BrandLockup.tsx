import { BrandMark } from "@/components/BrandMark";
import { BRAND_COLORS, BRAND_METADATA } from "@/lib/brand-tokens";

interface BrandLockupProps {
  size?: number;
  labelSize?: number;
  gap?: number;
}

/** Shared wordmark treatment for metadata images and public product entry points. */
export function BrandLockup({ size = 48, labelSize = 28, gap = 16 }: BrandLockupProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.25),
          background: BRAND_COLORS.brandPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <BrandMark size={Math.round(size * 0.625)} color={BRAND_COLORS.brandSignal} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: labelSize,
          fontWeight: 700,
          color: BRAND_COLORS.textPrimary,
          whiteSpace: "nowrap",
        }}
      >
        {BRAND_METADATA.name}
      </div>
    </div>
  );
}
