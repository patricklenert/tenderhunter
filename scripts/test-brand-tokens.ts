import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BRAND_COLORS } from "../lib/brand-tokens";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const declarations = new Map(
  [...css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
);

function resolveToken(name: string, seen = new Set<string>()): string {
  assert.ok(!seen.has(name), `Circular CSS token reference: ${name}`);
  seen.add(name);
  const value = declarations.get(name);
  assert.ok(value, `Missing CSS token --color-${name}`);
  const reference = value.match(/^var\(--color-([\w-]+)\)$/);
  return reference ? resolveToken(reference[1], seen) : value;
}

function parseOklch(value: string): [number, number, number] {
  const match = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);
  assert.ok(match, `Expected an opaque OKLCH token, received: ${value}`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
}

function oklchToRgb(value: string): number[] {
  const [lightness, chroma, hue] = parseOklch(value);
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((channel) => {
    const clipped = Math.max(0, Math.min(1, channel));
    const srgb = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  });
}

function hexToRgb(hex: string): number[] {
  const match = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  assert.ok(match, `Expected a six-digit hex color, received: ${hex}`);
  return match.slice(1).map((channel) => Number.parseInt(channel, 16));
}

function assertParity(color: keyof typeof BRAND_COLORS, token: string): void {
  const actual = hexToRgb(BRAND_COLORS[color]);
  const expected = oklchToRgb(resolveToken(token));
  assert.ok(
    actual.every((channel, index) => Math.abs(channel - expected[index]) <= 1),
    `${color} (${BRAND_COLORS[color]}) must match --color-${token} (${resolveToken(token)}) within one sRGB channel value`
  );
}

const sharedTokens = {
  brandPrimary: "brand-primary",
  brandSignal: "brand-signal",
  brandSignalSoft: "brand-signal-soft",
  brandSignalDark: "brand-signal-dark",
  actionPrimary: "action-primary",
  surfaceCanvas: "surface-canvas",
  surfacePanel: "surface-panel",
  surfaceElevated: "surface-elevated",
  surfaceStrong: "surface-strong",
  textPrimary: "text-primary",
  textSecondary: "text-secondary",
  borderSubtle: "border-subtle",
  statusSuccess: "status-success",
  statusSuccessSoft: "success-soft",
  statusWarning: "status-warning",
  statusDanger: "status-danger",
  statusInfo: "status-info",
} as const;

for (const [color, token] of Object.entries(sharedTokens) as [keyof typeof sharedTokens, string][]) {
  assertParity(color, token);
}

for (const [left, right] of [
  ["brand-primary", "action-secondary"],
  ["brand-primary", "focus-ring"],
  ["action-primary", "primary"],
  ["status-success", "fit-high"],
  ["status-warning", "fit-medium"],
  ["text-secondary", "fit-low"],
]) {
  assert.deepEqual(
    oklchToRgb(resolveToken(left)),
    oklchToRgb(resolveToken(right)),
    `--color-${right} must reuse --color-${left}`
  );
}

function relativeLuminance(rgb: number[]): number {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: number[], background: number[]): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const actionColor = oklchToRgb(resolveToken("action-primary"));
const actionText = oklchToRgb(resolveToken("primary-foreground"));
const contrast = contrastRatio(actionColor, actionText);
assert.ok(contrast >= 4.5, `Primary action text contrast must meet WCAG AA, received ${contrast.toFixed(2)}:1`);
assert.ok(
  relativeLuminance(hexToRgb(BRAND_COLORS.brandSignalDark)) < relativeLuminance(actionColor),
  "The darker signal shade must remain available for primary-action hover feedback"
);

const canvas = oklchToRgb(resolveToken("surface-canvas"));
for (const token of ["status-success", "status-warning", "status-danger", "status-info", "text-secondary"]) {
  const ratio = contrastRatio(oklchToRgb(resolveToken(token)), canvas);
  assert.ok(ratio >= 4.5, `--color-${token} must meet WCAG AA on canvas, received ${ratio.toFixed(2)}:1`);
}

for (const [foreground, background, label] of [
  [BRAND_COLORS.brandSignalDark, BRAND_COLORS.brandSignalSoft, "brand signal"],
  [BRAND_COLORS.statusSuccessDark, BRAND_COLORS.statusSuccessSoft, "success"],
  [BRAND_COLORS.statusWarningDark, BRAND_COLORS.statusWarningSoft, "warning"],
  [BRAND_COLORS.statusDangerDark, BRAND_COLORS.statusDangerSoft, "danger"],
  [BRAND_COLORS.statusInfoDark, BRAND_COLORS.statusInfoSoft, "info"],
]) {
  const ratio = contrastRatio(hexToRgb(foreground), hexToRgb(background));
  assert.ok(ratio >= 4.5, `${label} text must meet WCAG AA on its tinted surface, received ${ratio.toFixed(2)}:1`);
}

console.log(`Brand token parity verified; primary action contrast is ${contrast.toFixed(2)}:1.`);
