import { Box, Typography } from "@mui/material";

interface TenderSectionHeaderProps {
  count: number;
}

export function TenderSectionHeader({ count }: TenderSectionHeaderProps) {
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
    </Box>
  );
}
