"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  type SelectChangeEvent,
} from "@mui/material";
import {
  Close,
  OpenInNew,
  RocketLaunch,
  Save,
} from "@mui/icons-material";
import { TRACKED_TENDER_STATUSES, TRACKED_TENDER_STATUS_LABELS, type TrackedTenderStatus } from "@/lib/tracked-tender-types";

export interface TenderDetailItem {
  id: number;
  title: string;
  source: string;
  url: string | null;
  fit: number;
  winProbability: number;
  effort: number;
  requirementCoverage: number;
  killSwitch: boolean;
  explanation: string | null;
  actions: string[];
  missingItems: string[];
  details: {
    domainMatch: number;
    requirementCoverage: number;
    regionMatch: number;
    sizeMatch: number;
    complexity: number;
    locationStatus?: "match" | "mismatch" | "tender_location_unknown" | "company_location_unknown";
    locationReason?: string;
    tenderBundesland?: string;
    tenderCity?: string;
    locationSource?: string;
    domainStatus?: "match" | "mismatch" | "domain_unknown";
    domainReason?: string;
    domainSource?: string;
  } | null;
  procurement?: {
    contractValueMin: number | null;
    contractValueMax: number | null;
    contractDurationMonths: number | null;
    procedureType: string | null;
    awardCriteria: { criterion: string; weight: number | null }[];
    participationRequirements: string[];
    cpvCodes: string[];
  } | null;
}

export interface TenderWorkflowDraft {
  status: TrackedTenderStatus;
  owner: string | null;
  deadlineAt: string | null;
  notes: string;
}

export type FollowState = "idle" | "saving" | "done" | "error";
export type WorkflowSaveState = "idle" | "saving" | "saved" | "error";

interface TenderDetailDrawerProps {
  tender: TenderDetailItem;
  companyId: number | null;
  companyName: string;
  followState?: FollowState;
  followError?: string | null;
  onFollow?: (tender: TenderDetailItem) => void;
  workflow?: TenderWorkflowDraft | null;
  workflowSaveState?: WorkflowSaveState;
  workflowError?: string | null;
  onSaveWorkflow?: (draft: TenderWorkflowDraft) => void;
  onClose: () => void;
}

const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

const toDisplayDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

type MetricColor = "success" | "warning" | "primary";

function resolveMetricColor(value: number, accent: boolean): MetricColor {
  if (accent) {
    if (value >= 75) return "primary";
    if (value >= 50) return "warning";
    return "primary";
  }
  if (value >= 75) return "success";
  if (value >= 50) return "primary";
  if (value >= 25) return "warning";
  return "primary";
}

