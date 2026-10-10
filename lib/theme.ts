"use client";

import { createTheme } from "@mui/material/styles";
import { BRAND_COLORS } from "@/lib/brand-tokens";

const colors = BRAND_COLORS;

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.brandSignal,
      light: colors.brandSignalSoft,
      dark: colors.brandSignalDark,
      contrastText: colors.onBrand,
    },
    secondary: {
      main: colors.brandPrimary,
      light: colors.brandPrimaryLight,
      dark: colors.brandPrimaryDark,
      contrastText: colors.onBrand,
    },
    background: {
      default: colors.surfaceCanvas,
      paper: colors.surfaceElevated,
    },
    error: {
      main: colors.statusDanger,
      light: colors.statusDangerSoft,
      dark: colors.statusDangerDark,
      contrastText: colors.onBrand,
    },
    success: {
      main: colors.statusSuccess,
      light: colors.statusSuccessSoft,
      dark: colors.statusSuccessDark,
      contrastText: colors.onBrand,
    },
    warning: {
      main: colors.statusWarning,
      light: colors.statusWarningSoft,
      dark: colors.statusWarningDark,
      contrastText: colors.onBrand,
    },
    info: {
      main: colors.statusInfo,
      light: colors.statusInfoSoft,
      dark: colors.statusInfoDark,
      contrastText: colors.onBrand,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    divider: colors.borderSubtle,
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
          "&:focus-visible, &.Mui-focusVisible": {
            outline: `3px solid ${colors.brandPrimary}`,
            outlineOffset: 3,
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
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
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
          border: `1px solid ${colors.borderSubtle}`,
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
              borderColor: colors.borderSubtle,
            },
          },
        },
      },
    },
  },
});

export default theme;
