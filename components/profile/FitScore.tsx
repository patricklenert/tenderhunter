"use client";

import { Box, CircularProgress, Tooltip, Typography } from "@mui/material";

interface FitScoreProps {
  value: number;
}

const palette = {
  high: { color: "success.main", track: "success.light", label: "Stark", ariaLabel: "Starke Passung" },
  medium: { color: "warning.main", track: "warning.light", label: "Solide", ariaLabel: "Solide Passung" },
  low: { color: "text.secondary", track: "background.default", label: "Offen", ariaLabel: "Geringe Passung" },
};

function getFitPalette(value: number) {
  if (value >= 70) return palette.high;
  if (value >= 40) return palette.medium;
  return palette.low;
}

export function FitScore({ value }: FitScoreProps) {
  const p = getFitPalette(value);

  return (
    <Tooltip
      title="Übereinstimmung mit Leistungen, Branche und Standort des Unternehmens."
      arrow
      placement="top"
    >
      <Box
        role="meter"
        aria-label={`Fit ${value} Prozent, ${p.ariaLabel}`}
        aria-valuetext={`${value}% - ${p.ariaLabel}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.35,
          minWidth: 58,
          cursor: "help",
        }}
      >
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={54}
            thickness={4.5}
            aria-hidden="true"
            sx={{ color: p.track }}
          />
          <CircularProgress
            variant="determinate"
            value={value}
            size={54}
            thickness={4.5}
            aria-hidden="true"
            sx={{
              color: p.color,
              position: "absolute",
              left: 0,
              transform: "rotate(-90deg)",
              "& .MuiCircularProgress-circle": { strokeLinecap: "round" },
            }}
          />
          <Box
            sx={{
              inset: 0,
              position: "absolute",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography sx={{ color: p.color, fontSize: "0.82rem", fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {value}%
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ color: p.color, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }}>
          {p.label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
