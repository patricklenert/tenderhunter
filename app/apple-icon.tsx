import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_COLORS } from "@/lib/brand-tokens";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
           background: BRAND_COLORS.brandPrimary,
          borderRadius: 36,
        }}
      >
        <BrandMark size={120} color={BRAND_COLORS.brandSignal} />
      </div>
    ),
    { ...size },
  );
}
