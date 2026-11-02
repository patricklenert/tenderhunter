export const FIT_SCORE_TIERS = ["high", "medium", "low"] as const;

export const FIT_SCORE_LEVELS = {
  high: {
    minimum: 70,
    label: "Stark",
    ariaLabel: "Starke Passung",
    color: "success.main",
    trackColor: "success.light",
    backgroundColor: "success.light",
  },
  medium: {
    minimum: 40,
    label: "Solide",
    ariaLabel: "Solide Passung",
    color: "info.main",
    trackColor: "info.light",
    backgroundColor: "info.light",
  },
  low: {
    label: "Offen",
    ariaLabel: "Geringe Passung",
    color: "text.secondary",
    trackColor: "background.default",
    backgroundColor: "background.default",
  },
} as const;

export type FitScoreTier = (typeof FIT_SCORE_TIERS)[number];

export function getFitScoreTier(value: number): FitScoreTier {
  if (value >= FIT_SCORE_LEVELS.high.minimum) return "high";
  if (value >= FIT_SCORE_LEVELS.medium.minimum) return "medium";
  return "low";
}
