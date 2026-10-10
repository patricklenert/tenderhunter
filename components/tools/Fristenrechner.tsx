"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Chip,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Gavel,
  FileText,
  Handshake,
} from "lucide-react";

type Verfahren =
  | "offenEU"
  | "nichtoffenEU"
  | "verhandlungEU"
  | "uvgOStandard"
  | "uvgOKomplex";

interface VerfahrenConfig {
  label: string;
  icon: typeof Gavel;
  minFrist: number | null;
  gesetz: string;
  beschreibung: string;
  hinweis: string;
}

const VERFAHREN: Record<Verfahren, VerfahrenConfig> = {
  offenEU: {
    label: "Offen (EU/VgV)",
    icon: Gavel,
    minFrist: 35,
    gesetz: "§ 15 Abs. 2 VgV",
    beschreibung: "Offenes Verfahren oberhalb EU-Schwellenwert",
    hinweis: "Mindestens 35 Kalendertage ab Absendung der Bekanntmachung. Die konkrete Bekanntmachung kann eine längere Frist vorsehen.",
  },
  nichtoffenEU: {
    label: "Nicht offen (EU/VgV)",
    icon: FileText,
    minFrist: 30,
    gesetz: "§ 16 Abs. 2 VgV",
    beschreibung: "Beschränktes Verfahren, Frist für Teilnahmeantrag",
    hinweis: "Mindestens 30 Kalendertage für den Teilnahmeantrag. Für die anschließende Angebotsphase gelten eigene Vorgaben.",
  },
  verhandlungEU: {
    label: "Verhandlung (EU/VgV)",
    icon: Handshake,
    minFrist: 30,
    gesetz: "§ 17 Abs. 2 VgV",
    beschreibung: "Verhandlungsverfahren mit Teilnahmewettbewerb",
    hinweis: "Mindestens 30 Kalendertage für den Teilnahmeantrag. Die Angebotsfrist richtet sich nach den Umständen des Verfahrens.",
  },
  uvgOStandard: {
    label: "UVgO Standard",
    icon: FileText,
    minFrist: null,
    gesetz: "§ 13 Abs. 1 UVgO",
    beschreibung: "Unterschwellenvergabe, angemessene Frist",
    hinweis: "Die UVgO schreibt keine einheitliche Zahl von Kalendertagen vor. Die Angebotsfrist muss angemessen sein und steht in den Vergabeunterlagen.",
  },
  uvgOKomplex: {
    label: "UVgO Komplex",
    icon: FileText,
    minFrist: null,
    gesetz: "§ 13 Abs. 1 UVgO",
    beschreibung: "Unterschwellenvergabe, komplexe Leistung",
    hinweis: "Auch bei komplexen Leistungen gibt es nach der UVgO keine pauschale gesetzliche Mindestzahl. Die Frist muss dem Auftrag angemessen sein.",
  },
};

