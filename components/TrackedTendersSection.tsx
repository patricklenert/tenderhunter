"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CircleAlert, ClipboardList, Search, UserRound } from "lucide-react";
import { formatDeadlineDE, daysUntil, deadlineLabel } from "@/lib/date-utils";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { TenderDetailDrawer, type TenderDetailItem, type TenderWorkflowDraft, type WorkflowSaveState } from "@/components/TenderDetailDrawer";
import { TRACKED_TENDER_STATUS_LABELS, type TrackedTenderStatus } from "@/lib/tracked-tender-types";

type TrackedStatusFilter = "all" | "active" | TrackedTenderStatus;

interface TrackedTenderItem {
  trackedId: number;
  tenderId: number;
  companyId: number;
  companyName: string;
  title: string;
  source: string;
  url: string | null;
  externalId: string | null;
  status: TrackedTenderStatus;
  owner: string | null;
  deadlineAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  } | null;
  qualityStatus: string;
  qualityReason: string | null;
}

interface TrackedTenderSummary {
  total: number;
  active: number;
  tracked: number;
  reviewing: number;
  submitted: number;
  won: number;
  lost: number;
  dueSoon: number;
}

interface CompanyOption {
  id: number;
  name: string;
  count: number;
}

interface TrackedTendersResponse {
  items: TrackedTenderItem[];
  summary: TrackedTenderSummary;
  companies: CompanyOption[];
}

const STATUS_FILTER_OPTIONS: Array<{ value: TrackedStatusFilter; label: string }> = [
  { value: "active", label: "Aktiv zuerst" },
  { value: "all", label: "Alle Status" },
  { value: "tracked", label: TRACKED_TENDER_STATUS_LABELS.tracked },
  { value: "reviewing", label: TRACKED_TENDER_STATUS_LABELS.reviewing },
  { value: "submitted", label: TRACKED_TENDER_STATUS_LABELS.submitted },
  { value: "won", label: TRACKED_TENDER_STATUS_LABELS.won },
  { value: "lost", label: TRACKED_TENDER_STATUS_LABELS.lost },
];

const progressColor = (value: number): "success" | "warning" | "info" => {
  if (value >= 70) return "success";
  if (value >= 40) return "warning";
  return "info";
};

const statusChipColor = (status: TrackedTenderStatus): "success" | "error" | "info" | "default" => {
  if (status === "won") return "success";
  if (status === "lost") return "error";
  if (status === "submitted") return "info";
  return "default";
};

function SummaryTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 2.5,
      }}
    >
      <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h3" component="p" fontWeight={700} sx={{ mt: 1, lineHeight: 1 }} fontFamily="monospace">
        {value}
      </Typography>
      {detail ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {detail}
        </Typography>
      ) : null}
    </Box>
  );
}

function StatusBadge({ status }: { status: TrackedTenderStatus }) {
  return (
    <Chip
      label={TRACKED_TENDER_STATUS_LABELS[status]}
      color={statusChipColor(status)}
      size="small"
      variant="filled"
    />
  );
}

