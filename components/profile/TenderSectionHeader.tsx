import { Box, Typography } from "@mui/material";
import { settings } from "@/lib/config";

interface TenderSectionHeaderProps {
  count: number;
}

export function TenderSectionHeader({ count }: TenderSectionHeaderProps) {
  const updateCadence = settings.publicScrapeIntervalHours === 24
    ? "täglich"
    : `in der Regel alle ${settings.publicScrapeIntervalHours} Stunden`;

  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: "1.25rem", md: "1.375rem" },
          fontWeight: 700,
          color: "#1e293b",
          mb: 0.25,
        }}
      >
        {count} {count === 1 ? "Passende Ausschreibung" : "Passende Ausschreibungen"}
      </Typography>
      <Typography sx={{ color: "#64748b", fontSize: "0.8125rem" }}>
        Sortiert nach Übereinstimmung mit dem Unternehmensprofil.
      </Typography>
      <Box
        sx={{
          mt: 1.25,
          p: 1.25,
          borderRadius: 1.5,
          border: "1px solid #dbe5ef",
          bgcolor: "#f1f5f9",
        }}
      >
        <Typography sx={{ color: "#334155", fontSize: "0.8125rem", fontWeight: 700, mb: 0.25 }}>
          Automatische Aktualisierung
        </Typography>
        <Typography sx={{ color: "#475569", fontSize: "0.8125rem" }}>
          Neue passende Ausschreibungen werden {updateCadence} ergänzt und automatisch auf dieser Seite angezeigt.
        </Typography>
      </Box>
    </Box>
  );
}
