"use client";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

interface PaywallPanelProps {
  feature: string;
  title?: string;
  description?: string;
}

export function PaywallPanel({ feature, title, description }: PaywallPanelProps) {
  const isBidPack = feature === "Bid Pack";
  const resolvedTitle = title ?? (isBidPack ? "Nicht nur lesen. Entscheidung vorbereiten." : "Mehr aus dieser Ausschreibung machen");
  const resolvedDescription = description ?? (isBidPack
    ? "Erhalte eine persönliche Go-/No-Go-Analyse, erkenne fehlende Anforderungen und erstelle die nächsten Aufgaben für dein Team."
    : `${feature} ist im aktiven Billing-Plan enthalten. Starte mit $12 pro Woche oder $39 für 3 Monate.`);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={`${feature} Premium-Zugang`}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        borderColor: "primary.light",
        bgcolor: "primary.light",
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: "background.paper",
            color: "primary.main",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <LockKeyhole size={19} aria-hidden="true" />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {resolvedTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 620 }}>
            {resolvedDescription}
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/upgrade"
          variant="contained"
          endIcon={<ArrowRight size={16} />}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          {isBidPack ? "Bid Pack freischalten" : "Pläne ansehen"}
        </Button>
      </Stack>
    </Paper>
  );
}
