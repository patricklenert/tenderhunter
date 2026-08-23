"use client";

import { createTheme } from "@mui/material/styles";

// Hex approximations of the OKLCH values defined in DESIGN.md
const colors = {
  accent: "#e9644d", // OKLCH 58% 0.13 35
  accentSoft: "#f8d8d2", // OKLCH 92.8% 0.034 35
  canvas: "#f0f4f8", // OKLCH 96.7% 0.01 238
  surface: "#fbfcfd", // OKLCH 99.2% 0.004 238
  surfaceStrong: "#e8eff5", // OKLCH 95.6% 0.014 238
  textPrimary: "#2d3544", // OKLCH 27.5% 0.028 240
  textMuted: "#667288", // OKLCH 45.3% 0.022 240
  border: "#d1d5db", // OKLCH 84% 0.012 236
  success: "#4cd964", // OKLCH 58% 0.12 152
  risk: "#e44c20", // OKLCH 56.2% 0.18 25
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.accent,
      light: colors.accentSoft,
      dark: "#b34d3d", 
    },
    secondary: {
      main: colors.success,
    },
    background: {
      default: colors.canvas,
      paper: colors.surface,
    },
    error: {
      main: colors.risk,
    },
    success: {
      main: colors.success,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textMuted,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
