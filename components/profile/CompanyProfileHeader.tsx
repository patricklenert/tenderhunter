import { Box, Chip, Stack, Typography } from "@mui/material";
import { MapPin, Users, Award } from "lucide-react";
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
}

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
}: CompanyProfileHeaderProps) {
  const locationParts = [
    regions.length > 0 ? regions.join(", ") : null,
    address,
  ].filter(Boolean);

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
        <CompanyLogo src={logoUrl} name={name} size={56} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "1.375rem", md: "1.625rem" },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: "#0f172a",
                }}
              >
                {name}
              </Typography>
              {industry && (
                <Typography
                  sx={{
                    color: "#475569",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    mt: 0.25,
                  }}
                >
                  {industry}
                </Typography>
              )}
            </Box>

            {/* Stats group */}
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ flexShrink: 0 }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.15 }}>
                  {tenderCount}
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 500, mt: 0.25 }}>
                  Treffer
                </Typography>
              </Box>
              {bestFit !== null && (
                <>
                  <Box sx={{ width: 1, height: 28, bgcolor: "#e2e8f0" }} />
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: "1.375rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.15 }}>
                      {bestFit}%
                    </Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 500, mt: 0.25 }}>
                      Bester Fit
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Box>

          {description && (
            <Typography
              sx={{
                color: "#334155",
                fontSize: "0.8125rem",
                lineHeight: 1.65,
                mt: 1.5,
                mb: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </Typography>
          )}

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {capabilities.map((cap) => (
              <Chip
                key={cap}
                label={cap}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  bgcolor: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  "& .MuiChip-label": { px: 1 },
                }}
              />
            ))}
            {certifications.map((cert) => (
              <Chip
                key={cert}
                icon={<Award size={12} />}
                label={cert}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  bgcolor: "#f8d8d2",
                  color: "#b34d3d",
                  border: "1px solid #f0b8ac",
                  borderRadius: "6px",
                  "& .MuiChip-label": { px: 1 },
                  "& .MuiChip-icon": { ml: 0.5 },
                }}
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            {locationParts.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                <MapPin size={13} color="#64748b" />
                <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                  {locationParts.join(" · ")}
                </Typography>
              </Box>
            )}
            {teamSize && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                <Users size={13} color="#64748b" />
                <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                  {teamSize} Mitarbeiter
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