function MetricBar({ value, accent = false }: { value: number; accent?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  const muiColor = resolveMetricColor(value, accent);
  const isLow = accent ? value < 50 : value < 25;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={clamped}
          color={isLow ? undefined : muiColor}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: "rgba(148,163,184,0.15)",
            "& .MuiLinearProgress-bar": isLow
              ? { backgroundColor: "text.disabled" }
              : undefined,
          }}
        />
      </Box>
      <Box
        component="span"
        sx={{
          width: 40,
          textAlign: "right",
          fontSize: "0.875rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}%
      </Box>
    </Box>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        component="span"
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          mt: 1,
          fontSize: "1.5rem",
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Box>
    </Paper>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: "rgba(148,163,184,0.08)",
        px: 1.5,
        py: 1,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          mt: 0.5,
          fontSize: "0.875rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function TagList({ items, emptyLabel }: { items?: string[]; emptyLabel: string }) {
  if (!items || items.length === 0) {
    return (
      <Box component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
        {emptyLabel}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {items.map((item) => (
        <Chip key={item} label={item} size="small" variant="filled" />
      ))}
    </Box>
  );
}

export function TenderDetailDrawer({
  tender,
  companyId,
  companyName,
  followState = "idle",
  followError = null,
  onFollow,
  workflow,
  workflowSaveState = "idle",
  workflowError = null,
  onSaveWorkflow,
  onClose,
}: TenderDetailDrawerProps) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<TenderWorkflowDraft | null>(
    workflow ? { ...workflow, deadlineAt: toDateInputValue(workflow.deadlineAt) } : null,
  );

  useEffect(() => {
    setDraft(workflow ? { ...workflow, deadlineAt: toDateInputValue(workflow.deadlineAt) } : null);
  }, [workflow, tender.id]);

  const followDisabled = companyId === null || followState === "saving" || followState === "done";
  const followLabel =
    followState === "saving"
      ? "Wird gespeichert"
      : followState === "done"
        ? "Wird verfolgt"
        : "Ausschreibung verfolgen";

  const showFollowCard = typeof onFollow === "function";
  const showWorkflowEditor = draft !== null && typeof onSaveWorkflow === "function";

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleExited = () => {
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleDrawerClose}
      SlideProps={{ onExited: handleExited }}
      sx={{
        "& .MuiDrawer-paper": {
          width: { xs: "100%", sm: 672 },
          maxWidth: "100%",
        },
      }}
    >
      <Stack sx={{ height: "100%", overflow: "hidden" }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "rgba(30,41,59,0.95)",
            backdropFilter: "blur(8px)",
            px: 2.5,
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                }}
              >
                Trefferdetails
              </Box>
              <Box
                component="h2"
                sx={{
                  mt: 1,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {tender.title || `Ausschreibung #${tender.id}`}
              </Box>
              <Box sx={{ mt: 1, fontSize: "0.875rem", color: "text.secondary" }}>
                {companyName ? `Passend fuer ${companyName}` : tender.source}
              </Box>
            </Box>
            <IconButton
              onClick={handleDrawerClose}
              size="small"
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 3 }}>
          <Stack spacing={3}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <Chip label={tender.source} color="primary" size="small" />
              {tender.killSwitch ? (
                <Chip label="Stopp-Signal" color="error" size="small" />
              ) : (
                <Chip label="Freigegeben" color="success" size="small" />
              )}
              {workflow ? (
                <Chip label={TRACKED_TENDER_STATUS_LABELS[workflow.status]} color="info" size="small" />
              ) : null}
              {workflow?.deadlineAt ? (
                <Chip label={`Frist ${toDisplayDate(workflow.deadlineAt)}`} variant="outlined" size="small" />
              ) : null}
            </Box>

            {showFollowCard ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", lg: "row" },
                    alignItems: { lg: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                      }}
                    >
                      Aktion
                    </Box>
                    <Box sx={{ mt: 1, fontSize: "0.875rem" }}>
                      Markiere diesen Treffer direkt als aktiv verfolgte Ausschreibung.
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    startIcon={<RocketLaunch />}
                    onClick={() => onFollow(tender)}
                    disabled={followDisabled}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {followLabel}
                  </Button>
                </Box>

                {followState === "done" ? (
                  <Box sx={{ mt: 1.5, fontSize: "0.875rem", color: "success.main" }}>
                    Der Treffer wurde als verfolgt gespeichert.
                  </Box>
                ) : null}
                {followState === "error" && followError ? (
                  <Box sx={{ mt: 1.5, fontSize: "0.875rem", color: "error.main" }}>{followError}</Box>
                ) : null}
                {companyId === null ? (
                  <Box sx={{ mt: 1.5, fontSize: "0.875rem", color: "text.secondary" }}>
                    Tracking ist erst verfuegbar, wenn ein Unternehmensprofil vorhanden ist.
                  </Box>
                ) : null}
              </Paper>
            ) : null}

            {showWorkflowEditor && draft ? (
              <Box
                component="form"
                sx={{
                  p: 2.5,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 4,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const deadlineAt = draft.deadlineAt
                    ? new Date(`${draft.deadlineAt}T00:00:00.000Z`).toISOString()
                    : null;
                  onSaveWorkflow({
                    status: draft.status,
                    owner: draft.owner?.trim() ? draft.owner.trim() : null,
                    deadlineAt,
                    notes: draft.notes.trim(),
                  });
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                      }}
                    >
                      Arbeitsstand
                    </Box>
                    <Box sx={{ mt: 1, fontSize: "0.875rem" }}>
                      Halte Status, Verantwortlichkeit, Frist und Notizen direkt am Treffer fest.
                    </Box>
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<Save />}
                    disabled={workflowSaveState === "saving"}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {workflowSaveState === "saving" ? "Speichert" : "Stand speichern"}
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={draft.status}
                      label="Status"
                      onChange={(event: SelectChangeEvent) =>
                        setDraft((current) =>
                          current
                            ? { ...current, status: event.target.value as TrackedTenderStatus }
                            : current,
                        )
                      }
                    >
                      {TRACKED_TENDER_STATUSES.map((status) => (
                        <MenuItem key={status} value={status}>
                          {TRACKED_TENDER_STATUS_LABELS[status]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Verantwortlich"
                    value={draft.owner ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, owner: event.target.value } : current,
                      )
                    }
                    placeholder="z. B. GF, Vertrieb, Bid-Team"
                    fullWidth
                  />

                  <TextField
                    label="Frist"
                    type="date"
                    value={draft.deadlineAt ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, deadlineAt: event.target.value } : current,
                      )
                    }
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>

                <TextField
                  label="Notizen"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  multiline
                  minRows={5}
                  placeholder="Naechste Geschaeftsfuehrer-Entscheidung, Risiken, fehlende Rueckmeldungen, Ansprechpartner ..."
                  fullWidth
                />

                {workflowSaveState === "saved" ? (
                  <Box sx={{ fontSize: "0.875rem", color: "success.main" }}>
                    Der Arbeitsstand wurde gespeichert.
                  </Box>
                ) : null}
                {workflowSaveState === "error" && workflowError ? (
                  <Box sx={{ fontSize: "0.875rem", color: "error.main" }}>{workflowError}</Box>
                ) : null}
              </Box>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", xl: "1fr 1fr 1fr 1fr" },
                gap: 1.5,
              }}
            >
              <SummaryCard label="Passung" value={`${tender.fit}%`} />
              <SummaryCard label="Gewinnchance" value={`${tender.winProbability}%`} />
              <SummaryCard label="Deckung" value={`${tender.requirementCoverage}%`} />
              <SummaryCard label="Aufwand" value={`${tender.effort}%`} />
            </Box>

            <Stack spacing={1.5}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  component="span"
                  sx={{
                    width: 96,
                    flexShrink: 0,
                    fontSize: "0.75rem",
                    color: "text.secondary",
                  }}
                >
                  Passung
                </Box>
                <Box sx={{ flex: 1 }}>
                  <MetricBar value={tender.fit} />
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  component="span"
                  sx={{
                    width: 96,
                    flexShrink: 0,
                    fontSize: "0.75rem",
                    color: "text.secondary",
                  }}
                >
                  Gewinnchance
                </Box>
                <Box sx={{ flex: 1 }}>
                  <MetricBar value={tender.winProbability} accent />
                </Box>
              </Box>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                bgcolor: "rgba(148,163,184,0.04)",
              }}
            >
              <Box
                component="span"
                sx={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 1,
                }}
              >
                Kurzbewertung
              </Box>
              <Box sx={{ fontSize: "0.875rem", lineHeight: 1.625 }}>
                {tender.explanation ??
                  "Diese Begruendung wird noch von der Pipeline erzeugt oder ist fuer historische Daten nicht vorhanden."}
              </Box>
            </Paper>

            {tender.url ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    mb: 1,
                  }}
                >
                  Quelle
                </Box>
                <Link
                  href={tender.url}
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                  sx={{
                    display: "inline-flex",
                    alignItems: "flex-start",
                    gap: 1,
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    wordBreak: "break-all",
                  }}
                >
                  <Box component="span">{tender.url}</Box>
                  <OpenInNew sx={{ mt: 0.25, fontSize: "1rem", flexShrink: 0 }} />
                </Link>
              </Paper>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                gap: 2,
              }}
            >
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    mb: 1.5,
                  }}
                >
                  Naechste Schritte
                </Box>
                {tender.actions.length === 0 ? (
                  <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                    Noch keine Empfehlungen verfuegbar.
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {tender.actions.map((action, index) => (
                      <Box key={action} sx={{ display: "flex", gap: 1.5 }}>
                        <Box
                          component="span"
                          sx={{
                            mt: 0.25,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "primary.main",
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ fontSize: "0.875rem", lineHeight: 1.625 }}>{action}</Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    mb: 1.5,
                  }}
                >
                  Fehlende Unterlagen
                </Box>
                <TagList items={tender.missingItems} emptyLabel="Keine offenen Pflichtunterlagen erkannt." />
              </Paper>
            </Box>

            {tender.details ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    mb: 1.5,
                  }}
                >
                  Scoring-Faktoren
                </Box>
                {tender.details.locationStatus && tender.details.locationStatus !== "match" ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderColor: "warning.main",
                      bgcolor: "warning.light",
                    }}
                  >
                    <Box sx={{ fontSize: "0.875rem", fontWeight: 700, color: "warning.dark" }}>
                      Standortprüfung
                    </Box>
                    <Box sx={{ mt: 0.5, fontSize: "0.875rem", color: "text.secondary" }}>
                      {tender.details.locationReason ?? "Der Ausführungsort ist nicht mit dem Einsatzgebiet abgeglichen."}
                    </Box>
                  </Paper>
                ) : null}
                {tender.details.domainStatus && tender.details.domainStatus !== "match" ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderColor: "error.main",
                      bgcolor: "error.light",
                    }}
                  >
                    <Box sx={{ fontSize: "0.875rem", fontWeight: 700, color: "error.dark" }}>
                      Fachliche Prüfung
                    </Box>
                    <Box sx={{ mt: 0.5, fontSize: "0.875rem", color: "text.secondary" }}>
                      {tender.details.domainReason ?? "Die Leistungsart passt nicht zu den hinterlegten Kernleistungen."}
                    </Box>
                  </Paper>
                ) : null}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", xl: "1fr 1fr 1fr" },
                    gap: 1,
                  }}
                >
                  <DetailMetric label="Domaenenfit" value={`${tender.details.domainMatch}%`} />
                  <DetailMetric label="Deckung" value={`${tender.details.requirementCoverage}%`} />
                  <DetailMetric label="Region" value={`${tender.details.regionMatch}%`} />
                  <DetailMetric label="Groesse" value={`${tender.details.sizeMatch}%`} />
                  <DetailMetric label="Komplexitaet" value={`${tender.details.complexity}%`} />
                  {tender.details.tenderBundesland ? (
                    <DetailMetric label="Ausführungsort" value={tender.details.tenderCity ? `${tender.details.tenderCity}, ${tender.details.tenderBundesland}` : tender.details.tenderBundesland} />
                  ) : null}
                </Box>
              </Paper>
            ) : null}

            {tender.procurement ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    mb: 1.5,
                  }}
                >
                  Vergabedaten
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr" },
                    gap: 1.5,
                    mb: 2,
                  }}
                >
                  {tender.procurement.contractValueMax ? (
                    <DetailMetric
                      label="Auftragswert"
                      value={
                        tender.procurement.contractValueMin
                          ? `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(tender.procurement.contractValueMin)} - ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(tender.procurement.contractValueMax)}`
                          : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(tender.procurement.contractValueMax)
                      }
                    />
                  ) : null}
                  {tender.procurement.contractDurationMonths ? (
                    <DetailMetric
                      label="Vertragslaufzeit"
                      value={`${tender.procurement.contractDurationMonths} Monate`}
                    />
                  ) : null}
                  {tender.procurement.procedureType ? (
                    <DetailMetric
                      label="Verfahrensart"
                      value={tender.procurement.procedureType}
                    />
                  ) : null}
                </Box>

                {tender.procurement.awardCriteria.length > 0 ? (
                  <Box sx={{ mb: 2 }}>
                    <Box
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                        mb: 1,
                      }}
                    >
                      Zuschlagskriterien
                    </Box>
                    <Stack spacing={0.5}>
                      {tender.procurement.awardCriteria.map((criterion) => (
                        <Box key={criterion.criterion} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                          <Box>{criterion.criterion}</Box>
                          <Box sx={{ fontWeight: 600, color: "primary.main" }}>
                            {criterion.weight !== null ? `${criterion.weight}%` : "n/a"}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {tender.procurement.participationRequirements.length > 0 ? (
                  <Box sx={{ mb: 2 }}>
                    <Box
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                        mb: 1,
                      }}
                    >
                      Teilnahmevoraussetzungen
                    </Box>
                    <TagList items={tender.procurement.participationRequirements} emptyLabel="Keine Voraussetzungen erkannt." />
                  </Box>
                ) : null}

                {tender.procurement.cpvCodes.length > 0 ? (
                  <Box>
                    <Box
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                        mb: 1,
                      }}
                    >
                      CPV-Codes
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {tender.procurement.cpvCodes.map((code) => (
                        <Chip key={code} label={code} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Paper>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}
