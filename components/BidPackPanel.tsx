"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Download, ListTodo, Plus, ShieldAlert, Upload, ShieldCheck } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PaywallPanel } from "@/components/billing/PaywallPanel";
import type { BidPackDecisionStatus, BidPackRequirementStatus, BidPackTaskStatus } from "@/lib/bid-pack-types";

interface BidPackRequirement {
  id: number;
  source: string;
  title: string;
  sourceQuote: string | null;
  isMandatory: boolean;
  status: BidPackRequirementStatus;
  evidence: EvidenceMatch[];
}

interface EvidenceMatch {
  id: number;
  evidenceType: string;
  title: string;
  description: string | null;
  issuer: string | null;
  expiresAt: string | null;
  sourceUrl: string | null;
  status: string;
  matchStatus: string;
  rationale: string | null;
  evidenceFile?: { id: number; filename: string; sha256: string } | null;
}

interface CompanyEvidence {
  id: number;
  evidenceType: string;
  title: string;
  description: string | null;
  issuer: string | null;
  expiresAt: string | null;
  sourceUrl: string | null;
  status: string;
  verificationStatus: string;
  verificationNote: string | null;
  validityStatus: string;
  usable: boolean;
  files: Array<{ id: number; filename: string; contentType: string; sizeBytes: number; sha256: string; scanStatus: string }>;
}

interface BidPackTask {
  id: number;
  requirementId: number | null;
  source: string;
  title: string;
  status: BidPackTaskStatus;
  assignee: string | null;
  dueAt: string | null;
}

interface BidPackItem {
  id: number;
  trackedTenderId: number;
  decisionStatus: BidPackDecisionStatus;
  decisionNote: string | null;
  workflowStatus: string;
  submissionDeadlineAt: string | null;
  analysis: {
    fit: number;
    winProbability: number;
    effort: number;
    requirementCoverage: number;
    killSwitch: boolean;
    explanation: string | null;
  };
  requirements: BidPackRequirement[];
  tasks: BidPackTask[];
}

interface BidPackResponse {
  item?: BidPackItem;
  items?: BidPackItem[];
  error?: string;
}

interface BidPackPanelProps {
  companyId: number | null;
  tenderId: number;
  trackedTenderId?: number;
  onCreated?: (packId: number, trackedTenderId: number) => void;
}

const DECISION_LABELS: Record<BidPackDecisionStatus, string> = {
  undecided: "Entscheidung offen",
  go: "Bieten",
  no_go: "Nicht bieten",
};

const REQUIREMENT_LABELS: Record<BidPackRequirementStatus, string> = {
  open: "Offen",
  met: "Erfüllt",
  not_met: "Nicht erfüllt",
  waived: "Risiko akzeptiert",
};

const TASK_LABELS: Record<BidPackTaskStatus, string> = {
  todo: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  blocked: "Blockiert",
};

const VALIDITY_LABELS: Record<string, string> = {
  valid: "Gültig",
  expiring_soon: "Läuft bald ab",
  expired: "Abgelaufen",
  no_expiry: "Ohne Ablaufdatum",
};

const getErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload = await response.json().catch(() => null) as BidPackResponse | null;
  return payload?.error ?? fallback;
};

const formatDate = (value: string | null): string => {
  if (!value) return "Keine Frist erkannt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Keine Frist erkannt" : date.toLocaleDateString("de-DE");
};

const statusChipColor = (status: BidPackDecisionStatus): "default" | "success" | "error" => {
  if (status === "go") return "success";
  if (status === "no_go") return "error";
  return "default";
};

