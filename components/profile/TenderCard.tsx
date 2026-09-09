"use client";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { CheckCircle2, ChevronRight, Euro, MapPin, XCircle } from "lucide-react";
import Link from "next/link";
import { DeadlineStatus } from "./DeadlineStatus";
import { FitScore } from "./FitScore";
import type { DeadlineState } from "@/lib/date-utils";

interface TenderCardProps {
  id: number;
  title: string;
  description: string;
  location: string | null;
  volume: string | null;
  deadlineAt: string | null;
  deadlineDays: number | null;
  deadlineState: DeadlineState;
  fit: number;
  slug: string;
}

const metaChipSx = {
  height: 26,
  borderRadius: 1,
  bgcolor: "background.default",
  color: "text.secondary",
  border: "1px solid",
  borderColor: "divider",
  fontSize: "0.7rem",
  fontWeight: 600,
  "& .MuiChip-label": { px: 0.9 },
  "& .MuiChip-icon": { color: "text.secondary", ml: 0.65 },
};

export function TenderCard({
  id,
  title,
  description,
  location,
  volume,
  deadlineAt,
  deadlineDays,
  deadlineState,
  fit,
  slug,
}: TenderCardProps) {
  const isExpired = deadlineState === "expired";

  return (
    <Paper
      component={Link}
      href={`/ausschreibung/${id}/${slug}`}
      elevation={0}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: { xs: 1.75, sm: 2.25 },
        p: { xs: 1.75, sm: 2, md: 2.25 },
        minHeight: { sm: 138 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        textDecoration: "none",
        color: "inherit",
        bgcolor: isExpired ? "background.default" : "background.paper",
        opacity: isExpired ? 0.76 : 1,
        boxShadow: "none",
        transition: "border-color 180ms ease-out, background-color 180ms ease-out, transform 180ms ease-out",
        "&:hover": {
          borderColor: isExpired ? "divider" : "primary.light",
          bgcolor: isExpired ? "background.default" : "background.paper",
          transform: isExpired ? "none" : "translateY(-1px)",
          "& .tender-chevron": { transform: "translateX(3px)", opacity: 0.9 },
        },
        "&:focus-visible": {
          borderColor: "primary.main",
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, pr: { xs: 0, sm: 0 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "flex-start" }} gap={0.75}>
          <Typography
            component="h3"
            sx={{
              minWidth: 0,
              flex: 1,
              color: isExpired ? "text.secondary" : "text.primary",
              fontSize: { xs: "0.95rem", md: "1rem" },
              fontWeight: 750,
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </Typography>
          <Chip
            icon={isExpired ? <XCircle size={12} aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
            label={isExpired ? "Abgelaufen" : "Aktuell"}
            size="small"
            sx={{
              flexShrink: 0,
              height: 24,
              borderRadius: 1,
              bgcolor: isExpired ? "background.default" : "success.light",
              color: isExpired ? "text.secondary" : "success.dark",
              border: "1px solid",
              borderColor: isExpired ? "divider" : "success.light",
              fontSize: "0.66rem",
              fontWeight: 750,
              "& .MuiChip-icon": { color: isExpired ? "text.secondary" : "success.main", ml: 0.6 },
              "& .MuiChip-label": { px: 0.8 },
            }}
          />
        </Stack>

        {description ? (
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.8rem",
              lineHeight: 1.55,
              mt: 0.75,
              opacity: isExpired ? 0.8 : 1,
              maxWidth: "78ch",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </Typography>
        ) : (
          <Typography sx={{ color: "text.secondary", fontSize: "0.76rem", mt: 0.75 }}>
            –
          </Typography>
        )}

        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 1.25 }}>
          {location && (
            <Chip icon={<MapPin size={13} aria-hidden="true" />} label={location} size="small" sx={metaChipSx} />
          )}
          {volume && (
            <Chip icon={<Euro size={13} aria-hidden="true" />} label={volume} size="small" sx={metaChipSx} />
          )}
          <DeadlineStatus deadlineAt={deadlineAt} deadlineDays={deadlineDays} deadlineState={deadlineState} />
        </Stack>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, sm: 1.5 },
          flexShrink: 0,
          alignSelf: { xs: "flex-end", sm: "center" },
          mt: { xs: -0.5, sm: 0 },
          color: "text.secondary",
        }}
      >
        <FitScore value={fit} />
        <ChevronRight
          size={19}
          className="tender-chevron"
          aria-hidden="true"
          style={{ opacity: 0.35, transition: "transform 180ms ease-out, opacity 180ms ease-out" }}
          color="currentColor"
        />
      </Box>
    </Paper>
  );
}
