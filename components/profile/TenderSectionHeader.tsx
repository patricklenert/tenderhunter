import { Box, Chip, Stack, Typography } from "@mui/material";
import { BarChart3, BriefcaseBusiness, MapPin, RefreshCw } from "lucide-react";
import { settings } from "@/lib/config";
import type { ProfileSummary } from "@/lib/public-profile";

interface TenderSectionHeaderProps {
  count: number;
  summary: ProfileSummary;
}

const summaryLabelSx = {
  display: "flex",
  alignItems: "center",
  gap: 0.55,
  color: "text.secondary",
  fontSize: "0.66rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const summaryChipSx = {
  height: 25,
  bgcolor: "background.default",
  color: "text.secondary",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  fontSize: "0.68rem",
  fontWeight: 650,
  "& .MuiChip-label": { px: 0.85 },
};

export function TenderSectionHeader({ count, summary }: TenderSectionHeaderProps) {
  const updateCadence = settings.publicScrapeIntervalHours === 24
    ? "in der Regel täglich"
    : `in der Regel alle ${settings.publicScrapeIntervalHours} Stunden`;
  const total = summary.fitDistribution.high + summary.fitDistribution.medium + summary.fitDistribution.low;

  return (
    <Box component="header" sx={{ mb: 1.75 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" gap={1.25}>
        <Box>
          <Typography
            id="profile-matches-heading"
            component="h2"
            sx={{ fontSize: { xs: "1.2rem", md: "1.35rem" }, fontWeight: 750, letterSpacing: "-0.025em", color: "text.primary", lineHeight: 1.2 }}
          >
            {count} {count === 1 ? "passender Treffer" : "passende Treffer"}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.4 }}>
            Sortiert nach Fit, Gewinnchance und Frist.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.7,
            px: 1.1,
            py: 0.8,
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            color: "text.secondary",
          }}
        >
          <RefreshCw size={13} aria-hidden="true" />
          <Box>
            <Typography sx={{ color: "text.primary", fontSize: "0.68rem", fontWeight: 750, lineHeight: 1.1 }}>
              Automatische Aktualisierung
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.67rem", mt: 0.25 }}>
              Neue Treffer {updateCadence}
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1.15fr 1fr 1.35fr" },
          gap: { xs: 1.25, sm: 0 },
          mt: 2,
          p: { xs: 1.5, sm: 1.75 },
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box sx={{ pr: { sm: 1.75 }, borderRight: { sm: "1px solid" }, borderColor: "divider" }}>
          <Typography sx={summaryLabelSx}>
            <BarChart3 size={13} aria-hidden="true" />
            Fit-Verteilung
          </Typography>
          <Box role="img" sx={{ display: "flex", height: 7, overflow: "hidden", borderRadius: 99, bgcolor: "background.default", mt: 1.2 }} aria-label={`${summary.fitDistribution.high} hohe, ${summary.fitDistribution.medium} mittlere und ${summary.fitDistribution.low} niedrige Fits`}>
            {[
              { key: "high", count: summary.fitDistribution.high, color: "success.main" },
              { key: "medium", count: summary.fitDistribution.medium, color: "warning.main" },
              { key: "low", count: summary.fitDistribution.low, color: "text.secondary" },
            ].map((segment) => (
              <Box key={segment.key} sx={{ width: total > 0 ? `${(segment.count / total) * 100}%` : 0, bgcolor: segment.color, transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.short }) }} />
            ))}
          </Box>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 0.85 }}>
            <Typography sx={{ color: "success.main", fontSize: "0.68rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Stark {summary.fitDistribution.high}</Typography>
            <Typography sx={{ color: "warning.main", fontSize: "0.68rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Solide {summary.fitDistribution.medium}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>Offen {summary.fitDistribution.low}</Typography>
          </Stack>
        </Box>

        <Box sx={{ px: { sm: 1.75 }, borderRight: { sm: "1px solid" }, borderColor: "divider" }}>
          <Typography sx={summaryLabelSx}>
            <MapPin size={13} aria-hidden="true" />
            Regionen
          </Typography>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {summary.resultRegions.length > 0 ? summary.resultRegions.map((region) => (
              <Chip
                key={region.label}
                label={region.count > 0 ? `${region.label} · ${region.count}` : region.label}
                size="small"
                sx={summaryChipSx}
              />
            )) : (
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.35 }}>Keine Region erfasst</Typography>
            )}
          </Stack>
        </Box>

        <Box sx={{ pl: { sm: 1.75 } }}>
          <Typography sx={summaryLabelSx}>
            <BriefcaseBusiness size={13} aria-hidden="true" />
            Relevante Leistungsbereiche
          </Typography>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {summary.relevantCapabilities.length > 0 ? summary.relevantCapabilities.map((capability) => (
              <Chip key={capability} label={capability} size="small" sx={summaryChipSx} />
            )) : (
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.35 }}>Keine Leistungen erfasst</Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
