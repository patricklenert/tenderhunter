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
  borderRadius: "7px",
  bgcolor: "#f3f6f8",
  color: "#596a7b",
  border: "1px solid #e0e8ed",
  fontSize: "0.7rem",
  fontWeight: 600,
  "& .MuiChip-label": { px: 0.9 },
  "& .MuiChip-icon": { color: "#7a8b9b", ml: 0.65 },
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
        borderColor: isExpired ? "#dce2e7" : "#d6e1e8",
        borderRadius: "13px",
        textDecoration: "none",
        color: "inherit",
        bgcolor: isExpired ? "#f3f5f6" : "#fbfcfd",
        opacity: isExpired ? 0.76 : 1,
        boxShadow: isExpired ? "none" : "0 3px 10px rgba(45, 53, 68, 0.045)",
        transition: "border-color 180ms ease-out, background-color 180ms ease-out, box-shadow 180ms ease-out, transform 180ms ease-out",
        "&:hover": {
          borderColor: isExpired ? "#cbd5dc" : "#bdcdd7",
          bgcolor: isExpired ? "#f1f3f4" : "#ffffff",
          boxShadow: isExpired ? "none" : "0 8px 18px rgba(45, 53, 68, 0.08)",
          transform: isExpired ? "none" : "translateY(-1px)",
          "& .tender-chevron": { transform: "translateX(3px)", opacity: 0.9 },
        },
        "&:focus-visible": {
          outline: "3px solid rgba(233, 100, 77, 0.3)",
          outlineOffset: "3px",
          borderColor: "#e9644d",
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
              color: isExpired ? "#687786" : "#263242",
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
              bgcolor: isExpired ? "#e9edf0" : "#e5f3e9",
              color: isExpired ? "#7b8793" : "#277544",
              border: isExpired ? "1px solid #dce2e7" : "1px solid #c9e6d1",
              fontSize: "0.66rem",
              fontWeight: 750,
              "& .MuiChip-icon": { color: isExpired ? "#909ca7" : "#3b8c56", ml: 0.6 },
              "& .MuiChip-label": { px: 0.8 },
            }}
          />
        </Stack>

        {description ? (
          <Typography
            sx={{
              color: isExpired ? "#7f8b97" : "#596a7b",
              fontSize: "0.8rem",
              lineHeight: 1.55,
              mt: 0.75,
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
          <Typography sx={{ color: "#8995a2", fontSize: "0.76rem", fontStyle: "italic", mt: 0.75 }}>
            Keine weiteren Angaben verfügbar
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
        }}
      >
        <FitScore value={fit} />
        <ChevronRight
          size={19}
          className="tender-chevron"
          aria-hidden="true"
          style={{ opacity: 0.35, transition: "transform 180ms ease-out, opacity 180ms ease-out" }}
          color="#66788a"
        />
      </Box>
    </Paper>
  );
}
