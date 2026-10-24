import { Box, Stack, Typography } from "@mui/material";
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

export function UpgradeProductPreview() {
  return (
    <Box
      component="figure"
      aria-label="Beispielansicht einer Tenderhunter-Analyse"
      sx={{
        m: 0,
        overflow: "hidden",
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ px: { xs: 2.5, sm: 4 }, pt: { xs: 2.5, sm: 3.5 }, pb: { xs: 2.25, sm: 3 } }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.11em", fontSize: "0.65rem" }}
        >
          Beispielanalyse
        </Typography>
        <Typography
          component="h2"
          variant="h5"
          fontWeight={700}
          sx={{ mt: 0.6, fontSize: { xs: "1.15rem", sm: "1.35rem" }, letterSpacing: "-0.02em" }}
        >
          Gebäudereinigung für öffentliche Einrichtungen
        </Typography>
      </Box>

      <Box
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: { xs: 3, sm: 4.5 },
          bgcolor: "background.default",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 3, sm: 4 }} alignItems={{ sm: "center" }}>
          <Box
            sx={{
              flexShrink: 0,
              width: { xs: "100%", sm: "auto" },
              minWidth: { sm: 150 },
              px: { xs: 2, sm: 2.5 },
              py: { xs: 1.75, sm: 2 },
              borderRadius: 2,
              bgcolor: "warning.light",
              color: "warning.dark",
            }}
          >
            <ShieldAlert size={20} strokeWidth={2} aria-hidden="true" />
            <Typography sx={{ mt: 0.7, fontSize: "1.25rem", lineHeight: 1.15, fontWeight: 700 }}>
              Prüfen
            </Typography>
            <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontWeight: 700, lineHeight: 1.35 }}>
              1 Muss-Kriterium offen
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em", fontSize: "0.62rem" }}
            >
              Fit-Score
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.45 }}>
              <Typography
                component="div"
                sx={{
                  fontSize: { xs: "3.5rem", sm: "4rem" },
                  lineHeight: 0.95,
                  letterSpacing: "-0.06em",
                  fontWeight: 800,
                  color: "success.main",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                82
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>
                / 100
              </Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 1, lineHeight: 1.35, color: "success.main" }}>
              Stark
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 2.5, sm: 3 }, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 4 }}>
          <Insight icon={<ShieldAlert size={17} />} title="Umweltzertifizierung fehlt" detail="Muss-Kriterium noch offen" tone="warning" />
          <Insight icon={<CheckCircle2 size={17} />} title="Risiko: niedrig" detail="Fristen und Haftung im Rahmen" tone="success" />
        </Stack>

        <Box sx={{ mt: { xs: 2.5, sm: 3 }, pt: { xs: 2, sm: 2.25 }, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={800}>
              Nächster Schritt
            </Typography>
            <ArrowRight size={16} style={{ color: "var(--mui-palette-primary-main)" }} aria-hidden="true" />
            <Typography variant="body2" fontWeight={700} sx={{ color: "primary.main" }}>
              Zertifizierung klären
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function Insight({
  icon,
  title,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone: "warning" | "success";
}) {
  const isSuccess = tone === "success";

  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: isSuccess ? "success.light" : "warning.light",
          color: isSuccess ? "success.dark" : "warning.dark",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.4 }}>
          {detail}
        </Typography>
      </Box>
    </Stack>
  );
}
