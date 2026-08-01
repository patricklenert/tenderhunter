import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { ClipboardCheck, FileText, ListChecks, ShieldAlert } from "lucide-react";

const REVIEW_AREAS = [
  { icon: ClipboardCheck, label: "Passung", detail: "Leistungsumfang und Eignung mit Ihrem Unternehmensprofil abgleichen" },
  { icon: ListChecks, label: "Muss-Kriterien", detail: "Pflichtpunkte und fehlende Nachweise markieren" },
  { icon: ShieldAlert, label: "Risiken", detail: "Ausschlüsse, Fristen und offene Punkte prüfen" },
];

export function UpgradeProductPreview() {
  return (
    <Paper
      component="figure"
      variant="outlined"
      aria-labelledby="product-preview-title"
      sx={{
        m: 0,
        overflow: "hidden",
        borderRadius: 2.5,
        bgcolor: "background.paper",
      }}
    >
      <Box component="figcaption" sx={{ p: { xs: 2, sm: 2.5 }, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
              Beispielansicht aus Tenderhunter Pro
            </Typography>
            <Typography id="product-preview-title" component="h2" variant="h5" fontWeight={700} sx={{ mt: 0.35 }}>
              So wird eine Ausschreibung zur Entscheidungsvorlage.
            </Typography>
          </Box>
          <Chip label="Arbeitsansicht" size="small" variant="outlined" sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: "rgba(232,239,245,0.42)" }}>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ p: { xs: 1.75, sm: 2 } }}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Ausschreibung prüfen
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.25 }}>
                Ihre ausgewählte Ausschreibung
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35 }}>
                Vergabeunterlagen und Unternehmensprofil bilden die Entscheidungsgrundlage.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip label="Entscheidung offen" size="small" />
            </Stack>
          </Stack>

          <Divider />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.1fr) minmax(280px, 0.9fr)" }, gap: { xs: 1.5, md: 2 }, p: { xs: 1.5, sm: 2 } }}>
            <Stack spacing={0.75}>
              {REVIEW_AREAS.map(({ icon: Icon, label, detail }) => (
                <Stack key={label} direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                  <Box sx={{ display: "grid", placeItems: "center", width: 30, height: 30, flexShrink: 0, borderRadius: 1, bgcolor: "primary.light", color: "primary.dark" }}>
                    <Icon size={16} aria-hidden="true" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>{detail}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: "rgba(232,239,245,0.5)", borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ShieldAlert size={17} aria-hidden="true" />
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Nächster Angebotsplan</Typography>
                  <Typography variant="caption" color="text.secondary">Die Prüfung trennt kritische Punkte von den nächsten bearbeitbaren Aufgaben.</Typography>
                </Box>
              </Stack>
              <Stack component="ol" spacing={0.85} sx={{ m: 0, mt: 1.5, pl: 2.5 }}>
                <Typography component="li" variant="body2">Kritische Muss-Kriterien prüfen</Typography>
                <Typography component="li" variant="body2">Fehlende Nachweise zuordnen</Typography>
                <Typography component="li" variant="body2">Go-/No-Go-Entscheidung vorbereiten</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                <Chip icon={<FileText size={14} />} label="Brief" size="small" variant="outlined" />
                <Chip icon={<ListChecks size={14} />} label="Matrix CSV" size="small" variant="outlined" />
              </Stack>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
            Die konkreten Werte ergeben sich aus der jeweils ausgewählten Ausschreibung und Ihrem Unternehmensprofil.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
