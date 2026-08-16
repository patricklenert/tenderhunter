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
        borderRadius: 3,
        bgcolor: "background.paper",
        boxShadow: "0 32px 80px rgba(45,53,68,0.12), 0 8px 24px rgba(45,53,68,0.06)",
        border: "1px solid rgba(209,213,219,0.72)",
        transform: { md: "perspective(1200px) rotateY(-1.5deg)" },
        transition: "transform 0.4s ease, box-shadow 0.4s ease",
        "&:hover": {
          transform: { md: "perspective(1200px) rotateY(0deg)" },
          boxShadow: "0 36px 90px rgba(45,53,68,0.14), 0 10px 28px rgba(45,53,68,0.07)",
        },
      }}
    >
      <Box sx={{ px: { xs: 2.5, sm: 4 }, pt: { xs: 2.5, sm: 3.5 }, pb: { xs: 2.25, sm: 3 } }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.11em", fontSize: "0.65rem" }}
        >
          Tenderhunter Analyse
        </Typography>
        <Typography
          component="h2"
          variant="h5"
          fontWeight={700}
          sx={{ mt: 0.6, fontSize: { xs: "1.15rem", sm: "1.35rem" }, letterSpacing: "-0.02em" }}
        >
          Gebäudereinigung für öffentliche Einrichtungen
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>
          Vergabe-Nr. 2024-0847 · Stadtverwaltung Musterstadt
        </Typography>
      </Box>

      <Box
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: { xs: 3, sm: 4.5 },
          bgcolor: "rgba(232,239,245,0.42)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 3, sm: 4 }} alignItems={{ sm: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0, borderLeft: "3px solid", borderColor: "primary.main", pl: { xs: 2, sm: 2.5 } }}>
            <Typography
              variant="overline"
              sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em", fontSize: "0.62rem" }}
            >
              Fit-Score
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.45 }}>
              <Typography
                component="div"
                sx={{ fontSize: { xs: "4.5rem", sm: "5.5rem" }, lineHeight: 0.88, letterSpacing: "-0.08em", fontWeight: 800, color: "text.primary" }}
              >
                82
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>
                / 100
              </Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 1.2, lineHeight: 1.35, maxWidth: 310 }}>
              Gute Übereinstimmung – 1 Muss-Kriterium noch zu klären.
            </Typography>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              minWidth: { sm: 150 },
              px: { xs: 2.5, sm: 3 },
              py: { xs: 2, sm: 2.5 },
              borderRadius: 2.5,
              bgcolor: "#e8f5e9",
              color: "#2e7d32",
            }}
          >
            <CheckCircle2 size={24} strokeWidth={2.25} aria-hidden="true" />
            <Typography sx={{ mt: 0.6, fontSize: "1.8rem", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 800 }}>
              Go
            </Typography>
            <Typography variant="caption" sx={{ display: "block", mt: 0.7, color: "#33691e", fontWeight: 700, lineHeight: 1.35 }}>
              Profil passt gut
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 2.5, sm: 3 }, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 4 }}>
          <Insight icon={<ShieldAlert size={17} />} title="Umweltzertifizierung fehlt" detail="1 Muss-Kriterium offen" tone="accent" />
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
  tone: "accent" | "success";
}) {
  const isSuccess = tone === "success";

  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.75,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: isSuccess ? "#e8f5e9" : "primary.light",
          color: isSuccess ? "#2e7d32" : "primary.main",
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