const MS_PRO_TAG = 86400000;
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function formatDeDatum(d: Date): string {
  return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

function heute(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

function addiereTage(datumStr: string, tage: number): Date {
  const [y, m, t] = datumStr.split("-").map(Number);
  const d = new Date(y, m - 1, t);
  return new Date(d.getTime() + tage * MS_PRO_TAG);
}

function tageZwischen(from: Date, to: Date): number {
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((f.getTime() - t.getTime()) / MS_PRO_TAG);
}

export default function Fristenrechner() {
  const [verfahren, setVerfahren] = useState<Verfahren>("offenEU");
  const [datumInput, setDatumInput] = useState<string>(heute());

  const result = useMemo(() => {
    const parsed = new Date(datumInput);
    if (isNaN(parsed.getTime())) return null;

     const cfg = VERFAHREN[verfahren];
     if (cfg.minFrist === null) return null;
    const abgabeDatum = addiereTage(datumInput, cfg.minFrist);
    const jetzt = new Date();
    const verbleibend = tageZwischen(abgabeDatum, jetzt);

    return { cfg, abgabeDatum, verbleibend };
  }, [datumInput, verfahren]);

  return (
    <Stack spacing={4}>
      {/* Eingabe */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
        <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 3 }}>
          1. Vergabeverfahren wählen
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={verfahren}
          onChange={(_, v) => v && setVerfahren(v)}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 1,
            width: "100%",
            "& .MuiToggleButton-root": {
              border: 1,
              borderColor: "divider",
              borderRadius: "8px !important",
              p: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 1,
              textTransform: "none",
              textAlign: "left",
            },
            "& .Mui-selected": {
              bgcolor: "primary.50 !important",
              borderColor: "primary.main !important",
            },
          }}
        >
          {(Object.entries(VERFAHREN) as [Verfahren, VerfahrenConfig][]).map(([key, cfg]) => {
            const CfgIcon = cfg.icon;
            return (
              <ToggleButton key={key} value={key}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CfgIcon size={18} color="#e9644d" />
                  <Typography variant="body2" fontWeight={600}>
                    {cfg.label}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", lineHeight: 1.3 }}>
                  {cfg.beschreibung}
                </Typography>
                <Chip
                  size="small"
                   label={cfg.minFrist === null ? "angemessene Frist" : `mind. ${cfg.minFrist} Tage`}
                  sx={{ mt: 0.5, fontSize: "0.7rem", fontWeight: 600, bgcolor: "grey.100" }}
                />
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>

        <Typography variant="h6" component="h2" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
          2. Datum der Bekanntmachung
        </Typography>
        <TextField
          fullWidth
          size="medium"
          type="date"
          value={datumInput}
          onChange={(e) => setDatumInput(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: "1.25rem", fontWeight: 600 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Calendar size={20} color="#667288" />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Tag, an dem die Bekanntmachung versandt bzw. veröffentlicht wurde.
        </Typography>
      </Paper>

      {/* Ergebnis */}
      {result && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            border: 2,
            borderColor: result.verbleibend < 0 ? "error.main" : result.verbleibend <= 7 ? "warning.main" : "success.main",
            bgcolor: result.verbleibend < 0 ? "error.50" : result.verbleibend <= 7 ? "warning.50" : "success.50",
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: "wrap", gap: 2 }}>
            <Clock
              size={32}
              color={result.verbleibend < 0 ? "#c62828" : result.verbleibend <= 7 ? "#ed6c02" : "#2e7d32"}
            />
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: 1 }}>
                Frühester Abgabetermin
              </Typography>
              <Typography variant="h5" component="p" fontWeight={800}>
                {formatDeDatum(result.abgabeDatum)}
              </Typography>
            </Box>
            <Box sx={{ ml: { xs: 0, md: "auto" } }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                Zeit bleibt
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                color={result.verbleibend < 0 ? "error.main" : result.verbleibend <= 7 ? "warning.main" : "success.main"}
              >
                {result.verbleibend < 0 ? "Abgelaufen" : `${result.verbleibend} Tage`}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <CheckCircle2 size={18} color="#2e7d32" style={{ flexShrink: 0, marginTop: 3 }} />
              <Typography variant="body2" color="text.secondary">
                {result.cfg.hinweis}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <AlertCircle size={18} color="#667288" style={{ flexShrink: 0, marginTop: 3 }} />
              <Typography variant="body2" color="text.secondary">
                <strong>Achtung:</strong> Dies ist die <strong>gesetzliche Mindestfrist</strong>. Die tatsächliche
                Frist kann durch den Auftraggeber <strong>verlängert</strong> werden und steht in der Bekanntmachung.
                Maßgeblich ist immer die dort angegebene Uhrzeit und das Datum.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      )}
      {datumInput && !result && VERFAHREN[verfahren].minFrist === null && (
        <Alert severity="info">
          <strong>Keine pauschale Berechnung möglich:</strong> Nach § 13 Abs. 1 UVgO muss die Angebotsfrist angemessen
          sein. Maßgeblich ist die konkrete Frist in den Vergabeunterlagen.
        </Alert>
      )}
    </Stack>
  );
}