export function BidPackPanel({ companyId, tenderId, trackedTenderId, onCreated }: BidPackPanelProps) {
  const [pack, setPack] = useState<BidPackItem | null>(null);
  const [resolvedTrackedTenderId, setResolvedTrackedTenderId] = useState<number | undefined>(trackedTenderId);
  const [loading, setLoading] = useState(Boolean(trackedTenderId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywalled, setPaywalled] = useState(false);
  const [decision, setDecision] = useState<BidPackDecisionStatus>("undecided");
  const [decisionNote, setDecisionNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState<CompanyEvidence[]>([]);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("other");
  const [evidenceSourceUrl, setEvidenceSourceUrl] = useState("");
  const [evidenceExpiresAt, setEvidenceExpiresAt] = useState("");
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<number | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"markdown" | "csv" | null>(null);

  const applyPack = (nextPack: BidPackItem | null) => {
    setPack(nextPack);
    if (!nextPack) return;
    setResolvedTrackedTenderId(nextPack.trackedTenderId);
    setDecision(nextPack.decisionStatus);
    setDecisionNote(nextPack.decisionNote ?? "");
  };

  useEffect(() => {
    setPack(null);
    setResolvedTrackedTenderId(trackedTenderId);
    setError(null);
    setPaywalled(false);
    setDecision("undecided");
    setDecisionNote("");

    if (!companyId || !trackedTenderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/bid-packs?trackedTenderId=${trackedTenderId}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 402) {
          if (!cancelled) setPaywalled(true);
          return null;
        }
        if (!response.ok) throw new Error(await getErrorMessage(response, "Bid Pack konnte nicht geladen werden."));
        return response.json() as Promise<BidPackResponse>;
      })
      .then((payload) => {
        if (!cancelled && payload) applyPack(payload.items?.[0] ?? null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Bid Pack konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, tenderId, trackedTenderId]);

  useEffect(() => {
    if (!companyId || !pack) {
      setEvidenceItems([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/companies/${companyId}/evidence`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await getErrorMessage(response, "Nachweise konnten nicht geladen werden."));
        return response.json() as Promise<{ items?: CompanyEvidence[] }>;
      })
      .then((payload) => {
        if (!cancelled) setEvidenceItems(payload.items ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Nachweise konnten nicht geladen werden.");
      });
    return () => { cancelled = true; };
  }, [companyId, pack?.id]);

  const openRequirements = useMemo(
    () => pack?.requirements.filter((requirement) => requirement.status === "open" || requirement.status === "not_met").length ?? 0,
    [pack],
  );
  const openTasks = useMemo(
    () => pack?.tasks.filter((task) => task.status !== "done").length ?? 0,
    [pack],
  );

  const checkPremium = async (): Promise<boolean> => {
    const response = await fetch("/api/billing/status", { cache: "no-store" });
    const status = response.ok ? await response.json() as { active?: boolean } : null;
    if (status?.active === true) return true;
    setPaywalled(true);
    return false;
  };

  const createPack = async () => {
    if (!companyId || saving) return;
    setSaving(true);
    setError(null);

    try {
      if (!(await checkPremium())) return;

      let nextTrackedTenderId = resolvedTrackedTenderId;
      if (!nextTrackedTenderId) {
        const existingResponse = await fetch(`/api/tracked-tenders/${companyId}/${tenderId}`, { cache: "no-store" });
        if (existingResponse.ok) {
          const existingPayload = await existingResponse.json() as { item?: { trackedId?: number } };
          nextTrackedTenderId = existingPayload.item?.trackedId;
        } else if (existingResponse.status !== 404) {
          throw new Error(await getErrorMessage(existingResponse, "Arbeitsfall konnte nicht geladen werden."));
        }
      }
      if (!nextTrackedTenderId) {
        const trackResponse = await fetch("/api/tracked-tenders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tender_id: tenderId, company_id: companyId, status: "reviewing" }),
        });
        if (!trackResponse.ok) throw new Error(await getErrorMessage(trackResponse, "Ausschreibung konnte nicht für die Bearbeitung gespeichert werden."));
        const trackedPayload = await trackResponse.json() as { item?: { trackedId?: number } };
        nextTrackedTenderId = trackedPayload.item?.trackedId;
      }

      if (!nextTrackedTenderId) throw new Error("Die Ausschreibung konnte nicht als Arbeitsfall angelegt werden.");
      const response = await fetch("/api/bid-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tracked_tender_id: nextTrackedTenderId }),
      });
      if (response.status === 402) {
        setPaywalled(true);
        return;
      }
      if (!response.ok) throw new Error(await getErrorMessage(response, "Bid Pack konnte nicht erstellt werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
      if (payload.item) onCreated?.(payload.item.id, payload.item.trackedTenderId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bid Pack konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const updateDecision = async () => {
    if (!pack || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision_status: decision, decision_note: decisionNote.trim() || null }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Entscheidung konnte nicht gespeichert werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Entscheidung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const updateRequirement = async (requirementId: number, status: BidPackRequirementStatus) => {
    if (!pack || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}/requirements/${requirementId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Anforderung konnte nicht aktualisiert werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Anforderung konnte nicht aktualisiert werden.");
    } finally {
      setSaving(false);
    }
  };

  const addTask = async () => {
    if (!pack || !taskTitle.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: taskTitle.trim(), assignee: taskAssignee.trim() || null }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Aufgabe konnte nicht angelegt werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
      setTaskTitle("");
      setTaskAssignee("");
      setShowTaskForm(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aufgabe konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (taskId: number, status: BidPackTaskStatus) => {
    if (!pack || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Aufgabe konnte nicht aktualisiert werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aufgabe konnte nicht aktualisiert werden.");
    } finally {
      setSaving(false);
    }
  };

  const createEvidence = async () => {
    if (!companyId || !evidenceTitle.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${companyId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
         body: JSON.stringify({
           evidence_type: evidenceType,
           title: evidenceTitle.trim(),
           source_url: evidenceSourceUrl.trim() || null,
           expires_at: evidenceExpiresAt ? new Date(evidenceExpiresAt).toISOString() : null,
         }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Nachweis konnte nicht gespeichert werden."));
      const payload = await response.json() as { item?: CompanyEvidence };
       if (payload.item) setEvidenceItems((current) => [...current, payload.item as CompanyEvidence].sort((a, b) => a.title.localeCompare(b.title)));
       if (payload.item && evidenceFile) await uploadEvidenceFile((payload.item as CompanyEvidence).id, evidenceFile);
       setEvidenceTitle("");
       setEvidenceSourceUrl("");
       setEvidenceExpiresAt("");
       setEvidenceFile(null);
      setShowEvidenceForm(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nachweis konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const uploadEvidenceFile = async (evidenceId: number, file: File) => {
    if (!companyId) return;
    setUploadingEvidenceId(evidenceId);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/companies/${companyId}/evidence/${evidenceId}/files`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await getErrorMessage(response, "Datei konnte nicht hochgeladen werden."));
    const listResponse = await fetch(`/api/companies/${companyId}/evidence`, { cache: "no-store" });
    if (listResponse.ok) {
      const payload = await listResponse.json() as { items?: CompanyEvidence[] };
      setEvidenceItems(payload.items ?? []);
    }
    setUploadingEvidenceId(null);
  };

  const setEvidenceVerification = async (item: CompanyEvidence, status: "verified" | "rejected") => {
    if (!companyId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${companyId}/evidence/${item.id}/verification`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Verifizierung konnte nicht gespeichert werden."));
      const payload = await response.json() as { item?: CompanyEvidence };
      if (payload.item) setEvidenceItems((current) => current.map((entry) => entry.id === item.id ? payload.item as CompanyEvidence : entry));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verifizierung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const linkEvidence = async (requirementId: number, evidenceId: number) => {
    if (!pack || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}/requirements/${requirementId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence_id: evidenceId }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Nachweis konnte nicht verknüpft werden."));
      const payload = await response.json() as BidPackResponse;
      applyPack(payload.item ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nachweis konnte nicht verknüpft werden.");
    } finally {
      setSaving(false);
    }
  };

  const exportPack = async (format: "markdown" | "csv") => {
    if (!pack || exportingFormat) return;
    setExportingFormat(format);
    setError(null);
    try {
      const response = await fetch(`/api/bid-packs/${pack.id}/export?format=${format}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Export konnte nicht erstellt werden."));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = format === "csv" ? "bid-pack-matrix.csv" : "bid-pack-brief.md";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export konnte nicht erstellt werden.");
    } finally {
      setExportingFormat(null);
    }
  };

  if (paywalled) {
    return (
      <PaywallPanel
        feature="Bid Pack"
        title="Nicht nur lesen. Entscheiden, ob Sie bieten sollten."
        description="Erhalten Sie eine persönliche Passungsanalyse, erkennen Sie fehlende Anforderungen und erstellen Sie die nächsten Aufgaben für Ihr Team."
      />
    );
  }

  if (!companyId) {
    return (
      <Alert severity="info">Legen Sie zuerst ein Unternehmensprofil an, damit die Ausschreibung gegen Ihr Unternehmen geprüft werden kann.</Alert>
    );
  }

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Bid Pack wird geladen.</Typography>
        </Stack>
      </Paper>
    );
  }

  if (!pack) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "primary.main", bgcolor: "rgba(59,130,246,0.04)" }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <ClipboardCheck size={20} />
            <Typography variant="subtitle1" fontWeight={700}>Bid Pack erstellen</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Aus dieser Ausschreibung wird eine belastbare Entscheidungsgrundlage: Risiken, Anforderungen und nächste Schritte für Ihr Unternehmen.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button variant="contained" onClick={() => void createPack()} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : <ClipboardCheck size={16} />}>
            {saving ? "Wird vorbereitet" : "Bid Pack starten"}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderColor: "primary.main", bgcolor: "rgba(59,130,246,0.035)" }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">Bid Pack</Typography>
            <Typography variant="h6" fontWeight={700}>Vom Treffer zum Angebotsplan</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={() => void exportPack("markdown")} disabled={exportingFormat !== null}>
              {exportingFormat === "markdown" ? "Brief ..." : "Brief"}
            </Button>
            <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={() => void exportPack("csv")} disabled={exportingFormat !== null}>
              {exportingFormat === "csv" ? "Matrix ..." : "Matrix CSV"}
            </Button>
            <Chip label={DECISION_LABELS[pack.decisionStatus]} color={statusChipColor(pack.decisionStatus)} />
          </Stack>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Offene Anforderungen</Typography>
            <Typography variant="h6" fontWeight={700}>{openRequirements}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Offene Aufgaben</Typography>
            <Typography variant="h6" fontWeight={700}>{openTasks}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, gridColumn: { xs: "span 2", sm: "auto" } }}>
            <Typography variant="caption" color="text.secondary">Abgabefrist</Typography>
            <Typography variant="body1" fontWeight={700}>{formatDate(pack.submissionDeadlineAt)}</Typography>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>Systemsignal zur Entscheidung</Typography>
                <Typography variant="caption" color="text.secondary">Die Empfehlung ist eine prüfbare Orientierung, keine automatische Angebotsentscheidung.</Typography>
              </Box>
              <Chip
                label={pack.analysis.killSwitch ? "Risikosignal" : "Keine harte Sperre erkannt"}
                color={pack.analysis.killSwitch ? "error" : "success"}
                size="small"
              />
            </Stack>
            {pack.analysis.explanation ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {pack.analysis.explanation}
              </Typography>
            ) : null}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1 }}>
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Passung</Typography>
                <Typography variant="body1" fontWeight={700}>{Math.round(pack.analysis.fit)}%</Typography>
              </Box>
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Indikative Chance</Typography>
                <Typography variant="body1" fontWeight={700}>{Math.round(pack.analysis.winProbability)}%</Typography>
              </Box>
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Deckung</Typography>
                <Typography variant="body1" fontWeight={700}>{Math.round(pack.analysis.requirementCoverage * 100)}%</Typography>
              </Box>
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Aufwand</Typography>
                <Typography variant="body1" fontWeight={700}>{Math.round(pack.analysis.effort)}%</Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShieldAlert size={17} />
              <Typography variant="subtitle2" fontWeight={700}>Ihre Entscheidung</Typography>
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel id={`bid-pack-decision-${pack.id}`}>Entscheidung</InputLabel>
              <Select
                labelId={`bid-pack-decision-${pack.id}`}
                label="Entscheidung"
                value={decision}
                onChange={(event) => setDecision(event.target.value as BidPackDecisionStatus)}
              >
                {(Object.keys(DECISION_LABELS) as BidPackDecisionStatus[]).map((value) => (
                  <MenuItem key={value} value={value}>{DECISION_LABELS[value]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Begründung oder offene Frage"
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <Button variant="contained" onClick={() => void updateDecision()} disabled={saving} sx={{ alignSelf: "flex-start" }}>
              Entscheidung speichern
            </Button>
          </Stack>
        </Paper>

        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircle2 size={17} />
            <Typography variant="subtitle2" fontWeight={700}>Anforderungsmatrix</Typography>
          </Stack>
          {pack.requirements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Noch keine strukturierten Anforderungen erkannt. Prüfe die Originalunterlagen manuell.</Typography>
          ) : (
            pack.requirements.map((requirement) => (
              <Paper key={requirement.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip label={requirement.source} size="small" variant="outlined" />
                      {requirement.isMandatory ? <Chip label="Pflicht" size="small" color="warning" /> : null}
                    </Stack>
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>{requirement.title}</Typography>
                    {requirement.sourceQuote ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Zitat: {requirement.sourceQuote}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Erkannt aus: {requirement.source}
                      </Typography>
                    )}
                    {requirement.evidence.length > 0 ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                         {requirement.evidence.map((item) => <Chip key={item.id} label={`Nachweis: ${item.title}${item.evidenceFile ? ` · ${item.evidenceFile.sha256.slice(0, 8)}` : ""}`} size="small" color="success" variant="outlined" />)}
                      </Stack>
                    ) : null}
                  </Box>
                  <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 170 } }}>
                    <InputLabel id={`requirement-status-${requirement.id}`}>Status</InputLabel>
                    <Select
                      labelId={`requirement-status-${requirement.id}`}
                      label="Status"
                      value={requirement.status}
                      onChange={(event) => void updateRequirement(requirement.id, event.target.value as BidPackRequirementStatus)}
                    >
                      {(Object.keys(REQUIREMENT_LABELS) as BidPackRequirementStatus[]).map((value) => (
                        <MenuItem key={value} value={value}>{REQUIREMENT_LABELS[value]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {evidenceItems.length > 0 ? (
                    <Select
                      size="small"
                      value=""
                      displayEmpty
                      disabled={saving}
                      onChange={(event) => {
                        const evidenceId = Number(event.target.value);
                        if (evidenceId > 0) void linkEvidence(requirement.id, evidenceId);
                      }}
                      sx={{ minWidth: { xs: "100%", sm: 190 } }}
                    >
                      <MenuItem value=""><em>Nachweis verknüpfen</em></MenuItem>
                       {evidenceItems.filter((item) => item.usable && !requirement.evidence.some((match) => match.id === item.id)).map((item) => (
                        <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>
                      ))}
                    </Select>
                  ) : null}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>Nachweisbibliothek</Typography>
                <Typography variant="caption" color="text.secondary">Einmal erfassen, an mehrere Anforderungen hängen.</Typography>
              </Box>
              <Button size="small" startIcon={<Plus size={15} />} onClick={() => setShowEvidenceForm((value) => !value)}>Nachweis</Button>
            </Stack>
            {showEvidenceForm ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField size="small" label="Titel des Nachweises" value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} fullWidth />
                 <FormControl size="small" sx={{ minWidth: { sm: 180 } }}>
                  <InputLabel id={`evidence-type-${pack.id}`}>Typ</InputLabel>
                  <Select labelId={`evidence-type-${pack.id}`} label="Typ" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>
                    <MenuItem value="reference">Referenz</MenuItem>
                    <MenuItem value="certificate">Zertifikat</MenuItem>
                    <MenuItem value="license">Lizenz</MenuItem>
                    <MenuItem value="insurance">Versicherung</MenuItem>
                    <MenuItem value="personnel">Personal</MenuItem>
                    <MenuItem value="other">Sonstiges</MenuItem>
                  </Select>
                 </FormControl>
                 <TextField size="small" label="Quelle (URL)" value={evidenceSourceUrl} onChange={(event) => setEvidenceSourceUrl(event.target.value)} fullWidth />
                 <TextField size="small" label="Gültig bis" type="datetime-local" value={evidenceExpiresAt} onChange={(event) => setEvidenceExpiresAt(event.target.value)} InputLabelProps={{ shrink: true }} />
                 <Button variant="outlined" onClick={() => void createEvidence()} disabled={!evidenceTitle.trim() || saving}>Speichern</Button>
                 <Button component="label" variant="outlined" startIcon={<Upload size={15} />}>
                   {evidenceFile ? evidenceFile.name : "Datei wählen"}
                   <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} />
                 </Button>
              </Stack>
            ) : null}
            {evidenceItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Noch keine Nachweise erfasst.</Typography>
            ) : (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                 {evidenceItems.map((item) => (
                   <Stack key={item.id} direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                     <Chip label={`${item.title} · ${item.evidenceType}`} size="small" variant="outlined" color={item.verificationStatus === "verified" ? "success" : item.verificationStatus === "rejected" ? "error" : "default"} />
                     <Typography variant="caption" color="text.secondary">{VALIDITY_LABELS[item.validityStatus] ?? item.validityStatus} · {item.verificationStatus === "verified" ? "Verifiziert" : item.verificationStatus === "rejected" ? "Abgelehnt" : "Nicht geprüft"}</Typography>
                     {item.verificationStatus !== "verified" && item.validityStatus !== "expired" ? <Button size="small" startIcon={<ShieldCheck size={13} />} onClick={() => void setEvidenceVerification(item, "verified")} disabled={(!item.files.length && !item.sourceUrl) || uploadingEvidenceId === item.id}>Verifizieren</Button> : null}
                     {item.files.length === 0 ? <Typography component="label" variant="caption" color="primary" sx={{ cursor: "pointer" }}>
                       Datei hochladen<input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEvidenceFile(item.id, file); }} />
                     </Typography> : null}
                     {item.files.map((file) => <Button key={file.id} size="small" startIcon={<Download size={13} />} onClick={() => window.open(`/api/companies/${companyId}/evidence/${item.id}/files/${file.id}`, "_blank", "noopener,noreferrer")}>{file.filename}</Button>)}
                   </Stack>
                 ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <ListTodo size={17} />
              <Typography variant="subtitle2" fontWeight={700}>Nächste Schritte</Typography>
            </Stack>
            <Button size="small" startIcon={<Plus size={15} />} onClick={() => setShowTaskForm((value) => !value)}>
              Aufgabe
            </Button>
          </Stack>
          {showTaskForm ? (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.25}>
                <TextField size="small" label="Aufgabe" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} fullWidth />
                <TextField size="small" label="Verantwortlich" value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} fullWidth />
                <Button variant="outlined" onClick={() => void addTask()} disabled={!taskTitle.trim() || saving} sx={{ alignSelf: "flex-start" }}>
                  Aufgabe speichern
                </Button>
              </Stack>
            </Paper>
          ) : null}
          {pack.tasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Noch keine nächsten Schritte erkannt.</Typography>
          ) : (
            pack.tasks.map((task) => (
              <Paper key={task.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{task.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {task.assignee ? `${task.assignee} · ` : ""}{task.dueAt ? `bis ${formatDate(task.dueAt)}` : "Keine interne Frist"}
                    </Typography>
                  </Box>
                  <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
                    <InputLabel id={`task-status-${task.id}`}>Status</InputLabel>
                    <Select
                      labelId={`task-status-${task.id}`}
                      label="Status"
                      value={task.status}
                      onChange={(event) => void updateTask(task.id, event.target.value as BidPackTaskStatus)}
                    >
                      {(Object.keys(TASK_LABELS) as BidPackTaskStatus[]).map((value) => (
                        <MenuItem key={value} value={value}>{TASK_LABELS[value]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
