"use client";

import { createTheme } from "@mui/material/styles";

// Hex approximations of the semantic OKLCH tokens defined in DESIGN.md.
const colors = {
  brandPrimary: "#1e3a5f",
  brandSignal: "#e9644d",
  canvas: "#f0f4f8",
  surfacePanel: "#f7fafc",
  surface: "#fbfcfd",
  surfaceStrong: "#e8eff5",
  textPrimary: "#2d3544",
  textMuted: "#667288",
  border: "#d1d5db",
  accentSoft: "#f8d8d2",
  success: "#277544",
  successSoft: "#e5f3e9",
  warning: "#9a5a08",
  warningSoft: "#fff4df",
  risk: "#c62828",
  riskSoft: "#ffebee",
  info: "#526476",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.brandSignal,
      light: colors.accentSoft,
      dark: "#b34d3d",
      contrastText: "#ffffff",
    },
    secondary: {
      main: colors.brandPrimary,
      light: "#e5edf5",
      dark: "#152a45",
      contrastText: "#ffffff",
    },
    background: {
      default: colors.canvas,
      paper: colors.surface,
    },
    error: {
      main: colors.risk,
      light: colors.riskSoft,
      dark: "#8e0000",
      contrastText: "#ffffff",
    },
    success: {
      main: colors.success,
      light: colors.successSoft,
      dark: "#1b5e32",
      contrastText: "#ffffff",
    },
    warning: {
      main: colors.warning,
      light: colors.warningSoft,
      dark: "#7a4507",
      contrastText: "#ffffff",
    },
    info: {
      main: colors.info,
      light: "#eef4f7",
      dark: "#334155",
      contrastText: "#ffffff",
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textMuted,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: '"Manrope", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: `3px solid ${colors.accentSoft}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 4,
          fontWeight: 600,
          padding: "10px 20px",
          minHeight: 44,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          boxShadow: "none",
          border: `1px solid ${colors.border}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "none",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "medium",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
          borderRadius: 4,
            "& fieldset": {
              borderColor: colors.border,
            },
          },
        },
      },
    },
  },
});

export default theme;
