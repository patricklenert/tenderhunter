"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowUpRight, Check, Crosshair, Download, Rocket, SlidersHorizontal } from "lucide-react";
import { TenderDetailDrawer, type FollowState, type TenderDetailItem } from "@/components/TenderDetailDrawer";
import { CompanySelector, type UserCompany } from "@/components/CompanySelector";
import { useSession } from "@/lib/auth-client";
import { PaywallPanel } from "@/components/billing/PaywallPanel";

type ViewState = "setup" | "discover" | "results";
type StepState = "pending" | "active" | "done";
type SortKey = "winProbability" | "fit" | "coverage" | "effort" | "title";
type StatusFilter = "all" | "ok" | "stop";
type FitFilter = "all" | "50" | "75";
type ExportFormat = "csv" | "pdf";

const RESULT_FILTER_STORAGE_KEY = "tenderhunter:result-filters";
const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface ExtractedData {
  name?: string;
  capabilities?: string[];
  certifications?: string[];
  regions?: string[];
  team_size?: number;
  description?: string;
  logo_url?: string | null;
}

type MatchedTender = TenderDetailItem;

interface DiscoverStartResponse {
  company: { id: number; name: string };
  extracted: ExtractedData;
  matched: MatchedTender[];
  sessionStartedAt: string;
  discoveryId?: string;
  cached?: boolean;
  error?: string;
}

interface PipelineStep {
  key: "scrape" | "profile" | "crawl" | "score";
  label: string;
  status: StepState;
}

interface DiscoveryStatus {
  phase: "processing" | "completed" | "failed";
  error: string | null;
  summary: {
    matchCount: number;
    pendingJobs: number;
    runningJobs: number;
    failedJobs: number;
  };
  queueLanes: Array<{ type: string; count: number }>;
  steps: PipelineStep[];
}

interface DiscoverStatusResponse {
  company: { id: number; name: string };
  matched: MatchedTender[];
  status: DiscoveryStatus;
  error?: string;
}

interface DiscoverSession {
  company: { id: number; name: string };
  extracted: ExtractedData;
  sessionStartedAt: string;
  discoveryId?: string;
  cached?: boolean;
}

interface ResultData {
  company: { id: number; name: string };
  extracted: ExtractedData;
  matched: MatchedTender[];
}

const PIPELINE_STEPS: ReadonlyArray<Pick<PipelineStep, "key" | "label">> = [
  { key: "scrape", label: "Website laden" },
  { key: "profile", label: "Unternehmensprofil erkennen" },
  { key: "crawl", label: "Ausschreibungen suchen" },
  { key: "score", label: "Passung berechnen" },
];

const JOB_LABELS: Record<string, string> = {
  crawl_sources: "Quellen",
  fetch_documents: "Dokumente",
  parse_documents: "Texte",
  structure_tender: "Struktur",
  score_tender: "Scoring",
  generate_insight: "Insights",
  notify_company: "Benachrichtigung",
};

const VALID_SORT_KEYS: ReadonlyArray<SortKey> = ["winProbability", "fit", "coverage", "effort", "title"];
const VALID_STATUS_FILTERS: ReadonlyArray<StatusFilter> = ["all", "ok", "stop"];
const VALID_FIT_FILTERS: ReadonlyArray<FitFilter> = ["all", "50", "75"];

const buildSteps = (overrides: Partial<Record<PipelineStep["key"], StepState>> = {}): PipelineStep[] =>
  PIPELINE_STEPS.map((step) => ({
    ...step,
    status: overrides[step.key] ?? "pending",
  }));

const formatLaneLabel = (type: string): string => JOB_LABELS[type] ?? type.replaceAll("_", " ");

const buildTenderSearchText = (tender: MatchedTender): string =>
  [tender.title, tender.source, tender.url ?? "", tender.explanation ?? "", ...tender.actions, ...tender.missingItems]
    .join(" ")
    .toLowerCase();

const slugifyFilename = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "export";

