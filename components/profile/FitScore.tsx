"use client";

import { Box, Tooltip, Typography } from "@mui/material";

interface FitScoreProps {
  value: number;
}

const palette = {
  high: { color: "#15803d" },
  medium: { color: "#b45309" },
  low: { color: "#475569" },
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
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          minWidth: 52,
          cursor: "help",
        }}
      >
        <Typography
          sx={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: p.color,
            lineHeight: 1.15,
          }}
        >
          {value}%
        </Typography>
        <Typography
          sx={{
            fontSize: "0.6rem",
            fontWeight: 600,
            color: p.color,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            lineHeight: 1,
            mt: 0.25,
          }}
        >
          Fit
        </Typography>
      </Box>
    </Tooltip>
  );
}
