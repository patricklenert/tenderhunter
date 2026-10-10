import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_COLORS } from "@/lib/brand-tokens";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <BrandMark size={22} color={BRAND_COLORS.brandSignal} />
      </div>
    ),
    { ...size },
  );
}
