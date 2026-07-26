"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Alert,
  Chip,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Calendar,
  AlertTriangle,
  Gavel,
  Clock,
  CheckCircle2,
} from "lucide-react";

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

function istWochenende(d: Date): boolean {
  const tag = d.getDay();
  return tag === 0 || tag === 6;
}

function naechsterWerktag(d: Date): Date {
  const r = new Date(d);
  while (istWochenende(r)) {
    r.setTime(r.getTime() + MS_PRO_TAG);
  }
  return r;
}

export default function RuegefristRechner() {
  const [kenntnisDatum, setKenntnisDatum] = useState<string>("");
  const [antwDatum, setAntwDatum] = useState<string>("");

  const ruege = useMemo(() => {
    if (!kenntnisDatum) return null;
    const parsed = new Date(kenntnisDatum);
    if (isNaN(parsed.getTime())) return null;

    const frist = addiereTage(kenntnisDatum, 14);
    let endgueltig = frist;
    if (istWochenende(frist)) {
      endgueltig = naechsterWerktag(frist);
    }
    const jetzt = new Date();
    const verbleibend = tageZwischen(endgueltig, jetzt);

    return { frist, endgueltig, verbleibend, verschoben: endgueltig.getTime() !== frist.getTime() };
  }, [kenntnisDatum]);

  const nachpruef = useMemo(() => {
    if (!antwDatum) return null;
    const parsed = new Date(antwDatum);
    if (isNaN(parsed.getTime())) return null;

    const frist = addiereTage(antwDatum, 15);
    let endgueltig = frist;
    if (istWochenende(frist)) {
      endgueltig = naechsterWerktag(frist);
    }
    const jetzt = new Date();
    const verbleibend = tageZwischen(endgueltig, jetzt);

    return { frist, endgueltig, verbleibend, verschoben: endgueltig.getTime() !== frist.getTime() };
  }, [antwDatum]);

  return (
    <Stack spacing={4}>
      {/* Schritt 1: Rügefrist */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip label="Schritt 1" size="small" color="primary" sx={{ fontWeight: 700 }} />
          <Typography variant="h6" component="h2" fontWeight={700}>
            Rügefrist (§ 160 Abs. 3 Satz 1 GWB)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: "75ch" }}>
          Sie haben einen Vergabeverstoß erkannt? Dann müssen Sie diesen innerhalb von{" "}
          <strong>14 Kalendertagen</strong> beim Auftraggeber rügen.
        </Typography>
        <TextField
          fullWidth
          size="medium"
          type="date"
          label="Datum der Kenntnis vom Verstoß"
          value={kenntnisDatum}
          onChange={(e) => setKenntnisDatum(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: "1.15rem", fontWeight: 600 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Calendar size={20} color="#667288" />
              </InputAdornment>
            ),
          }}
        />

        {ruege && (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap", gap: 2 }}>
              <AlertTriangle
                size={28}
                color={ruege.verbleibend < 0 ? "#c62828" : ruege.verbleibend <= 3 ? "#ed6c02" : "#2e7d32"}
              />
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: 1 }}>
                  Rügefrist endet am
                </Typography>
                <Typography variant="h5" component="p" fontWeight={800}>
                  {formatDeDatum(ruege.endgueltig)}
                </Typography>
              </Box>
              <Box sx={{ ml: { xs: 0, md: "auto" } }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                  Noch
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={ruege.verbleibend < 0 ? "error.main" : ruege.verbleibend <= 3 ? "warning.main" : "success.main"}
                >
                  {ruege.verbleibend < 0 ? "Abgelaufen" : `${ruege.verbleibend} Tage`}
                </Typography>
              </Box>
            </Stack>
            {ruege.verschoben && (
              <Alert severity="info" sx={{ mt: 2, py: 1 }}>
                <Typography variant="caption">
                  Der 14. Tag fällt auf ein Wochenende. Die Frist verlängert sich nach § 193 BGB auf den nächsten Werktag.
                </Typography>
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Schritt 2: Nachprüfungsantragsfrist */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip label="Schritt 2" size="small" color="secondary" sx={{ fontWeight: 700 }} />
          <Typography variant="h6" component="h2" fontWeight={700}>
            Nachprüfungsantragsfrist (§ 160 Abs. 3 Satz 4 GWB)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: "75ch" }}>
          Der Auftraggeber hat Ihre Rüge abgelehnt („nicht abgeholfen“)? Sie haben{" "}
          <strong>15 Kalendertage</strong> für den Nachprüfungsantrag beim Vergabesenat.
        </Typography>
        <TextField
          fullWidth
          size="medium"
          type="date"
          label="Datum der Mitteilung (nicht abgeholfen)"
          value={antwDatum}
          onChange={(e) => setAntwDatum(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: "1.15rem", fontWeight: 600 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Calendar size={20} color="#667288" />
              </InputAdornment>
            ),
          }}
        />

        {nachpruef && (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap", gap: 2 }}>
              <Gavel
                size={28}
                color={nachpruef.verbleibend < 0 ? "#c62828" : nachpruef.verbleibend <= 3 ? "#ed6c02" : "#2e7d32"}
              />
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: 1 }}>
                  Nachprüfungsfrist endet am
                </Typography>
                <Typography variant="h5" component="p" fontWeight={800}>
                  {formatDeDatum(nachpruef.endgueltig)}
                </Typography>
              </Box>
              <Box sx={{ ml: { xs: 0, md: "auto" } }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                  Noch
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={nachpruef.verbleibend < 0 ? "error.main" : nachpruef.verbleibend <= 3 ? "warning.main" : "success.main"}
                >
                  {nachpruef.verbleibend < 0 ? "Abgelaufen" : `${nachpruef.verbleibend} Tage`}
                </Typography>
              </Box>
            </Stack>
            {nachpruef.verschoben && (
              <Alert severity="info" sx={{ mt: 2, py: 1 }}>
                <Typography variant="caption">
                  Der 15. Tag fällt auf ein Wochenende. Die Frist verlängert sich nach § 193 BGB auf den nächsten Werktag.
                </Typography>
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Hinweis */}
      <Alert severity="warning" icon={<Clock size={20} />}>
        <Typography variant="body2">
          <strong>Wichtig:</strong> Verstreichen diese Fristen ungenutzt, ist der Vergabenachprüfungsantrag{" "}
          <strong>unzulässig</strong> (§ 160 Abs. 3 Satz 1 GWB). Die Fristen sind absolut – es gibt keine Verlängerung.
        </Typography>
      </Alert>
    </Stack>
  );
}