const escapeCsv = (value: string | number | boolean | null | undefined): string =>
  `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const isSortKey = (value: unknown): value is SortKey => typeof value === "string" && VALID_SORT_KEYS.includes(value as SortKey);

const isStatusFilter = (value: unknown): value is StatusFilter =>
  typeof value === "string" && VALID_STATUS_FILTERS.includes(value as StatusFilter);

const isFitFilter = (value: unknown): value is FitFilter => typeof value === "string" && VALID_FIT_FILTERS.includes(value as FitFilter);

const isPageSize = (value: unknown): value is PageSize => typeof value === "number" && PAGE_SIZE_OPTIONS.includes(value as PageSize);

const filterAndSortTenders = (
  tenders: MatchedTender[],
  options: {
    search: string;
    source: string;
    status: StatusFilter;
    fit: FitFilter;
    sort: SortKey;
  },
) => {
  const search = options.search.trim().toLowerCase();

  return [...tenders]
    .filter((tender) => {
      if (options.source !== "all" && tender.source !== options.source) {
        return false;
      }

      if (options.status === "ok" && tender.killSwitch) {
        return false;
      }

      if (options.status === "stop" && !tender.killSwitch) {
        return false;
      }

      if (options.fit !== "all" && tender.fit < Number(options.fit)) {
        return false;
      }

      if (search && !buildTenderSearchText(tender).includes(search)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      switch (options.sort) {
        case "fit":
          return right.fit - left.fit || right.winProbability - left.winProbability;
        case "coverage":
          return right.requirementCoverage - left.requirementCoverage || right.fit - left.fit;
        case "effort":
          return left.effort - right.effort || right.winProbability - left.winProbability;
        case "title":
          return left.title.localeCompare(right.title, "de");
        case "winProbability":
        default:
          return right.winProbability - left.winProbability || right.fit - left.fit;
      }
    });
};

function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    startRef.current = null;
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [target, duration]);

  return <>{value}</>;
}

function MetricBar({ value, accent = false }: { value: number; accent?: boolean }) {
  const barColor = accent
    ? value >= 75
      ? "success.main"
      : value >= 50
        ? "warning.main"
        : "grey.400"
    : value >= 75
      ? "success.main"
      : value >= 50
        ? "primary.main"
        : value >= 25
          ? "warning.main"
          : "grey.400";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "grey.200", overflow: "hidden" }}>
        <Box
          sx={{
            height: "100%",
            borderRadius: 4,
            bgcolor: barColor,
            width: `${Math.max(0, Math.min(100, value))}%`,
            transition: "width 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </Box>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {value}%
      </Typography>
    </Box>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
      <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
        {label}
      </Typography>
      <Typography variant="h5" component="p" fontWeight={600} sx={{ mt: 1, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#1e293b" }}>
        {value}
      </Typography>
      {detail ? (
        <Typography variant="caption" color="#475569" sx={{ mt: 1, display: "block" }}>
          {detail}
        </Typography>
      ) : null}
    </Paper>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ borderRadius: 1.5, bgcolor: "#f8fafc", px: 1.5, py: 1 }}>
      <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, fontVariantNumeric: "tabular-nums", color: "#1e293b" }}>
        {value}
      </Typography>
    </Box>
  );
}

function TagList({ items, emptyLabel }: { items?: string[]; emptyLabel: string }) {
  if (!items || items.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>;
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {items.map((item) => (
        <Chip
          key={item}
          label={item}
          size="small"
          sx={{ bgcolor: "#f1f5f9", color: "#1e293b", fontWeight: 500, fontSize: "0.6875rem", height: 22, borderRadius: "4px" }}
        />
      ))}
    </Box>
  );
}

function QueueLaneList({ lanes }: { lanes: Array<{ type: string; count: number }> }) {
  if (lanes.length === 0) {
    return <Typography variant="body2" color="text.secondary">Noch keine Queue-Jobs sichtbar.</Typography>;
  }

  const maxCount = lanes.reduce((currentMax, lane) => Math.max(currentMax, lane.count), 1);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {lanes.map((lane) => (
        <Box key={lane.type} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography variant="caption" fontWeight={500} sx={{ color: "#475569" }}>
              {formatLaneLabel(lane.type)}
            </Typography>
            <Typography variant="caption" color="#475569" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {lane.count}
            </Typography>
          </Box>
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: "grey.200", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                borderRadius: 2,
                bgcolor: "primary.main",
                width: `${Math.max(8, Math.round((lane.count / maxCount) * 100))}%`,
                transition: "width 0.5s",
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { sm: "center" },
        justifyContent: "space-between",
        gap: 1.5,
        borderRadius: 1.5,
        px: 2,
        py: 1,
      }}
    >
      <Typography variant="body2" color="#475569">
        Zeige {pageStart}-{pageEnd} von {totalItems} Treffern
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, alignSelf: { xs: "flex-start", sm: "auto" } }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
        >
          Zurueck
        </Button>
        <Typography variant="caption" color="#475569" sx={{ minWidth: 96, textAlign: "center" }}>
          Seite {currentPage} / {totalPages}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
        >
          Weiter
        </Button>
      </Box>
    </Paper>
  );
}

function MatchCard({
  tender,
  index,
  live = false,
  onOpenDetails,
}: {
  tender: MatchedTender;
  index: number;
  live?: boolean;
  onOpenDetails: (tender: MatchedTender) => void;
}) {
  const preview = tender.explanation
    ? tender.explanation.length > 170
      ? `${tender.explanation.slice(0, 167)}...`
      : tender.explanation
    : "Detailbewertung folgt, sobald die Insight-Pipeline fertig ist.";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        transition: "border-color 0.2s",
        "&:hover": { borderColor: "primary.main", borderOpacity: 0.3 },
        opacity: 0,
        animation: "fadeIn 0.4s ease-out forwards",
        animationDelay: `${index * 60}ms`,
        "@keyframes fadeIn": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              #{index + 1}
            </Typography>
            {live ? <Chip label="Live" size="small" color="primary" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} /> : null}
          </Box>
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.375, fontSize: "0.9375rem", color: "#1e293b" }}>
            {tender.title || `Ausschreibung #${tender.id}`}
          </Typography>
          <Typography variant="caption" color="#475569" sx={{ mt: 0.5, display: "block" }}>
            {tender.source}
          </Typography>
        </Box>
        {tender.killSwitch ? (
          <Chip label="Stopp" size="small" color="error" sx={{ flexShrink: 0, fontWeight: 700, height: 22, fontSize: "0.6875rem" }} />
        ) : (
          <Chip label="OK" size="small" color="success" sx={{ flexShrink: 0, fontWeight: 700, height: 22, fontSize: "0.6875rem" }} />
        )}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" color="#475569" sx={{ width: 80, flexShrink: 0 }}>
            Passung
          </Typography>
          <Box sx={{ flex: 1 }}>
            <MetricBar value={tender.fit} />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" color="#475569" sx={{ width: 80, flexShrink: 0 }}>
            Gewinnchance
          </Typography>
          <Box sx={{ flex: 1 }}>
            <MetricBar value={tender.winProbability} accent />
          </Box>
        </Box>

        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <DetailMetric label="Anforderungsdeckung" value={`${tender.requirementCoverage}%`} />
          <DetailMetric label="Aufwand" value={`${tender.effort}%`} />
        </Box>

        <Box sx={{ borderRadius: 1.5, bgcolor: "#f8fafc", px: 1.5, py: 1 }}>
          <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 0.5, display: "block", fontSize: "0.6875rem" }}>
            Kurzbewertung
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5, color: "#334155", fontSize: "0.9375rem" }}>
            {preview}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="caption" color="#475569">{tender.actions.length} Schritte</Typography>
            <Typography variant="caption" color="#475569">{tender.missingItems.length} Unterlagen</Typography>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {tender.url ? (
              <Button
                component="a"
                href={tender.url}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="small"
                sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 500 }}
                endIcon={<ArrowUpRight size={14} />}
              >
                Quelle
              </Button>
            ) : null}
            <Button
              variant="contained"
              size="small"
              sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
              onClick={() => onOpenDetails(tender)}
            >
              Details ansehen
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

