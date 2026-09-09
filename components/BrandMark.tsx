import type { SVGProps } from "react";

interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "color" | "height" | "width"> {
  size?: number;
  color?: string;
}

/** Shared Tenderhunter mark: a focused scan that resolves into a signal. */
export function BrandMark({ size = 24, color = "currentColor", ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="10" r="6.25" />
      <path d="m14.6 14.6 6.4 6.4" />
      <path d="m5.8 11.9 2.8-2.8 2.4 1.9 4.9-5.4" />
      <path d="M13.9 5.6h2v2" />
    </svg>
  );
}
