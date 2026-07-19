"use client";

import { Box, Paper, Stack, Typography } from "@mui/material";
import { MapPin, Euro, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDeadlineDE, daysUntil } from "@/lib/date-utils";
import { FitScore } from "./FitScore";
import { DeadlineStatus } from "./DeadlineStatus";

interface TenderCardProps {
  id: number;
  title: string;
  description: string;
  location: string | null;
  volume: string | null;
  deadline: string | null;
  fit: number;
  slug: string;
}

export function TenderCard({
  id,
  title,
  description,
  location,
  volume,
  deadline,
  fit,
  slug,
}: TenderCardProps) {
  const days = deadline ? daysUntil(deadline) : null;
  const isExpired = days !== null && days < 0;
  const hasMeta = !!(location || volume || (deadline && formatDeadlineDE(deadline)));
  const hasContent = !!(description || hasMeta);

  return (
    <Paper
      component={Link}
      href={`/ausschreibung/${id}/${slug}`}
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        border: "1px solid",
        borderColor: isExpired ? "#e2e8f0" : "#e2e8f0",
        borderRadius: "10px",
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        textDecoration: "none",
        color: "inherit",
        bgcolor: isExpired ? "#f8f9fa" : "#ffffff",
        cursor: "pointer",
        transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
        "&:hover": {
          borderColor: "#cbd5e1",
          bgcolor: isExpired ? "#f8f9fa" : "#f8fafc",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          "& .chevron": { transform: "translateX(2px)", opacity: 0.8 },
        },
        "&:focus-visible": {
          outline: "2px solid #e9644d",
          outlineOffset: "2px",
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="h3"
          sx={{
            fontWeight: 600,
            fontSize: { xs: "0.9375rem", md: "1rem" },
            lineHeight: 1.4,
            color: isExpired ? "#64748b" : "#1e293b",
            mb: description ? 0.5 : hasMeta ? 1 : 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Typography>

        {description ? (
          <Typography
            sx={{
              color: isExpired ? "#94a3b8" : "#475569",
              fontSize: "0.8125rem",
              lineHeight: 1.55,
              mb: hasMeta ? 1.25 : 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </Typography>
        ) : !hasContent ? (
          <Typography
            sx={{
              color: "#94a3b8",
              fontSize: "0.75rem",
              fontStyle: "italic",
              mt: 0.25,
            }}
          >
            Keine weiteren Angaben verfügbar
          </Typography>
        ) : null}

        {hasMeta && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
            {location && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                <MapPin size={13} color="#64748b" />
                <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                  {location}
                </Typography>
              </Box>
            )}
            {volume && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                <Euro size={13} color="#64748b" />
                <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                  {volume}
                </Typography>
              </Box>
            )}
            {deadline && formatDeadlineDE(deadline) && (
              <DeadlineStatus deadline={deadline} />
            )}
          </Stack>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, opacity: isExpired ? 0.7 : 1 }}>
        <FitScore value={fit} />
        <ChevronRight
          size={18}
          className="chevron"
          style={{ opacity: 0.3, transition: "all 0.15s" }}
          color="#64748b"
        />
      </Box>
    </Paper>
  );
}
