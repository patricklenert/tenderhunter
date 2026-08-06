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
  tenderCount: number;
  bestFit: number | null;
  expiredCount: number;
}

const chipSx = {
  height: 26,
  borderRadius: "7px",
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
  const activeCount = Math.max(tenderCount - expiredCount, 0);
  const locationParts = [
    regions.slice(0, 3).join(", "),
    address,
  ].filter(Boolean);

  return (
    <Box
      sx={{
        mb: 0,
        p: { xs: 2, sm: 2.5, md: 3 },
        bgcolor: "#f8fbfc",
        border: "1px solid #d7e3ea",
        borderRadius: "18px",
        boxShadow: "0 12px 28px rgba(45, 53, 68, 0.07)",
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
                color: "#8b5a50",
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
                color: "#263242",
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
                  bgcolor: "#e8eff4",
                  color: "#405368",
                  border: "1px solid #d5e1e8",
                  "& .MuiChip-icon": { color: "#667b8e", ml: 0.7 },
                }}
              />
            )}
            {description && (
              <Typography
                sx={{
                  maxWidth: "68ch",
                  color: "#4e5e70",
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

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(2, 132px)" },
            gap: 1,
            width: { xs: "100%", md: "auto" },
          }}
        >
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#eef4f7",
              border: "1px solid #d8e4ea",
              borderRadius: "11px",
            }}
          >
            <Typography sx={{ color: "#667288", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Treffer
            </Typography>
            <Typography sx={{ color: "#263242", fontSize: "1.8rem", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1, mt: 0.65 }}>
              {tenderCount}
            </Typography>
            <Typography sx={{ color: "#667288", fontSize: "0.7rem", mt: 0.6 }}>
              {expiredCount > 0 ? `${activeCount} aktiv · ${expiredCount} abgelaufen` : "mit offener Frist"}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#f8e9e5",
              border: "1px solid #f0d0c9",
              borderRadius: "11px",
            }}
          >
            <Typography sx={{ color: "#9b5a4e", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Bester Fit
            </Typography>
            <Typography sx={{ color: "#a94f40", fontSize: "1.8rem", fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1, mt: 0.65 }}>
              {bestFit === null ? "–" : `${bestFit}%`}
            </Typography>
            <Typography sx={{ color: "#9b5a4e", fontSize: "0.7rem", mt: 0.6 }}>
              höchste Übereinstimmung
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 2.25, md: 2.5 }, pt: 1.75, borderTop: "1px solid #e0e9ee" }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {capabilities.slice(0, 5).map((capability) => (
            <Chip
              key={`capability-${capability}`}
              label={capability}
              size="small"
              sx={{
                ...chipSx,
                bgcolor: "#f1f5f7",
                color: "#4b5d6d",
                border: "1px solid #dbe5eb",
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
                bgcolor: "#f8e9e5",
                color: "#a94f40",
                border: "1px solid #f0d0c9",
                "& .MuiChip-icon": { color: "#b86657", ml: 0.7 },
              }}
            />
          ))}
        </Stack>

        {(locationParts.length > 0 || teamSize) && (
          <Stack direction="row" spacing={{ xs: 1.25, sm: 2.5 }} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 1.5 }}>
            {locationParts.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                <MapPin size={14} color="#718296" aria-hidden="true" />
                <Typography sx={{ color: "#526476", fontSize: "0.76rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {locationParts.join(" · ")}
                </Typography>
              </Box>
            )}
            {teamSize && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                <Users size={14} color="#718296" aria-hidden="true" />
                <Typography sx={{ color: "#526476", fontSize: "0.76rem" }}>
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