function TrackedTenderCard({ item, onOpen }: { item: TrackedTenderItem; onOpen: () => void }) {
  const deadlineHint = deadlineLabel(item.deadlineAt);
  const deadlineUrgent = deadlineHint && (deadlineHint.includes("heute") || deadlineHint.includes("abgelaufen"));

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2.5, alignItems: { lg: "flex-start" }, justifyContent: "space-between" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <StatusBadge status={item.status} />
              <Chip label={item.companyName} variant="outlined" size="small" />
              <Chip label={item.source} variant="outlined" size="small" />
              {item.killSwitch ? <Chip label="Stopp-Signal" color="error" variant="filled" size="small" /> : null}
            </Stack>

            <Typography variant="h6" component="p" fontWeight={600} sx={{ mt: 1.5, lineHeight: 1.3 }}>
              {item.title}
            </Typography>

            <Grid container spacing={1} sx={{ mt: 1.5 }}>
              <Grid size={{ xs: 6, xl: 3 }}>
                <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 1 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
                    Passung
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }} fontFamily="monospace">
                    {item.fit}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={item.fit}
                    color={progressColor(item.fit)}
                    sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 6, xl: 3 }}>
                <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 1 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
                    Gewinnchance
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }} fontFamily="monospace">
                    {item.winProbability}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={item.winProbability}
                    color={progressColor(item.winProbability)}
                    sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 6, xl: 3 }}>
                <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 1 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
                    Verantwortlich
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                    {item.owner || "Noch offen"}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, xl: 3 }}>
                <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 1 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
                    Frist
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                    {formatDeadlineDE(item.deadlineAt)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 2 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  color: deadlineUrgent ? "error.main" : deadlineHint ? "warning.main" : "text.secondary",
                }}
              >
                <CalendarClock size={16} />
                <Typography variant="body2" color="inherit">
                  {deadlineHint ?? "Noch keine Frist gesetzt"}
                </Typography>
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                <UserRound size={16} />
                <Typography variant="body2" color="inherit">
                  {item.owner || "Verantwortlich definieren"}
                </Typography>
              </Box>
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 2,
                lineHeight: 1.6,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {item.notes.trim() || item.explanation || "Noch keine internen Notizen. Im Detail können Sie direkt den nächsten Bearbeitungsschritt dokumentieren."}
            </Typography>
          </Box>

          <Stack spacing={1} sx={{ width: { lg: 176 } }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<ClipboardList size={16} />}
              onClick={onOpen}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              Bearbeiten
            </Button>

            {item.url ? (
              <Button
                component="a"
                href={item.url}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                fullWidth
                startIcon={<ArrowUpRight size={16} />}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Original öffnen
              </Button>
            ) : null}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export function TrackedTendersSection() {
  const [items, setItems] = useState<TrackedTenderItem[]>([]);
  const [summary, setSummary] = useState<TrackedTenderSummary | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<TrackedStatusFilter>("active");
  const [companyFilter, setCompanyFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTender, setSelectedTender] = useState<TrackedTenderItem | null>(null);
  const [workflowSaveState, setWorkflowSaveState] = useState<WorkflowSaveState>("idle");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadTrackedTenders = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (companyFilter !== "all") {
        params.set("companyId", String(companyFilter));
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/tracked-tenders?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (TrackedTendersResponse & { error?: string }) | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Verfolgte Ausschreibungen konnten nicht geladen werden.");
      }

      if (sequence !== requestSequence.current) return;

      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSummary(payload.summary ?? null);
      setCompanies(Array.isArray(payload.companies) ? payload.companies : []);
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      setItems([]);
      setSummary(null);
      setCompanies([]);
      setError(err instanceof Error ? err.message : "Verfolgte Ausschreibungen konnten nicht geladen werden.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [companyFilter, search, statusFilter]);

  useEffect(() => {
    void loadTrackedTenders();
  }, [loadTrackedTenders]);

  useEffect(() => {
    if (!selectedTender) {
      return;
    }

    const freshItem = items.find((item) => item.companyId === selectedTender.companyId && item.tenderId === selectedTender.tenderId);
    if (freshItem) {
      setSelectedTender(freshItem);
    }
  }, [items, selectedTender]);

  const groups = useMemo(() => {
    const active = items.filter((item) => item.status === "tracked" || item.status === "reviewing" || item.status === "submitted");
    return [
      { key: "active", label: "Aktive Ausschreibungen", items: active },
      { key: "won", label: TRACKED_TENDER_STATUS_LABELS.won, items: items.filter((item) => item.status === "won") },
      { key: "lost", label: TRACKED_TENDER_STATUS_LABELS.lost, items: items.filter((item) => item.status === "lost") },
    ].filter((group) => group.items.length > 0);
  }, [items]);

  const selectedWorkflow = selectedTender
    ? {
        status: selectedTender.status,
        owner: selectedTender.owner,
        deadlineAt: selectedTender.deadlineAt,
        notes: selectedTender.notes,
      }
    : null;

  const handleSaveWorkflow = useCallback(
    async (draft: TenderWorkflowDraft) => {
      if (!selectedTender) {
        return;
      }

      setWorkflowSaveState("saving");
      setWorkflowError(null);

      try {
        const response = await fetch(`/api/tracked-tenders/${selectedTender.companyId}/${selectedTender.tenderId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: draft.status,
            owner: draft.owner,
            deadline_at: draft.deadlineAt,
            notes: draft.notes,
          }),
        });

        const payload = (await response.json().catch(() => null)) as { item?: TrackedTenderItem; error?: string } | null;
        if (!response.ok || !payload?.item) {
          throw new Error(payload?.error ?? "Arbeitsstand konnte nicht gespeichert werden.");
        }

        setSelectedTender(payload.item);
        setWorkflowSaveState("saved");
        await loadTrackedTenders();
      } catch (err) {
        setWorkflowSaveState("error");
        setWorkflowError(err instanceof Error ? err.message : "Arbeitsstand konnte nicht gespeichert werden.");
      }
    },
    [loadTrackedTenders, selectedTender],
  );

  return (
    <Stack spacing={3}>
      <Box component="section">
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", alignItems: { xs: "flex-start", lg: "flex-end" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", lg: "row" } }}>
            <Box>
              <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
                Arbeitsansicht
              </Typography>
              <Typography variant="h4" component="h2" fontWeight={700} sx={{ mt: 1 }}>
                Verfolgte Ausschreibungen
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 800, lineHeight: 1.6 }}>
                Diese Ansicht unterstützt die tägliche Bearbeitung: aktive Fälle zuerst, klare Fristen, klare Verantwortung und schnelle nächste Schritte im Detailbereich.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <BriefcaseBusiness size={16} />}
              onClick={() => void loadTrackedTenders()}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, flexShrink: 0 }}
            >
              Aktualisieren
            </Button>
          </Box>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <SummaryTile label="Aktiv" value={summary?.active ?? 0} detail="Verfolgt, in Bearbeitung oder eingereicht" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <SummaryTile label="Fristen bald" value={summary?.dueSoon ?? 0} detail="Nächste 7 Tage" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <SummaryTile label="Gewonnen" value={summary?.won ?? 0} detail="Bereits positiv entschieden" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <SummaryTile label="Verloren" value={summary?.lost ?? 0} detail="Bereits abgeschlossen" />
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", lg: "5fr 3fr 4fr" } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Titel, Unternehmen, Quelle oder Notiz durchsuchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as TrackedStatusFilter)}
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Unternehmen</InputLabel>
              <Select
                value={String(companyFilter)}
                label="Unternehmen"
                onChange={(e) => setCompanyFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <MenuItem value="all">Alle Unternehmen</MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={String(company.id)}>
                    {company.name} ({company.count})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {error ? (
        <Box sx={{ borderRadius: 3, border: 1, borderColor: "error.main", bgcolor: "rgba(211,47,47,0.05)", p: 2.5 }}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ borderRadius: 3, border: 1, borderColor: "divider", bgcolor: "background.paper", p: 4, textAlign: "center" }}>
          <CircularProgress size={20} sx={{ mb: 1.5 }} />
          <Typography variant="body2" color="text.secondary">
            Verfolgte Ausschreibungen werden geladen.
          </Typography>
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ borderRadius: 3, border: 1, borderColor: "divider", bgcolor: "background.paper", p: 4, textAlign: "center" }}>
          <CircleAlert size={24} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <Typography variant="body2" fontWeight={500} color="text.primary">
            Noch keine verfolgten Ausschreibungen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Markieren Sie in der Analyse passende Treffer als verfolgt. Sie erscheinen dann automatisch hier.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {groups.map((group) => (
            <Box component="section" key={group.key}>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                  <Box>
                    <Typography variant="h6" component="p" fontWeight={600}>
                      {group.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {group.items.length} Ausschreibungen
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={1.5}>
                  {group.items.map((item) => (
                    <TrackedTenderCard
                      key={`${item.companyId}-${item.tenderId}`}
                      item={item}
                      onOpen={() => {
                        setSelectedTender(item);
                        setWorkflowSaveState("idle");
                        setWorkflowError(null);
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {selectedTender ? (
        <TenderDetailDrawer
          tender={{
            id: selectedTender.tenderId,
            title: selectedTender.title,
            source: selectedTender.source,
            url: selectedTender.url,
            fit: selectedTender.fit,
            winProbability: selectedTender.winProbability,
            effort: selectedTender.effort,
            requirementCoverage: selectedTender.requirementCoverage,
            killSwitch: selectedTender.killSwitch,
            explanation: selectedTender.explanation,
            actions: selectedTender.actions,
            missingItems: selectedTender.missingItems,
            details: selectedTender.details,
          }}
           companyId={selectedTender.companyId}
           companyName={selectedTender.companyName}
           trackedTenderId={selectedTender.trackedId}
           workflow={selectedWorkflow}
          workflowSaveState={workflowSaveState}
          workflowError={workflowError}
           onSaveWorkflow={handleSaveWorkflow}
           onBidPackCreated={() => void loadTrackedTenders()}
           onClose={() => {
            setSelectedTender(null);
            setWorkflowSaveState("idle");
            setWorkflowError(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
