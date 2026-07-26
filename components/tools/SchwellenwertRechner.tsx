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
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Info,
  Building2,
  Truck,
  HardHat,
  HeartPulse,
  Factory,
} from "lucide-react";

type Leistungstyp =
  | "bau"
  | "lieferDienstZentral"
  | "lieferDienstSonst"
  | "sektorenBau"
  | "sektorenLieferDienst"
  | "sozialeDienste";

interface SchwelleConfig {
  label: string;
  icon: typeof Building2;
  threshold: number;
  lawAbove: string;
  lawBelow: string;
  beschreibung: string;
}

const SCHWELLEN: Record<Leistungstyp, SchwelleConfig> = {
  bau: {
    label: "Bauarbeiten",
    icon: HardHat,
    threshold: 5_538_000,
    lawAbove: "VgV / § 99 GWB (Oberschwelle)",
    lawBelow: "UVgO oder Landesvergaberecht (Unterschwwelle)",
    beschreibung: "Bauaufträge für allgemeine Auftraggeber (Bund, Länder, Gemeinden)",
  },
  lieferDienstZentral: {
    label: "Lieferung/Dienst (zentral)",
    icon: Truck,
    threshold: 221_000,
    lawAbove: "VgV / § 99 GWB (Oberschwelle)",
    lawBelow: "UVgO oder Landesvergaberecht (Unterschwelle)",
    beschreibung: "Liefer- und Dienstleistungen über zentrale Beschaffungsstellen",
  },
  lieferDienstSonst: {
    label: "Lieferung/Dienst (sonstige)",
    icon: Building2,
    threshold: 143_000,
    lawAbove: "VgV / § 99 GWB (Oberschwelle)",
    lawBelow: "UVgO oder Landesvergaberecht (Unterschwelle)",
    beschreibung: "Liefer- und Dienstleistungen für sonstige Auftraggeber",
  },
  sektorenBau: {
    label: "Sektoren-Bau",
    icon: Factory,
    threshold: 5_538_000,
    lawAbove: "SektVO / § 100 GWB (Sektoren)",
    lawBelow: "SektVO unterschwellig (freie Verfahrenswahl)",
    beschreibung: "Bauaufträge von Sektorenauftraggebern (Energie, Wasser, Verkehr)",
  },
  sektorenLieferDienst: {
    label: "Sektoren Lief./Dienst",
    icon: Factory,
    threshold: 443_000,
    lawAbove: "SektVO / § 100 GWB (Sektoren)",
    lawBelow: "SektVO unterschwellig (freie Verfahrenswahl)",
    beschreibung: "Liefer-/Dienstleistungen von Sektorenauftraggebern",
  },
  sozialeDienste: {
    label: "Soziale Dienste",
    icon: HeartPulse,
    threshold: 443_000,
    lawAbove: "VgV § 135 (besondere Dienste, nur Bekanntmachung)",
    lawBelow: "Freihändig (keine Bekanntmachungspflicht)",
    beschreibung: "Soziale, gesundheitliche und kulturelle Dienstleistungen (§ 130 GWB)",
  },
};

function formatEUR(n: number): string {
  return n.toLocaleString("de-DE") + " €";
}

export default function SchwellenwertRechner() {
  const [typ, setTyp] = useState<Leistungstyp>("bau");
  const [betrag, setBetrag] = useState<string>("");

  const betragNummer = useMemo(() => {
    const cleaned = betrag.replace(/[^\d,\.]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }, [betrag]);

  const config = SCHWELLEN[typ];
  const isAbove = betragNummer >= config.threshold;
  const hasInput = betragNummer > 0;
  const Icon = config.icon;

  return (
    <Stack spacing={4}>
      {/* Eingabe */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
        <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 3 }}>
          1. Leistungstyp wählen
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={typ}
          onChange={(_, v) => v && setTyp(v)}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
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
          {(Object.entries(SCHWELLEN) as [Leistungstyp, SchwelleConfig][]).map(([key, cfg]) => {
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
                  label={`ab ${formatEUR(cfg.threshold)}`}
                  sx={{ mt: 0.5, fontSize: "0.7rem", fontWeight: 600, bgcolor: "grey.100" }}
                />
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>

        <Typography variant="h6" component="h2" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
          2. Auftragswert eingeben (netto)
        </Typography>
        <TextField
          fullWidth
          autoFocus
          size="medium"
          type="text"
          inputMode="decimal"
          placeholder="z. B. 250.000"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: "1.25rem", fontWeight: 600 } }}
          InputProps={{
            endAdornment: <InputAdornment position="end">€</InputAdornment>,
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {config.beschreibung}. Schwellenwert für diesen Typ: <strong>{formatEUR(config.threshold)}</strong>
        </Typography>
      </Paper>

      {/* Ergebnis */}
      {hasInput && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            border: 2,
            borderColor: isAbove ? "success.main" : "warning.main",
            bgcolor: isAbove ? "success.50" : "warning.50",
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            {isAbove ? <TrendingUp size={32} color="#2e7d32" /> : <TrendingDown size={32} color="#ed6c02" />}
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: 1 }}>
                Ergebnis
              </Typography>
              <Typography variant="h5" component="p" fontWeight={800}>
                {isAbove ? "Oberschwwellenvergabe" : "Unterschwwellenvergabe"}
              </Typography>
            </Box>
            <Box sx={{ ml: "auto", textAlign: "right" }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                Ihr Auftragswert
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatEUR(betragNummer)}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Anwendbares Vergaberecht
              </Typography>
              <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
                {isAbove ? config.lawAbove : config.lawBelow}
              </Typography>
            </Box>

            {isAbove ? (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <CheckCircle2 size={18} color="#2e7d32" style={{ flexShrink: 0, marginTop: 3 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Europaweite Bekanntmachung</strong> im TED (Supplement zum Amtsblatt der EU) ist verpflichtend.
                  Das offene Verfahren ist das Standardverfahren; auftragsbezogene Ausnahmen möglich.
                </Typography>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Info size={18} color="#ed6c02" style={{ flexShrink: 0, marginTop: 3 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Keine EU-Bekanntmachungspflicht.</strong> Vergeben wird nach UVgO (Bund) oder dem jeweiligen
                  Landesvergaberecht. Freie Verfahrenswahl, Bekanntmachung interregional empfohlen.
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {/* Rechtlicher Hinweis */}
      <Alert severity="info" sx={{ "& .MuiAlert-message": { fontSize: "0.875rem" } }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Stand: Schwellenwerte 2024–2025</strong> gemäß Verordnung (EU) 2022/2577. Die Schwellenwerte werden
          alle zwei Jahre von der EU-Kommission angepasst. Für die genaue Einordnung im Einzelfall beachten Sie die
          jeweils geltenden Schwellenwerte zum Zeitpunkt der Bekanntmachung.
        </Typography>
      </Alert>
    </Stack>
  );
}
