const BRAND_SIGNAL_DARK = "#a44738";

export const BRAND_COLORS = {
  brandPrimary: "#0c3259",
  brandPrimaryLight: "#e5edf5",
  brandPrimaryDark: "#152a45",
  brandSignal: "#ba5a42",
  brandSignalSoft: "#fde0d8",
  brandSignalDark: BRAND_SIGNAL_DARK,
  actionPrimary: "#b65540",
  surfaceCanvas: "#eef5fa",
  surfacePanel: "#f5f9fc",
  surfaceElevated: "#fafdff",
  surfaceStrong: "#e8f2f9",
  textPrimary: "#1b2a34",
  textSecondary: "#4b5861",
  borderSubtle: "#c3ccd1",
  statusSuccess: "#1a763f",
  statusSuccessSoft: "#d8f3de",
  statusSuccessDark: "#1b5e32",
  statusWarning: "#9a5a08",
  statusWarningSoft: "#fff4df",
  statusWarningDark: "#7a4507",
  statusDanger: "#b01e25",
  statusDangerSoft: "#ffebee",
  statusDangerDark: "#8e0000",
  statusInfo: "#526476",
  statusInfoSoft: "#eef4f7",
  statusInfoDark: "#334155",
  onBrand: "#ffffff",
} as const;

export const BRAND_METADATA = {
  name: "Tenderhunter",
  defaultTitle: "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen",
  titleTemplate: "%s | Tenderhunter",
  description:
    "Finden Sie automatisch passende öffentliche Ausschreibungen in Deutschland. KI analysiert Anforderungen, Ihre Unternehmenswebsite wird gescannt, täglich passende Projekte.",
  socialTitle: "Tenderhunter – KI-Ausschreibungssoftware",
  socialDescription:
    "Deutsche Ausschreibungsportale automatisch durchsuchen. KI-gestütztes Matching für Ihr Unternehmen.",
  tagline: "Öffentliche Aufträge. Früh erkannt. Klar bewertet.",
} as const;
