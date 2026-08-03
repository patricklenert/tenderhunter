import {
  Box,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ClipboardCheck, FileText, ListChecks, ShieldAlert } from "lucide-react";

const REVIEW_ROWS = [
  {
    icon: ClipboardCheck,
    label: "Passung zum Unternehmensprofil",
    status: "Profil abgleichen",
    detail: "Leistungsumfang der Gebäudereinigung mit Kapazitäten, Referenzen und Einsatzgebiet abgleichen.",
  },
  {
    icon: ListChecks,
    label: "Fehlende Muss-Kriterien",
    status: "Nachweise prüfen",
    detail: "Referenzen für öffentliche Auftraggeber und geforderte Unterlagen in den Vergabeunterlagen verifizieren.",
  },
  {
    icon: ShieldAlert,
    label: "Erkennbare Risiken",
    status: "Risiken klären",
    detail: "Fristen, Reinigungsumfang und Haftungsanforderungen vor einer Zusage aus den Unterlagen prüfen.",
  },
  {
    icon: ListChecks,
    label: "Priorisierte nächste Schritte",
    status: "Zuerst bearbeiten",
    detail: "Offene Muss-Kriterien und Profilabgleich vor der Go-/No-Go-Entscheidung zusammenführen.",
  },
] as const;

const NEXT_STEPS = [
  {
    title: "Muss-Kriterien aus den Unterlagen prüfen",
    detail: "Ausschlussgründe und notwendige Nachweise zuerst klären.",
  },
  {
    title: "Unternehmensprofil dagegen halten",
    detail: "Kapazitäten, Referenzen und Einsatzgebiet mit der Leistung abgleichen.",
  },
  {
    title: "Go-/No-Go vorbereiten",
    detail: "Risiken und offene Punkte für die Teamentscheidung zusammenführen.",
  },
] as const;

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
      <Box component="figcaption" sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
          Tenderhunter Pro · Arbeitsbeispiel
        </Typography>
        <Typography id="product-preview-title" component="h2" variant="h5" fontWeight={700} sx={{ mt: 0.35, maxWidth: 780 }}>
          Sie sehen nicht nur die Ausschreibung, sondern erhalten eine prüfbare Entscheidungsvorlage.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.85, maxWidth: 720, lineHeight: 1.55 }}>
          Eine illustrative Arbeitsansicht zeigt, wie Tenderhunter Vergabeunterlagen und Unternehmensprofil in konkrete Prüfpunkte und nächste Schritte übersetzt.
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.5, md: 3 }} justifyContent="space-between" alignItems={{ md: "flex-start" }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Beispiel-Ausschreibung
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Illustratives Beispiel
              </Typography>
            </Stack>
            <Typography component="h3" variant="h6" fontWeight={700} sx={{ mt: 0.3, overflowWrap: "anywhere" }}>
              Gebäudereinigung für öffentliche Einrichtungen
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>
              Vergabeunterlagen und Unternehmensprofil in einer Arbeitsansicht.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexShrink: 0, maxWidth: { xs: "100%", md: 250 } }}>
            <ShieldAlert size={18} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
            <Box>
              <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing="0.08em">
                Entscheidungsstatus
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
                Weitere Prüfung erforderlich
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.35fr) minmax(260px, 0.65fr)" } }}>
        <Box component="section" aria-labelledby="preview-results-title" sx={{ minWidth: 0, p: { xs: 2, sm: 2.75 } }}>
          <Typography id="preview-results-title" component="h3" variant="subtitle1" fontWeight={700}>
            Ergebnisübersicht
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.5, lineHeight: 1.5 }}>
            Die Prüfung macht sichtbar, was vor einer Angebotsentscheidung geklärt werden muss.
          </Typography>

          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {REVIEW_ROWS.map(({ icon: Icon, label, status, detail }, index) => (
              <Box key={label} sx={{ pt: index === 0 ? 0 : 1.5, mt: index === 0 ? 0 : 1.5, borderTop: index === 0 ? 0 : 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={0.9} alignItems="flex-start">
                  <Icon size={16} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.4 }}>{label}</Typography>
                    <Typography variant="caption" color="primary.dark" fontWeight={700}>{status}</Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 2.5, lineHeight: 1.45 }}>{detail}</Typography>
              </Box>
            ))}
          </Box>

          <Table aria-label="Illustrative Tenderhunter-Ergebnisübersicht" size="small" sx={{ display: { xs: "none", md: "table" }, tableLayout: "fixed", width: "100%", "& .MuiTableCell-root": { borderColor: "divider", verticalAlign: "top", wordBreak: "break-word" }, "& .MuiTableCell-head": { color: "text.secondary", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: { xs: "34%", sm: "30%" }, pl: 0 }}>Prüfbereich</TableCell>
                <TableCell sx={{ width: { xs: "25%", sm: "24%" } }}>Arbeitsstand</TableCell>
                <TableCell sx={{ pr: 0 }}>Was sichtbar wird</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {REVIEW_ROWS.map(({ icon: Icon, label, status, detail }) => (
                <TableRow key={label}>
                  <TableCell component="th" scope="row" sx={{ pl: 0 }}>
                    <Stack direction="row" spacing={0.9} alignItems="flex-start">
                      <Icon size={16} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                      <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.4 }}>{label}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.4 }}>{status}</Typography>
                  </TableCell>
                  <TableCell sx={{ pr: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>{detail}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box component="section" aria-labelledby="preview-next-steps-title" sx={{ minWidth: 0, borderTop: { xs: 1, md: 0 }, borderLeft: { md: 1 }, borderColor: "divider", bgcolor: "rgba(232,239,245,0.32)", p: { xs: 2, sm: 2.75 } }}>
          <Typography id="preview-next-steps-title" component="h3" variant="subtitle1" fontWeight={700}>
            Priorisierte nächste Schritte
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.5 }}>
            Aus den offenen Punkten entsteht eine nachvollziehbare Reihenfolge für die Angebotsarbeit.
          </Typography>

          <Stack component="ol" spacing={1.7} sx={{ listStyle: "none", p: 0, m: 0, mt: 2 }}>
            {NEXT_STEPS.map(({ title, detail }, index) => (
              <Stack component="li" key={title} direction="row" spacing={1.1} alignItems="flex-start">
                <Box sx={{ display: "grid", placeItems: "center", width: 24, height: 24, flexShrink: 0, borderRadius: "50%", bgcolor: "primary.light", color: "primary.dark", fontSize: "0.75rem", fontWeight: 800 }}>
                  {index + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.4 }}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2, lineHeight: 1.45 }}>{detail}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>

          <Box sx={{ mt: 2.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Weitere Arbeitsausgaben
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
              <Stack direction="row" spacing={0.55} alignItems="center">
                <FileText size={15} aria-hidden="true" />
                <Typography variant="caption">Brief-Export</Typography>
              </Stack>
              <Stack direction="row" spacing={0.55} alignItems="center">
                <ListChecks size={15} aria-hidden="true" />
                <Typography variant="caption">Anforderungsmatrix-Export</Typography>
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Divider />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: { xs: 2, sm: 2.75 }, pt: { xs: 1.5, sm: 1.75 }, lineHeight: 1.5 }}>
        Konkrete Werte und Hinweise hängen von der ausgewählten Ausschreibung und Ihrem Unternehmensprofil ab.
      </Typography>
    </Paper>
  );
}