interface DashboardSectionProps {
  openAuth: (tab?: "login" | "register") => void;
}

export function DashboardSection({ openAuth }: DashboardSectionProps) {
  const { data: authSession } = useSession();
  const [state, setState] = useState<ViewState>("setup");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(() => buildSteps());
  const [matchCount, setMatchCount] = useState(0);
  const [data, setData] = useState<ResultData | null>(null);
  const [session, setSession] = useState<DiscoverSession | null>(null);
  const [liveMatches, setLiveMatches] = useState<MatchedTender[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("winProbability");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTender, setSelectedTender] = useState<MatchedTender | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [followStates, setFollowStates] = useState<Record<number, FollowState>>({});
  const [followErrors, setFollowErrors] = useState<Record<number, string>>({});
  const [showPremiumGate, setShowPremiumGate] = useState(false);

  const resultTenders = data?.matched ?? [];
  const filteredResultTenders = filterAndSortTenders(resultTenders, {
    search,
    source: sourceFilter,
    status: statusFilter,
    fit: fitFilter,
    sort: sortKey,
  });
  const sourceOptions = Array.from(new Set(resultTenders.map((tender) => tender.source))).sort((left, right) => left.localeCompare(right, "de"));
  const activeCompanyName = data?.company.name ?? session?.company.name ?? "";
  const activeCompanyId = data?.company.id ?? session?.company.id ?? null;
  const totalPages = Math.max(1, Math.ceil(filteredResultTenders.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedResultTenders = filteredResultTenders.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const pageStart = filteredResultTenders.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const pageEnd = filteredResultTenders.length === 0 ? 0 : Math.min(safeCurrentPage * pageSize, filteredResultTenders.length);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RESULT_FILTER_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, unknown>;

      if (typeof parsed.search === "string") {
        setSearch(parsed.search);
      }

      if (typeof parsed.sourceFilter === "string") {
        setSourceFilter(parsed.sourceFilter);
      }

      if (isSortKey(parsed.sortKey)) {
        setSortKey(parsed.sortKey);
      }

      if (isStatusFilter(parsed.statusFilter)) {
        setStatusFilter(parsed.statusFilter);
      }

      if (isFitFilter(parsed.fitFilter)) {
        setFitFilter(parsed.fitFilter);
      }

      if (isPageSize(parsed.pageSize)) {
        setPageSize(parsed.pageSize);
      }
    } catch {
      window.localStorage.removeItem(RESULT_FILTER_STORAGE_KEY);
    } finally {
      setPreferencesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    window.localStorage.setItem(
      RESULT_FILTER_STORAGE_KEY,
      JSON.stringify({
        search,
        sourceFilter,
        sortKey,
        statusFilter,
        fitFilter,
        pageSize,
      }),
    );
  }, [preferencesHydrated, search, sourceFilter, sortKey, statusFilter, fitFilter, pageSize]);

  useEffect(() => {
    if (resultTenders.length > 0 && sourceFilter !== "all" && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter("all");
    }
  }, [resultTenders.length, sourceFilter, sourceOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sourceFilter, sortKey, statusFilter, fitFilter, pageSize, data?.company.id]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (state !== "discover" || !session) return;

    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          companyId: String(session.company.id),
          since: session.sessionStartedAt,
        });
        if (session.discoveryId) {
          params.set("discoveryId", session.discoveryId);
        }
        const res = await fetch(`/api/discover?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as DiscoverStatusResponse;
        if (!res.ok) {
          if (res.status === 402) {
            setShowPremiumGate(true);
            setSession(null);
            setState("setup");
            return;
          }
          throw new Error(json.error ?? "Fehler bei der Statusabfrage.");
        }
        if (cancelled) return;

        setStatus(json.status);
        setSteps(json.status.steps);
        setMatchCount(json.matched.length);
        setLiveMatches(json.matched);

        if (json.status.phase === "failed") {
          setError(json.status.error ?? "Die Verarbeitung ist fehlgeschlagen.");
          setSelectedTender(null);
          setSession(null);
          setState("setup");
          return;
        }

        if (json.status.phase === "completed") {
          setData({
            company: json.company,
            extracted: session.extracted,
            matched: json.matched,
          });
          setSession(null);
          setState("results");
          return;
        }

        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Fehler bei der Statusabfrage.");
        setSelectedTender(null);
        setSession(null);
        setState("setup");
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [session, state]);

  useEffect(() => {
    if (!selectedTender) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTender(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTender]);

  const startAnalysis = useCallback(
    async (inputUrl: string) => {
      if (busy) return;
      if (!inputUrl) return;

      if (!/^https?:\/\//i.test(inputUrl)) {
        inputUrl = `https://${inputUrl}`;
      }

      setBusy(true);
      setError(null);
      setState("discover");
      setMatchCount(0);
      setData(null);
      setSession(null);
      setLiveMatches([]);
      setStatus(null);
      setSelectedTender(null);
      setCurrentPage(1);
      setFollowStates({});
      setFollowErrors({});
      setShowPremiumGate(false);
      setSteps(buildSteps({ scrape: "active" }));

      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: inputUrl }),
        });
        const json = (await res.json()) as DiscoverStartResponse;
        if (!res.ok) {
          if (res.status === 402) {
            setShowPremiumGate(true);
            setState("setup");
            return;
          }
          throw new Error(json.error ?? "Fehler bei der Analyse.");
        }

        setMatchCount(json.matched.length);
        setLiveMatches(json.matched);
        setSession({
          company: json.company,
          extracted: json.extracted,
          sessionStartedAt: json.sessionStartedAt,
          discoveryId: json.discoveryId,
          cached: json.cached,
        });

        if (json.cached) {
          setSteps(buildSteps({ scrape: "done", profile: "done", crawl: "done", score: "done" }));
          setStatus({
            phase: "completed",
            error: null,
            summary: {
              matchCount: json.matched.length,
              pendingJobs: 0,
              runningJobs: 0,
              failedJobs: 0,
            },
            queueLanes: [],
            steps: buildSteps({ scrape: "done", profile: "done", crawl: "done", score: "done" }),
          });
          setData({
            company: json.company,
            extracted: json.extracted,
            matched: json.matched,
          });
          setState("results");
        } else {
          setSteps(buildSteps({ scrape: "done", profile: "done", crawl: "active" }));
          setStatus({
            phase: "processing",
            error: null,
            summary: {
              matchCount: json.matched.length,
              pendingJobs: 0,
              runningJobs: 0,
              failedJobs: 0,
            },
            queueLanes: [],
            steps: buildSteps({ scrape: "done", profile: "done", crawl: "active" }),
          });
        }
      } catch (err) {
        setState("setup");
        setError(err instanceof Error ? err.message : "Fehler bei der Analyse.");
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) return;
      if (!authSession?.user) {
        openAuth("login");
        return;
      }
      setUrl(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      await startAnalysis(trimmed);
    },
    [url, startAnalysis],
  );

  const handleRestart = useCallback(() => {
    setState("setup");
    setData(null);
    setMatchCount(0);
    setUrl("");
    setError(null);
    setSession(null);
    setLiveMatches([]);
    setStatus(null);
    setSelectedTender(null);
    setExportingFormat(null);
    setCurrentPage(1);
      setFollowStates({});
      setFollowErrors({});
      setShowPremiumGate(false);
      setSteps(buildSteps());
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setSourceFilter("all");
    setSortKey("winProbability");
    setStatusFilter("all");
    setFitFilter("all");
    setPageSize(PAGE_SIZE_OPTIONS[0]);
    setCurrentPage(1);
  }, []);

  const handlePursueTender = useCallback(
    async (tender: MatchedTender) => {
      if (activeCompanyId === null) {
        return;
      }

      setFollowStates((current) => ({ ...current, [tender.id]: "saving" }));
      setFollowErrors((current) => {
        const next = { ...current };
        delete next[tender.id];
        return next;
      });

      try {
        const res = await fetch("/api/tracked-tenders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tender_id: tender.id,
            company_id: activeCompanyId,
            status: "tracked",
            metadata: {
              source: tender.source,
              title: tender.title,
              url: tender.url,
              fit: tender.fit,
              win_probability: tender.winProbability,
            },
          }),
        });

        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(json?.error ?? "Verfolgung konnte nicht gespeichert werden.");
        }

        setFollowStates((current) => ({ ...current, [tender.id]: "done" }));
        window.localStorage.setItem("tenderhunter:hasTrackedTenders", "true");
        window.dispatchEvent(new CustomEvent("tenderhunter:tracked"));
      } catch (err) {
        setFollowStates((current) => ({ ...current, [tender.id]: "error" }));
        setFollowErrors((current) => ({
          ...current,
          [tender.id]: err instanceof Error ? err.message : "Tracking konnte nicht gespeichert werden.",
        }));
      }
    },
    [activeCompanyId],
  );

  const ensurePremiumAccess = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      const status = response.ok ? await response.json() as { active?: boolean } : null;
      if (status?.active === true) return true;
    } catch {
      // Show the same upgrade path for unavailable billing status and inactive access.
    }
    setShowPremiumGate(true);
    return false;
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (!data || filteredResultTenders.length === 0) return;
    if (!(await ensurePremiumAccess())) return;

    setError(null);
    const rows = [
      [
        "Titel",
        "Quelle",
        "URL",
        "Passung",
        "Gewinnchance",
        "Anforderungsdeckung",
        "Aufwand",
        "Stopp",
        "Kurzbewertung",
        "Naechste Schritte",
        "Fehlende Unterlagen",
      ].join(";"),
      ...filteredResultTenders.map((tender) =>
        [
          tender.title,
          tender.source,
          tender.url ?? "",
          `${tender.fit}%`,
          `${tender.winProbability}%`,
          `${tender.requirementCoverage}%`,
          `${tender.effort}%`,
          tender.killSwitch ? "Ja" : "Nein",
          tender.explanation ?? "",
          tender.actions.join(" | "),
          tender.missingItems.join(" | "),
        ]
          .map((value) => escapeCsv(value))
          .join(";"),
      ),
    ].join("\n");

    downloadBlob(new Blob([`\ufeff${rows}`], { type: "text/csv;charset=utf-8;" }), `${slugifyFilename(data.company.name)}-ausschreibungen.csv`);
  }, [data, ensurePremiumAccess, filteredResultTenders]);

  const handleExportPdf = useCallback(async () => {
    if (!data || filteredResultTenders.length === 0) return;
    if (!(await ensurePremiumAccess())) return;

    setExportingFormat("pdf");
    setError(null);

    try {
      const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 42;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (needed = 18) => {
        if (y + needed <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };

      const writeParagraph = (text: string, fontSize = 11, lineHeight = 15, color: [number, number, number] = [34, 34, 34]) => {
        const lines = doc.splitTextToSize(text || "-", contentWidth) as string[];
        ensureSpace(lines.length * lineHeight + 4);
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      };

      const addSpacer = (size = 12) => {
        ensureSpace(size);
        y += size;
      };

      doc.setFontSize(20);
      doc.setTextColor(24, 24, 27);
      doc.text("Tenderhunter Export", margin, y);
      y += 24;
      writeParagraph(`Unternehmen: ${data.company.name}`, 12, 16, [70, 70, 74]);
      writeParagraph(`Exportierte Treffer: ${filteredResultTenders.length}`, 12, 16, [70, 70, 74]);
      if (data.extracted.description) {
        addSpacer(10);
        writeParagraph(data.extracted.description, 11, 15, [55, 65, 81]);
      }
      addSpacer(12);

      filteredResultTenders.forEach((tender, index) => {
        ensureSpace(120);
        doc.setDrawColor(225, 228, 233);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;

        writeParagraph(`${index + 1}. ${tender.title || `Ausschreibung #${tender.id}`}`, 13, 17, [24, 24, 27]);
        writeParagraph(`Quelle: ${tender.source}`, 10, 14, [90, 98, 111]);
        if (tender.url) {
          writeParagraph(`URL: ${tender.url}`, 10, 14, [90, 98, 111]);
        }

        addSpacer(4);
        writeParagraph(
          `Passung ${tender.fit}% | Gewinnchance ${tender.winProbability}% | Anforderungsdeckung ${tender.requirementCoverage}% | Aufwand ${tender.effort}% | Stopp ${tender.killSwitch ? "Ja" : "Nein"}`,
          11,
          15,
        );

        addSpacer(4);
        writeParagraph(`Kurzbewertung: ${tender.explanation ?? "Noch keine Begruendung verfuegbar."}`, 11, 15);

        if (tender.actions.length > 0) {
          addSpacer(4);
          writeParagraph(`Naechste Schritte: ${tender.actions.join(" | ")}`, 11, 15);
        }

        if (tender.missingItems.length > 0) {
          addSpacer(4);
          writeParagraph(`Fehlende Unterlagen: ${tender.missingItems.join(" | ")}`, 11, 15);
        }

        if (tender.details) {
          addSpacer(4);
          writeParagraph(
            `Scoring-Faktoren: Domaenenfit ${tender.details.domainMatch}%, Deckung ${tender.details.requirementCoverage}%, Region ${tender.details.regionMatch}%, Groesse ${tender.details.sizeMatch}%, Komplexitaet ${tender.details.complexity}%`,
            11,
            15,
          );
        }

        addSpacer(10);
      });

      doc.save(`${slugifyFilename(data.company.name)}-ausschreibungen.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF-Export fehlgeschlagen.");
    } finally {
      setExportingFormat(null);
    }
  }, [data, ensurePremiumAccess, filteredResultTenders]);

  if (state === "setup") {
    return (
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: "70vh", pt: 4 }}>
        <Box sx={{ width: "100%", maxWidth: 800 }}>
          {showPremiumGate && (
            <Box sx={{ mb: 3 }}>
              <PaywallPanel
                feature="KI-Analyse"
                title="Deine Entscheidungshilfe freischalten"
                description="Die Ausschreibungssuche bleibt offen. Billing schaltet KI-Analyse, Matching, Exporte und weitere Arbeitsaktionen frei."
              />
            </Box>
          )}
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 4,
                bgcolor: "primary.main",
                opacity: 0.1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2.5,
                color: "primary.main",
              }}
            >
              <Crosshair size={28} />
            </Box>
            <Typography variant="h4" component="p" fontWeight={700} letterSpacing="-0.025em">
              Tenderhunter
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Automatisch passende Ausschreibungen finden.
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 560, mx: "auto" }}>
            <TextField
              id="company-url"
              label="Unternehmens-Webseite"
              type="text"
              inputMode="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.dein-unternehmen.de"
              disabled={busy}
              autoFocus
              fullWidth
              size="medium"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  fontSize: "1.1rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.05rem",
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !url.trim()}
              fullWidth
              size="large"
              startIcon={<Rocket size={22} />}
              sx={{
                textTransform: "none",
                py: 2.25,
                fontSize: "1.1rem",
                fontWeight: 700,
                borderRadius: 2.5,
              }}
            >
              Analyse starten
            </Button>
          </Box>

          {error ? (
            <Alert severity="error" sx={{ mt: 3, maxWidth: 480, mx: "auto" }}>
              {error}
            </Alert>
          ) : null}

          {authSession?.user && (
            <Box sx={{ mt: 4, maxWidth: 480, mx: "auto" }}>
              <CompanySelector
                onSelect={(company) => {
                  if (company.websiteUrl) {
                    setUrl(company.websiteUrl);
                    startAnalysis(company.websiteUrl);
                  }
                }}
                onNewAnalysis={() => {
                  const input = document.getElementById("company-url") as HTMLInputElement | null;
                  input?.focus();
                }}
                activeCompanyId={activeCompanyId}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  if (state === "discover") {
    return (
      <>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(0, 0.95fr)" },
            }}
          >
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Box sx={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid",
                      borderColor: "divider",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid transparent",
                      borderTopColor: "primary.main",
                      animation: "spin 1.4s linear infinite",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 12,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      opacity: 0.08,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "primary.main",
                    }}
                  >
                    <Crosshair size={20} />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                    Pipeline
                  </Typography>
                  <Typography variant="h6" component="p" fontWeight={600} sx={{ mt: 0.5, color: "#1e293b" }}>
                    Analyse läuft
                  </Typography>
                  <Typography variant="body2" color="#475569" sx={{ mt: 0.5 }}>
                    Treffer werden angezeigt, sobald sie berechnet sind.
                  </Typography>
                </Box>
              </Box>

              {session ? (
                <Paper sx={{ mb: 2, borderRadius: 1.5, bgcolor: "#f8fafc", p: 1.5 }} elevation={0}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                    Unternehmen
                  </Typography>
                  <Typography variant="h6" component="p" fontWeight={600} sx={{ mt: 1, color: "#1e293b" }}>
                    {session.company.name}
                  </Typography>
                  {session.extracted.description ? (
                    <Typography variant="body2" color="#334155" sx={{ mt: 1, lineHeight: 1.5, fontSize: "0.9375rem" }}>
                      {session.extracted.description}
                    </Typography>
                  ) : null}
                </Paper>
              ) : null}

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
                {steps.map((step, index) => (
                  <Box key={step.key} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        transition: "all 0.3s",
                        ...(step.status === "done"
                          ? { bgcolor: "primary.main", color: "primary.contrastText" }
                          : step.status === "active"
                            ? { bgcolor: "primary.light", color: "primary.main", border: "1px solid", borderColor: "primary.light" }
                            : { bgcolor: "grey.200", color: "text.secondary" }),
                      }}
                    >
                      {step.status === "done" ? <Check size={14} /> : index + 1}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        transition: "color 0.3s",
                        fontWeight: step.status === "pending" ? 400 : 500,
                        color: step.status === "pending" ? "text.secondary" : "text.primary",
                      }}
                    >
                      {step.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  mb: 3,
                }}
              >
                <SummaryCard label="Treffer" value={matchCount} detail="bereits sichtbar" />
                <SummaryCard label="Offene Jobs" value={status?.summary.pendingJobs ?? 0} detail="warten in der Queue" />
                <SummaryCard label="Aktiv" value={status?.summary.runningJobs ?? 0} detail="werden gerade verarbeitet" />
              </Box>

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                    Queue
                  </Typography>
                  {status?.summary.failedJobs ? (
                    <Chip label={`${status.summary.failedJobs} Fehler`} size="small" color="error" sx={{ fontWeight: 700 }} />
                  ) : null}
                </Box>
                <QueueLaneList lanes={status?.queueLanes ?? []} />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                    Zwischenergebnisse
                  </Typography>
                  <Typography variant="h6" component="p" fontWeight={600} sx={{ mt: 0.5, color: "#1e293b" }}>
                    Live-Treffer
                  </Typography>
                </Box>
                {liveMatches.length > 0 ? (
                  <Chip label={`${liveMatches.length} sichtbar`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                ) : null}
              </Box>

              {liveMatches.length === 0 ? (
                <Box
                  sx={{
                    minHeight: 280,
                    borderRadius: 3,
                    border: "1px dashed",
                    borderColor: "divider",
                    bgcolor: "grey.50",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 3,
                    textAlign: "center",
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={500} sx={{ color: "#1e293b" }}>
                      Noch keine Treffer sichtbar
                    </Typography>
                    <Typography variant="body2" color="#475569" sx={{ mt: 0.5 }}>
                      Sobald Scoring-Ergebnisse vorliegen, erscheinen sie hier sofort.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    maxHeight: 560,
                    overflowY: "auto",
                    pr: 0.5,
                  }}
                >
                  {liveMatches.slice(0, 6).map((tender, index) => (
                    <MatchCard key={tender.id} tender={tender} index={index} live onOpenDetails={setSelectedTender} />
                  ))}
                </Box>
              )}
            </Paper>
          </Box>

          {session ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" },
              }}
            >
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                  Leistungen
                </Typography>
                <TagList items={session.extracted.capabilities} emptyLabel="Keine Leistungen erkannt." />
              </Paper>
              {session.extracted.regions && session.extracted.regions.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                    Regionen
                  </Typography>
                  <TagList items={session.extracted.regions} emptyLabel="Keine Regionen erkannt." />
                </Paper>
              )}
              {session.extracted.certifications && session.extracted.certifications.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                    Nachweise
                  </Typography>
                  <TagList items={session.extracted.certifications} emptyLabel="Keine Nachweise erkannt." />
                  {session.extracted.team_size ? (
                    <Typography variant="body2" color="#334155" sx={{ mt: 2 }}>
                      Teamgroesse: <Box component="span" fontWeight={600} color="#1e293b">{session.extracted.team_size}</Box>
                    </Typography>
                  ) : null}
                </Paper>
              )}
            </Box>
          ) : null}
        </Box>

        {selectedTender ? (
          <TenderDetailDrawer
            tender={selectedTender}
            companyId={activeCompanyId}
            companyName={activeCompanyName}
            followState={followStates[selectedTender.id] ?? "idle"}
            followError={followErrors[selectedTender.id] ?? null}
            onFollow={handlePursueTender}
            onClose={() => setSelectedTender(null)}
          />
        ) : null}
      </>
    );
  }

  if (!data) return null;

  const avgFit = resultTenders.length > 0 ? Math.round(resultTenders.reduce((sum, tender) => sum + tender.fit, 0) / resultTenders.length) : 0;
  const avgWinProbability = resultTenders.length > 0 ? Math.round(resultTenders.reduce((sum, tender) => sum + tender.winProbability, 0) / resultTenders.length) : 0;
  const topWinProbability = resultTenders.length > 0 ? Math.max(...resultTenders.map((tender) => tender.winProbability)) : 0;
  const stopCount = resultTenders.filter((tender) => tender.killSwitch).length;

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "flex-end" }, gap: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
              Gefunden
            </Typography>
            <Typography variant="h2" fontWeight={600} letterSpacing="-0.025em" lineHeight={1} sx={{ color: "#1e293b" }}>
              <AnimatedCounter target={resultTenders.length} />
            </Typography>
            <Typography variant="body2" color="#334155" sx={{ mt: 0.75 }}>
              passende Ausschreibungen
              {data.company.name ? ` fuer ${data.company.name}` : ""}
            </Typography>
          </Box>
          <Box sx={{ textAlign: { sm: "right" } }}>
            <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 0.5, display: "block" }}>
              Durchschnittliche Passung
            </Typography>
            <Typography variant="h3" component="p" fontWeight={600} letterSpacing="-0.025em" lineHeight={1} sx={{ color: "#1e293b" }}>
              <AnimatedCounter target={avgFit} />%
            </Typography>
          </Box>
        </Box>

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : null}
        {showPremiumGate && (
          <PaywallPanel
            feature="Exporte"
            title="Ergebnisse für dein Team mitnehmen"
            description="Exporte und weitere Arbeitsaktionen sind im Billing-Plan enthalten. Deine Treffer und Filter bleiben erhalten."
          />
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                Unternehmen
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                {data.extracted.logo_url && (
                  <Box
                    component="img"
                    src={data.extracted.logo_url}
                    alt={data.company.name}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1.5,
                      objectFit: "contain",
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                      p: 0.5,
                    }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <Box>
                  <Typography variant="h6" component="p" fontWeight={600} sx={{ color: "#1e293b" }}>
                    {data.company.name}
                  </Typography>
                  {session?.cached && (
                    <Chip label="Gecacht" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", mt: 0.5 }} />
                  )}
                </Box>
              </Box>
              {data.extracted.description ? (
                <Typography variant="body2" color="#334155" sx={{ mt: 1.5, lineHeight: 1.5, fontSize: "0.9375rem" }}>
                  {data.extracted.description}
                </Typography>
              ) : null}
              {data.extracted.team_size ? (
                <Typography variant="body2" color="#334155" sx={{ mt: 2 }}>
                  Teamgroesse: <Box component="span" fontWeight={600} color="#1e293b">{data.extracted.team_size}</Box>
                </Typography>
              ) : null}
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                Leistungen
              </Typography>
              <TagList items={data.extracted.capabilities} emptyLabel="Keine Leistungen erkannt." />
            </Paper>

            {data.extracted.regions && data.extracted.regions.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                  Regionen
                </Typography>
                <TagList items={data.extracted.regions} emptyLabel="Keine Regionen erkannt." />
              </Paper>
            )}

            {data.extracted.certifications && data.extracted.certifications.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569" sx={{ mb: 1, display: "block" }}>
                  Nachweise
                </Typography>
                <TagList items={data.extracted.certifications} emptyLabel="Keine Nachweise erkannt." />
              </Paper>
            )}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="#475569">
                Ergebnisse
              </Typography>
              <Button
                variant="text"
                size="small"
                onClick={handleRestart}
                sx={{ textTransform: "none", fontSize: "0.75rem", color: "text.secondary", "&:hover": { color: "text.primary" } }}
              >
                Neue Suche
              </Button>
            </Box>

            {resultTenders.length > 0 ? (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ color: "primary.main" }}>
                    <SlidersHorizontal size={16} />
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#1e293b" }}>
                    Sortierung, Filter und Export
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(6, 1fr)" },
                  }}
                >
                  <TextField
                    label="Suche"
                    type="search"
                    size="small"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Titel, Quelle, Unterlagen"
                    fullWidth
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel id="sort-key-label">Sortieren nach</InputLabel>
                    <Select
                      labelId="sort-key-label"
                      value={sortKey}
                      label="Sortieren nach"
                      onChange={(event: SelectChangeEvent) => setSortKey(event.target.value as SortKey)}
                    >
                      <MenuItem value="winProbability">Beste Gewinnchance</MenuItem>
                      <MenuItem value="fit">Beste Passung</MenuItem>
                      <MenuItem value="coverage">Hoechste Deckung</MenuItem>
                      <MenuItem value="effort">Niedrigster Aufwand</MenuItem>
                      <MenuItem value="title">Titel A-Z</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="source-filter-label">Quelle</InputLabel>
                    <Select
                      labelId="source-filter-label"
                      value={sourceFilter}
                      label="Quelle"
                      onChange={(event: SelectChangeEvent) => setSourceFilter(event.target.value)}
                    >
                      <MenuItem value="all">Alle Quellen</MenuItem>
                      {sourceOptions.map((source) => (
                        <MenuItem key={source} value={source}>
                          {source}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="status-filter-label">Status</InputLabel>
                    <Select
                      labelId="status-filter-label"
                      value={statusFilter}
                      label="Status"
                      onChange={(event: SelectChangeEvent) => setStatusFilter(event.target.value as StatusFilter)}
                    >
                      <MenuItem value="all">Alle Treffer</MenuItem>
                      <MenuItem value="ok">Nur OK</MenuItem>
                      <MenuItem value="stop">Nur Stopp</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="fit-filter-label">Mindestpassung</InputLabel>
                    <Select
                      labelId="fit-filter-label"
                      value={fitFilter}
                      label="Mindestpassung"
                      onChange={(event: SelectChangeEvent) => setFitFilter(event.target.value as FitFilter)}
                    >
                      <MenuItem value="all">Keine Grenze</MenuItem>
                      <MenuItem value="50">Ab 50%</MenuItem>
                      <MenuItem value="75">Ab 75%</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="page-size-label">Pro Seite</InputLabel>
                    <Select
                      labelId="page-size-label"
                      value={pageSize}
                      label="Pro Seite"
                      onChange={(event: SelectChangeEvent<number>) => setPageSize(Number(event.target.value) as PageSize)}
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option} Treffer
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1.5 }}>
                  <Box>
                    <Typography variant="body2" color="#475569">
                      {filteredResultTenders.length} von {resultTenders.length} Treffern sichtbar. Export basiert auf der aktuellen Filterung.
                    </Typography>
                    <Typography variant="caption" color="#475569" sx={{ mt: 0.5, display: "block" }}>
                      Filter und Seitengroesse werden lokal im Browser gespeichert.
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleResetFilters}
                      sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
                    >
                      Filter zuruecksetzen
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                       onClick={() => void handleExportCsv()}
                      disabled={filteredResultTenders.length === 0 || exportingFormat !== null}
                      startIcon={<Download size={14} />}
                      sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
                    >
                      CSV exportieren
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void handleExportPdf()}
                      disabled={filteredResultTenders.length === 0 || exportingFormat !== null}
                      startIcon={<Download size={14} />}
                      sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
                    >
                      {exportingFormat === "pdf" ? "PDF wird erstellt" : "PDF exportieren"}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            ) : null}

            {resultTenders.length === 0 ? (
              <Paper variant="outlined" sx={{ borderRadius: 1.5, py: 6, px: 3, textAlign: "center" }}>
                <Typography variant="body2" fontWeight={500} sx={{ color: "#1e293b" }}>
                  Keine Treffer
                </Typography>
                <Typography variant="body2" color="#475569" sx={{ mt: 0.5 }}>
                  Fuer dieses Profil wurden keine passenden Ausschreibungen gefunden.
                </Typography>
              </Paper>
            ) : filteredResultTenders.length === 0 ? (
              <Paper variant="outlined" sx={{ borderRadius: 1.5, py: 6, px: 3, textAlign: "center" }}>
                <Typography variant="body2" fontWeight={500} sx={{ color: "#1e293b" }}>
                  Keine Treffer fuer die aktuelle Filterung
                </Typography>
                <Typography variant="body2" color="#475569" sx={{ mt: 0.5 }}>
                  Passe Suche, Quelle, Status oder Mindestpassung an.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <PaginationControls
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  totalItems={filteredResultTenders.length}
                  onPageChange={setCurrentPage}
                />

                {paginatedResultTenders.map((tender, index) => (
                  <MatchCard key={tender.id} tender={tender} index={(safeCurrentPage - 1) * pageSize + index} onOpenDetails={setSelectedTender} />
                ))}

                <PaginationControls
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  totalItems={filteredResultTenders.length}
                  onPageChange={setCurrentPage}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {selectedTender ? (
        <TenderDetailDrawer
          tender={selectedTender}
          companyId={activeCompanyId}
          companyName={activeCompanyName}
          followState={followStates[selectedTender.id] ?? "idle"}
          followError={followErrors[selectedTender.id] ?? null}
          onFollow={handlePursueTender}
          onClose={() => setSelectedTender(null)}
        />
      ) : null}
    </>
  );
}
