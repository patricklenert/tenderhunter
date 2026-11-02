"use client";

import { Box, CircularProgress, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { FIT_SCORE_LEVELS, getFitScoreTier } from "@/lib/fit-score";

interface FitScoreProps {
  value: number;
  variant?: "ring" | "bar";
}

export function FitScore({ value, variant = "ring" }: FitScoreProps) {
  const p = FIT_SCORE_LEVELS[getFitScoreTier(value)];

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
        sx={variant === "bar"
          ? { width: "100%", cursor: "help" }
          : {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.35,
            minWidth: 58,
            cursor: "help",
          }}
      >
        {variant === "bar" ? (
          <Box aria-hidden="true">
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
              <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Passung
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.65}>
                <Typography sx={{ color: p.color, fontSize: "0.82rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {value}%
                </Typography>
                <Typography sx={{ color: p.color, fontSize: "0.68rem", fontWeight: 700 }}>
                  {p.label}
                </Typography>
              </Stack>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={value}
              sx={{
                mt: 0.75,
                height: 6,
                borderRadius: 1,
                bgcolor: p.trackColor,
                "& .MuiLinearProgress-bar": { borderRadius: 1, bgcolor: p.color },
              }}
            />
          </Box>
        ) : (
          <>
            <Box sx={{ position: "relative", display: "inline-flex" }} aria-hidden="true">
              <CircularProgress
                variant="determinate"
                value={100}
                size={54}
                thickness={4.5}
                sx={{ color: p.trackColor }}
              />
              <CircularProgress
                variant="determinate"
                value={value}
                size={54}
                thickness={4.5}
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
            <Typography sx={{ color: p.color, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }} aria-hidden="true">
              {p.label}
            </Typography>
          </>
        )}
      </Box>
    </Tooltip>
  );
}
