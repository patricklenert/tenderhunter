import { Box, Chip, Stack, Typography } from "@mui/material";
import { Award, BriefcaseBusiness, MapPin, Users } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo";

interface CompanyProfileHeaderProps {
  name: string;
  industry: string | null;
  description: string | null;
  logoUrl: string | null;
  capabilities: string[];
  certifications: string[];
  regions: string[];
  teamSize: number | null;
  address: string | null;
  tenderCount?: number;
  bestFit?: number | null;
  expiredCount?: number;
}

const chipSx = {
  height: 26,
  borderRadius: 1,
  fontSize: "0.7rem",
  fontWeight: 600,
  "& .MuiChip-label": { px: 1 },
};

export function CompanyProfileHeader({
  name,
  industry,
  description,
  logoUrl,
  capabilities,
  certifications,
  regions,
  teamSize,
  address,
  tenderCount,
  bestFit,
  expiredCount,
}: CompanyProfileHeaderProps) {
  const activeCount = Math.max((tenderCount ?? 0) - (expiredCount ?? 0), 0);
  const bestFitState = bestFit == null
    ? { color: "text.secondary", backgroundColor: "background.default", label: "Nicht bewertet" }
    : bestFit >= 70
      ? { color: "success.main", backgroundColor: "success.light", label: "Stark" }
      : bestFit >= 40
        ? { color: "warning.main", backgroundColor: "warning.light", label: "Solide" }
        : { color: "text.secondary", backgroundColor: "background.default", label: "Offen" };
  const locationParts = [
    regions.slice(0, 3).join(", "),
    address,
  ].filter(Boolean);

  return (
    <Box
      sx={{
        mb: 0,
        p: { xs: 2, sm: 2.5, md: 3 },
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
          alignItems: "start",
          gap: { xs: 2.5, md: 3 },
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 2 }} alignItems={{ xs: "flex-start", sm: "center" }}>
          <CompanyLogo src={logoUrl} name={name} size={80} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.68rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                mb: 0.5,
              }}
            >
              Unternehmensprofil
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.55rem", md: "2rem" },
                fontWeight: 750,
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
                color: "text.primary",
              }}
            >
              {name}
            </Typography>
            {industry && (
              <Chip
                icon={<BriefcaseBusiness size={13} aria-hidden="true" />}
                label={industry}
                size="small"
                sx={{
                  ...chipSx,
                  mt: 1,
                  bgcolor: "background.default",
                  color: "text.secondary",
                  border: "1px solid",
                  borderColor: "divider",
                  "& .MuiChip-icon": { color: "text.secondary", ml: 0.7 },
                }}
              />
            )}
            {description && (
              <Typography
                sx={{
                  maxWidth: "68ch",
                  color: "text.secondary",
                  fontSize: { xs: "0.82rem", md: "0.875rem" },
                  lineHeight: 1.65,
                  mt: 1.25,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </Stack>

        {tenderCount !== undefined && bestFit !== undefined && expiredCount !== undefined && <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(2, 152px)" },
            gap: 1,
            width: { xs: "100%", md: "auto" },
          }}
        >
          <Box
            sx={{
              p: 1.5,
              bgcolor: "background.default",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Treffer
            </Typography>
            <Typography sx={{ color: "text.primary", fontSize: "1.8rem", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1, mt: 0.65, fontVariantNumeric: "tabular-nums" }}>
              {tenderCount}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.7rem", mt: 0.6 }}>
              {expiredCount > 0 ? `${activeCount} aktiv · ${expiredCount} abgelaufen` : "mit offener Frist"}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              bgcolor: bestFitState.backgroundColor,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography sx={{ color: bestFitState.color, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Bester Fit
            </Typography>
            <Typography sx={{ color: bestFitState.color, fontSize: "1.8rem", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1, mt: 0.65, fontVariantNumeric: "tabular-nums" }}>
              {bestFit === null ? "–" : `${bestFit}%`}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.7rem", mt: 0.6 }}>
              {bestFitState.label}
            </Typography>
          </Box>
        </Box>}
      </Box>

      <Box sx={{ mt: { xs: 2.25, md: 2.5 }, pt: 1.75, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {capabilities.slice(0, 5).map((capability) => (
            <Chip
              key={`capability-${capability}`}
              label={capability}
              size="small"
              sx={{
                ...chipSx,
                bgcolor: "background.default",
                color: "text.secondary",
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          ))}
          {certifications.slice(0, 3).map((certification) => (
            <Chip
              key={`certification-${certification}`}
              icon={<Award size={13} aria-hidden="true" />}
              label={certification}
              size="small"
              sx={{
                ...chipSx,
                bgcolor: "info.light",
                color: "info.dark",
                border: "1px solid",
                borderColor: "divider",
                "& .MuiChip-icon": { color: "info.main", ml: 0.7 },
              }}
            />
          ))}
        </Stack>

        {(locationParts.length > 0 || teamSize) && (
          <Stack direction="row" spacing={{ xs: 1.25, sm: 2.5 }} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 1.5 }}>
            {locationParts.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0, color: "text.secondary" }}>
                <MapPin size={14} aria-hidden="true" />
                <Typography sx={{ color: "inherit", fontSize: "0.76rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {locationParts.join(" · ")}
                </Typography>
              </Box>
            )}
            {teamSize && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                <Users size={14} aria-hidden="true" />
                <Typography sx={{ color: "inherit", fontSize: "0.76rem" }}>
                  {teamSize} Mitarbeiter
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
