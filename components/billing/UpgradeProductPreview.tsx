import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ListChecks,
  ShieldAlert,
} from "lucide-react";

const REVIEW_ITEMS = [
  {
    icon: ClipboardCheck,
    label: "Profil-Passung",
    value: "85 %",
    detail: "Leistungsumfang und Referenzen passen sehr gut.",
    color: "#2e7d32",
  },
  {
    icon: CheckCircle2,
    label: "Muss-Kriterien",
    value: "3 von 4",
    detail: "Nur Umweltzertifizierung fehlt.",
    color: "#ed6c02",
  },
  {
    icon: ShieldAlert,
    label: "Risiken",
    value: "Niedrig",
    detail: "Fristen realistisch, Haftung im Rahmen.",
    color: "#2e7d32",
  },
  {
    icon: ListChecks,
    label: "Nächste Schritte",
    value: "2 offen",
    detail: "Zertifizierung klären, Kalkulation vorbereiten.",
    color: "#ed6c02",
  },
] as const;

export function UpgradeProductPreview() {
  return (
    <Box
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        boxShadow: "0 25px 60px rgba(45,53,68,0.10), 0 4px 16px rgba(45,53,68,0.06)",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: "#2d3544",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ff5f57" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#febc2e" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28c840" }} />
        </Box>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", ml: 1, fontSize: "0.7rem" }}>
          tenderhunter.com/pro/tender/6674
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5}>
          <Box>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.1em", fontSize: "0.65rem" }}>
              Arbeitsansicht · Gebäudereinigung
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.25, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
              Gebäudereinigung für öffentliche Einrichtungen
            </Typography>
          </Box>
          <Chip
            label="Go"
            size="small"
            sx={{
              bgcolor: "#e8f5e9",
              color: "#2e7d32",
              fontWeight: 800,
              fontSize: "0.8rem",
              height: 28,
              px: 0.5,
            }}
          />
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: "#f1f8e9",
              border: 1,
              borderColor: "#c5e1a5",
            }}
          >
            <Typography variant="caption" fontWeight={800} sx={{ color: "#33691e", fontSize: "0.7rem" }}>
              Fit-Score
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: "#33691e", lineHeight: 1, fontSize: "1.5rem" }}>
              82
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
              Profil passt gut · 2 offene Punkte klären
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1.5 }}>
          {REVIEW_ITEMS.map(({ icon: Icon, label, value, detail, color }) => (
            <Box
              key={label}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Icon size={14} style={{ color, flexShrink: 0 }} />
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.7rem", lineHeight: 1.3 }}>
                  {label}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5, color, lineHeight: 1, fontSize: "1.1rem" }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontSize: "0.65rem", lineHeight: 1.3 }}>
                {detail}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
            Nächste Schritte
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {[
              "Umweltzertifizierung bei zuständiger Stelle anfragen",
              "Angebotskalkulation auf Basis der Leistungsbeschreibung",
            ].map((step, i) => (
              <Stack key={step} direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    bgcolor: "primary.light",
                    color: "primary.dark",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                <Typography variant="caption" sx={{ fontSize: "0.7rem", lineHeight: 1.3 }}>
                  {step}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              opacity: 0.5,
            }}
          >
            <FileText size={12} />
            <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>Brief-Export</Typography>
          </Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              opacity: 0.5,
            }}
          >
            <ListChecks size={12} />
            <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>Matrix-Export</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
