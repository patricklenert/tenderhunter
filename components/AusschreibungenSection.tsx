"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
   Collapse,
   FormControlLabel,
   IconButton,
  InputAdornment,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Skeleton,
   Stack,
   Switch,
   Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Alert,
} from "@mui/material";
import {
  Building2,
  Calendar,
  FileText,
  MapPin,
  Search,
  ExternalLink,
  Bot,
  Check,
  Copy,
  LayoutGrid,
  List,
  X,
  RefreshCw,
  Eye,
  // Crosshair,  // Ursprüngliches Standort-Icon (Lucide) — auskommentiert für Rollback
} from "lucide-react";
import { SearchLocationIcon } from "@/components/icons/SidebarIcons";
import type { ViewKey } from "@/components/Shell";
import { getAllLocationOptions } from "@/lib/bundesland";
import {
  formatDeadlineDE,
  deadlineLabel,
  deadlineColor,
  cleanPdfFilename,
  TENDER_DEADLINE_FILTERS,
  type TenderDeadlineFilter,
} from "@/lib/date-utils";
import { PdfDocumentLink } from "@/components/PdfDocumentLink";
import { documentAnalysisFieldLabel } from "@/lib/document-analysis";
import { documentIdentityKey } from "@/lib/document-identity";
import { isGenericPortalNavigationResource, isPortalActionUrl } from "@/lib/resource-url";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { ResourceState } from "@/components/ResourceState";
import { ResponsiveTableFrame } from "@/components/ResponsiveTableFrame";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import {
  hasCanonicalPublicDescriptionSection,
  normalizePublicDisplayCandidate,
  pickValidatedPublicCandidate,
  projectPublicDisplayFields,
} from "@/lib/public-content-quality";

interface ApiTender {
  id: number;
  title: string;
  client: string;
  location: string;
  bundesland?: string | null;
  city?: string | null;
  deadline: string | null;
  deadlineISO: string | null;
  category: string;
  description: string;
  referenceNumber?: string | null;
  source: string;
  sourceUrl: string;
  pdfUrls?: string[];
  pdfCount?: number;
  contractValueMin?: number | null;
  contractValueMax?: number | null;
  contractDurationMonths?: number | null;
  procedureType?: string | null;
  createdAt?: string;
  slug?: string | null;
  smallVendor?: { fit: number; priceWeightPct: number | null; badges: string[] };
}

const projectTenderDisplay = (tender: ApiTender) => projectPublicDisplayFields({
  title: tender.title,
  client: tender.client,
  location: tender.location,
  summary: tender.description,
});

const PAGE_SIZE = 30;
type DeadlineSort = "deadline" | "newest" | "smallVendorFit";

const DEFAULT_DEADLINE_FILTER: TenderDeadlineFilter = "minimum7";
const DEADLINE_FILTER_LABELS: Record<TenderDeadlineFilter, string> = {
  all: "Alle offenen",
  minimum3: "Mindestens 3 Tage Vorlauf",
  minimum7: "Mindestens 7 Tage Vorlauf",
  minimum14: "Mindestens 14 Tage Vorlauf",
  next7: "Nächste 7 Tage",
  next30: "Nächste 30 Tage",
  custom: "Benutzerdefinierter Zeitraum",
  missing: "Keine Frist bekannt",
};

const DEADLINE_SORT_LABELS: Record<DeadlineSort, string> = {
  deadline: "Früheste Frist",
  newest: "Neueste zuerst",
  smallVendorFit: "Small Vendor Fit",
};

interface TenderSearchOptions {
  query: string;
  location: string;
  todayNew: boolean;
  deadlineFilter: TenderDeadlineFilter;
  deadlineFrom: string;
  deadlineTo: string;
  sort: DeadlineSort;
  smallVendorFitMin?: number;
}

export function AusschreibungenSection({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showBanner, setShowBanner] = useState(false);
  const [tenders, setTenders] = useState<ApiTender[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [todayNewOnly, setTodayNewOnly] = useState(false);
  const [todayNewCount, setTodayNewCount] = useState(0);
  const [deadlineFilter, setDeadlineFilter] = useState<TenderDeadlineFilter>(DEFAULT_DEADLINE_FILTER);
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [sortKey, setSortKey] = useState<DeadlineSort>("deadline");
  const [smallVendorMode, setSmallVendorMode] = useState(false);
  const [smallVendorOnly, setSmallVendorOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const searchOptions = useMemo<TenderSearchOptions>(() => ({
    query: searchQuery,
    location: selectedLocation,
    todayNew: todayNewOnly,
    deadlineFilter,
    deadlineFrom,
    deadlineTo,
    sort: smallVendorMode ? sortKey : sortKey === "smallVendorFit" ? "deadline" : sortKey,
    smallVendorFitMin: smallVendorMode && smallVendorOnly ? 75 : undefined,
  }), [deadlineFilter, deadlineFrom, deadlineTo, searchQuery, selectedLocation, smallVendorMode, smallVendorOnly, sortKey, todayNewOnly]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/features", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSmallVendorMode(Boolean(data.smallVendorMode));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
  }, []);

  const GEO_RADIUS_KM = 200;

  const haversineDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation wird nicht unterstützt");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || "Standort konnte nicht ermittelt werden");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const clearGeolocation = useCallback(() => {
    setUserLocation(null);
    setGeoError(null);
  }, []);

  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number } | null>>({});

  const geocodeLocation = useCallback(async (location: string): Promise<{ lat: number; lng: number } | null> => {
    if (!location || location.length < 2) return null;
    const normalized = location.trim().toLowerCase();
    if (geoCache[normalized] !== undefined) return geoCache[normalized];

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&countrycodes=de&limit=1`,
        { headers: { "Accept-Language": "de" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setGeoCache((prev) => ({ ...prev, [normalized]: result }));
        return result;
      }
      setGeoCache((prev) => ({ ...prev, [normalized]: null }));
      return null;
    } catch {
      return null;
    }
  }, [geoCache]);

  const [tenderDistances, setTenderDistances] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!userLocation) {
      setTenderDistances({});
      return;
    }
    let cancelled = false;
    const calcDistances = async () => {
      const distances: Record<number, number> = {};
      for (const tender of tenders) {
        if (cancelled) break;
        if (!tender.location) continue;
        const coords = await geocodeLocation(tender.location);
        if (coords && !cancelled) {
          distances[tender.id] = haversineDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
        }
      }
      if (!cancelled) setTenderDistances(distances);
    };
    calcDistances();
    return () => { cancelled = true; };
  }, [userLocation, tenders, geocodeLocation, haversineDistance]);

  const [selectedTender, setSelectedTender] = useState<ApiTender | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const searchTendersApi = useCallback(async (
    options: TenderSearchOptions,
    signal?: AbortSignal,
    page = 1,
    append = false,
  ) => {
    const requestGeneration = append
      ? requestGenerationRef.current
      : requestGenerationRef.current + 1;
    if (!append) requestGenerationRef.current = requestGeneration;

    if (append) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasMore(false);
      setCurrentPage(1);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.query.trim()) params.set("q", options.query.trim());
      if (options.location.startsWith("bl:")) params.set("bundesland", options.location.slice(3));
      if (options.location.startsWith("city:")) params.set("city", options.location.slice(5));
      if (options.todayNew) params.set("todayNew", "1");
      params.set("deadlineFilter", options.deadlineFilter);
      if (options.deadlineFilter === "custom") {
        if (options.deadlineFrom) params.set("deadlineFrom", options.deadlineFrom);
        if (options.deadlineTo) params.set("deadlineTo", options.deadlineTo);
      }
      params.set("sort", options.sort);
      if (options.smallVendorFitMin) params.set("smallVendorFitMin", String(options.smallVendorFitMin));
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(page));

      const res = await fetch(`/api/tenders/search?${params.toString()}`, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (requestGeneration !== requestGenerationRef.current) return;
      const nextItems = data.items ?? [];
      setTenders((previous) => append ? [...previous, ...nextItems] : nextItems);
      setTotalResults(data.total ?? data.items?.length ?? 0);
      setTodayNewCount(data.todayNewCount ?? 0);
      setCurrentPage(page);
      setHasMore(page * PAGE_SIZE < (data.total ?? nextItems.length) && nextItems.length > 0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
      if (!append) {
        setTenders([]);
        setTodayNewCount(0);
      }
    } finally {
      if (!signal?.aborted) {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchTendersApi(searchOptions, controller.signal, 1, false);
    }, searchOptions.query ? 350 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchOptions, searchTendersApi]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    void searchTendersApi(searchOptions, undefined, currentPage + 1, true);
  }, [currentPage, hasMore, loading, searchOptions, searchTendersApi]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("ausschreibungen_banner_dismissed")) return;
    const timer = setTimeout(() => setShowBanner(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("ausschreibungen_banner_dismissed", "1");
  };

  const fetchDetail = useCallback(async (tender: ApiTender) => {
    setSelectedTender(tender);
    setCopyStatus("idle");
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    try {
      const res = await fetch("/api/tenders/public/detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenderId: tender.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          setTenders((previous) => previous.filter((item) => item.id !== tender.id));
          setTotalResults((previous) => Math.max(0, previous - 1));
          setDetailLoading(false);
          setDetailOpen(false);
          void searchTendersApi(searchOptions, undefined, 1, false);
          return;
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDetailData(data);
      setDetailLoading(false);

      if (data.enriching) {
        setTimeout(async () => {
          try {
            const res2 = await fetch("/api/tenders/public/detail", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tenderId: tender.id }),
            });
            const data2 = await res2.json();
            if (res2.ok && !data2.enriching) {
              setDetailData(data2);
            }
          } catch {
            // Ignore re-fetch errors
          }
        }, 8000);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Fehler beim Laden");
      setDetailLoading(false);
    }
  }, [searchOptions, searchTendersApi]);

  const locationOptions = useMemo(() => getAllLocationOptions(), []);

  const displayedTenders = useMemo(() => {
    if (!userLocation) return tenders;
    return tenders.filter((tender) => {
      const distance = tenderDistances[tender.id];
      if (distance === undefined) return true;
      return distance <= GEO_RADIUS_KM;
    });
  }, [tenders, userLocation, tenderDistances]);

  const hasActiveFilters = Boolean(
    searchQuery
    || selectedLocation
    || todayNewOnly
    || deadlineFilter !== DEFAULT_DEADLINE_FILTER
    || deadlineFrom
    || deadlineTo,
  );
  const hasDeadlineRestriction = deadlineFilter !== "all";

  const copyModalContent = async (): Promise<void> => {
    if (!selectedTender) return;
    const visibleContent = dialogContentRef.current?.innerText.trim() ?? "";
    const copyText = [
      "Ausschreibung",
      visibleContent || selectedTender.title,
      `Quelle: ${selectedTender.sourceUrl}`,
    ].filter(Boolean).join("\n\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = copyText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard nicht verfügbar");
      }
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = setTimeout(() => setCopyStatus("idle"), 2_200);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Score CTA Banner */}
      <Collapse in={showBanner}>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: { xs: 2, sm: 3 },
            bgcolor: "secondary.main",
            color: "secondary.contrastText",
            p: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 4 },
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: { xs: 1.5, sm: 3 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="p" fontWeight={700} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
              Langfristige Verträge mit Behörden und Landesbaubetrieben
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: { xs: "space-between", sm: "flex-end" } }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => onNavigate?.("discovery")}
              sx={{
                whiteSpace: "nowrap",
                fontWeight: 700,
                fontSize: { xs: "0.85rem", sm: "0.95rem" },
                px: { xs: 2, sm: 3 },
                py: { xs: 1, sm: "auto" },
                flex: { xs: 1, sm: "auto" },
              }}
            >
              Kostenlose KI-Analyse starten
            </Button>
            <IconButton
              size="medium"
              onClick={dismissBanner}
              aria-label="Hinweis schließen"
              sx={{ color: "secondary.contrastText", opacity: 0.7, "&:hover": { opacity: 1 } }}
            >
              <X size={18} />
            </IconButton>
          </Box>
        </Paper>
      </Collapse>

      {/* Search and Filter Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" fontWeight={600} sx={{ mb: 1, fontSize: { xs: "1.25rem", md: "1.375rem" } }}>
          Ausschreibungen durchsuchen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: "0.9375rem" }}>
          Semantische Suche über alle deutschen Ausschreibungsportale
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <TextField
            placeholder="Suche nach Titel, Auftraggeber, Leistung..."
            aria-label="Ausschreibungen durchsuchen"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="medium"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={22} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="medium"
                      onClick={userLocation ? clearGeolocation : handleGeolocation}
                      disabled={geoLoading}
                      aria-label={userLocation ? "Standortfilter deaktivieren" : "Nach Standort filtern"}
                      sx={{
                        width: 36,
                        height: 36,
                        color: userLocation ? "primary.main" : "text.secondary",
                        "&:hover": { color: "primary.main" },
                      }}
                      title={userLocation ? "Standort-Filter deaktivieren" : "Nach Standort filtern"}
                    >
                      {geoLoading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <SearchLocationIcon size={20} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            size="medium"
            sx={{ minWidth: 200 }}
            displayEmpty
            inputProps={{ "aria-label": "Standort" }}
          >
            <MenuItem value="">Alle Standorte</MenuItem>
            <ListSubheader>Bundesländer</ListSubheader>
            {locationOptions.filter((o) => o.group === "Bundesländer").map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
            <ListSubheader>Städte</ListSubheader>
            {locationOptions.filter((o) => o.group === "Städte").map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="medium"
              aria-label="Darstellung der Ausschreibungen"
            >
              <ToggleButton value="cards" aria-label="Kartenansicht" title="Kartenansicht"><LayoutGrid size={22} /></ToggleButton>
              <ToggleButton value="table" aria-label="Tabellenansicht" title="Tabellenansicht"><List size={22} /></ToggleButton>
            </ToggleButtonGroup>
            <IconButton
              onClick={() => searchTendersApi(searchOptions, undefined, 1, false)}
              disabled={loading}
              size="medium"
              aria-label="Ausschreibungen aktualisieren"
              title="Ausschreibungen aktualisieren"
              sx={{ height: 48, width: 48 }}
            >
              <RefreshCw size={22} className={loading ? "animate-spin" : ""} />
            </IconButton>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 2 }}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Select
            value={deadlineFilter}
            onChange={(event) => {
              const nextFilter = event.target.value as TenderDeadlineFilter;
              setDeadlineFilter(nextFilter);
              if (nextFilter !== "custom") {
                setDeadlineFrom("");
                setDeadlineTo("");
              }
            }}
            size="medium"
            aria-label="Fristenfilter"
            sx={{ minWidth: { xs: "100%", sm: 230 } }}
          >
            {TENDER_DEADLINE_FILTERS.map((filter) => (
              <MenuItem key={filter} value={filter}>
                {DEADLINE_FILTER_LABELS[filter]}
              </MenuItem>
            ))}
          </Select>
          {deadlineFilter === "custom" && (
            <>
              <TextField
                label="Frist von"
                type="date"
                value={deadlineFrom}
                onChange={(event) => setDeadlineFrom(event.target.value)}
                size="medium"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: "100%", sm: 165 } }}
              />
              <TextField
                label="Frist bis"
                type="date"
                value={deadlineTo}
                onChange={(event) => setDeadlineTo(event.target.value)}
                size="medium"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: "100%", sm: 165 } }}
              />
            </>
          )}
          <Select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as DeadlineSort)}
            size="medium"
            aria-label="Sortierung"
            sx={{ minWidth: { xs: "100%", sm: 180 } }}
          >
            {(Object.keys(DEADLINE_SORT_LABELS) as DeadlineSort[])
              .filter((sort) => sort !== "smallVendorFit" || smallVendorMode)
              .map((sort) => (
                <MenuItem key={sort} value={sort}>
                  {DEADLINE_SORT_LABELS[sort]}
                </MenuItem>
              ))}
          </Select>
          {smallVendorMode && (
            <FormControlLabel
              control={
                <Switch
                  checked={smallVendorOnly}
                  onChange={(event) => setSmallVendorOnly(event.target.checked)}
                  size="small"
                />
              }
              label="Für kleine IT-Anbieter"
              sx={{ mr: 0 }}
            />
          )}
        </Stack>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
            {loading
              ? "Ergebnisse werden aktualisiert..."
              : userLocation
              ? `${displayedTenders.length} von ${tenders.length} Ausschreibungen im Umkreis von ${GEO_RADIUS_KM}km`
              : `${totalResults} Ausschreibungen gefunden`}
          </Typography>
          <Button
            type="button"
            size="small"
            variant="text"
            onClick={() => setTodayNewOnly((active) => !active)}
            aria-pressed={todayNewOnly}
            sx={{
              minWidth: 0,
              px: 0.75,
              py: 0.25,
              border: "1px solid",
              borderColor: todayNewOnly ? "success.main" : "transparent",
              borderRadius: 1,
              color: "success.dark",
              backgroundColor: todayNewOnly ? "success.light" : "transparent",
              fontSize: "0.8125rem",
              fontWeight: todayNewOnly ? 700 : 500,
              lineHeight: 1.5,
              textTransform: "none",
              "&:hover": {
                backgroundColor: "success.light",
              },
            }}
          >
            {todayNewCount} in den letzten 3 Tagen neu gefunden
          </Button>
        </Box>
        {geoError && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
            {geoError}
          </Typography>
        )}
      </Box>

      {/* Loading skeletons */}
      {loading && tenders.length === 0 && (
        <Box role="status" aria-label="Ausschreibungen werden geladen" aria-live="polite">
          {viewMode === "cards" ? (
            <Stack spacing={2}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton variant="text" width="70%" height={28} sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="40%" height={20} />
                      </Box>
                      <Skeleton variant="rounded" width={80} height={24} sx={{ flexShrink: 0 }} />
                    </Box>
                    <Skeleton variant="text" width="100%" height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="90%" height={20} sx={{ mb: 2 }} />
                    <Box sx={{ display: "flex", gap: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                      <Skeleton variant="text" width={120} height={20} />
                      <Skeleton variant="text" width={100} height={20} />
                      <Skeleton variant="text" width={80} height={20} />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <ResponsiveTableFrame label="Ausschreibungsergebnisse werden geladen">
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Ausschreibung</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Auftraggeber</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Kategorie</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Standort</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Frist</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Quelle</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton variant="text" width="90%" height={20} />
                        <Skeleton variant="text" width="60%" height={16} />
                      </TableCell>
                      <TableCell><Skeleton variant="text" width="80%" height={20} /></TableCell>
                      <TableCell><Skeleton variant="rounded" width={60} height={22} /></TableCell>
                      <TableCell><Skeleton variant="text" width="70%" height={20} /></TableCell>
                      <TableCell><Skeleton variant="text" width={80} height={20} /></TableCell>
                      <TableCell><Skeleton variant="text" width="60%" height={16} /></TableCell>
                      <TableCell align="right"><Skeleton variant="circular" width={28} height={28} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableFrame>
          )}
        </Box>
      )}

      {/* Error state */}
      {error && (
        <ResourceState
          kind="error"
          title="Ausschreibungen konnten nicht geladen werden"
          description={error}
          action={(
            <Button
              variant="contained"
              startIcon={<RefreshCw size={20} />}
              onClick={() => searchTendersApi(searchOptions, undefined, 1, false)}
            >
              Erneut laden
            </Button>
          )}
        />
      )}

      {/* Empty state */}
      {!loading && tenders.length === 0 && !error && (
        <ResourceState
          kind="empty"
          icon={FileText}
          title={todayNewOnly
            ? "Keine Ausschreibungen in den letzten 3 Tagen gefunden"
            : hasDeadlineRestriction
            ? `Keine Ausschreibungen mit ${DEADLINE_FILTER_LABELS[deadlineFilter].toLowerCase()} gefunden`
            : hasActiveFilters
            ? "Keine Ausschreibungen gefunden"
            : "Noch keine Ausschreibungen vorhanden"}
          description={todayNewOnly
            ? "Versuchen Sie andere Suchbegriffe oder Standortfilter oder setzen Sie den Filter zurück."
            : hasDeadlineRestriction
            ? "Erweitern Sie den Fristenfilter, um auch kurzfristige Ausschreibungen anzuzeigen."
            : hasActiveFilters
            ? "Versuchen Sie andere Suchbegriffe oder Standortfilter."
            : "Der Hintergrund-Job sucht automatisch nach neuen Ausschreibungen."}
          action={hasDeadlineRestriction ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => {
                setDeadlineFilter("all");
                setDeadlineFrom("");
                setDeadlineTo("");
              }}
            >
              Alle offenen anzeigen
            </Button>
          ) : undefined}
          secondaryAction={hasActiveFilters ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => {
                setSearchQuery("");
                setSelectedLocation("");
                setTodayNewOnly(false);
                setDeadlineFilter(DEFAULT_DEADLINE_FILTER);
                setDeadlineFrom("");
                setDeadlineTo("");
                setSortKey("deadline");
                setSmallVendorOnly(false);
                clearGeolocation();
              }}
            >
              Filter zurücksetzen
            </Button>
          ) : !hasDeadlineRestriction ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => searchTendersApi({ ...searchOptions, query: "", location: "" }, undefined, 1, false)}
            >
              Jetzt laden
            </Button>
          ) : undefined}
        />
      )}

      {loading && tenders.length > 0 && (
        <ResourceState
          kind="loading"
          compact
          title="Ergebnisse werden aktualisiert"
          description="Ihre Filter werden angewendet."
        />
      )}

      {/* Cards view */}
      {displayedTenders.length > 0 && viewMode === "cards" && (
        <Box aria-busy={loading}>
          <Stack spacing={2}>
            {displayedTenders.map((tender) => (
              <TenderCard key={tender.id} tender={tender} onDetailClick={fetchDetail} distance={tenderDistances[tender.id]} />
            ))}
          </Stack>
        </Box>
      )}

      {/* Table view */}
      {displayedTenders.length > 0 && viewMode === "table" && (
        <Box aria-busy={loading}>
          <ResponsiveTableFrame label="Ausschreibungsergebnisse">
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Ausschreibung</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Auftraggeber</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Kategorie</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Standort</TableCell>
                  {userLocation && <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Entfernung</TableCell>}
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Frist</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.8125rem" }}>Quelle</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedTenders.map((tender) => {
                  const display = projectTenderDisplay(tender);
                  const title = display.title ?? "–";
                  const client = display.client ?? "–";
                  const description = display.description ?? "–";
                  const location = display.location ?? "–";

                  return (
                    <TableRow
                      key={tender.id}
                      hover
                      sx={tender.smallVendor && tender.smallVendor.fit >= 75 ? { bgcolor: "var(--color-smallvendor-soft)" } : undefined}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary", fontSize: "0.9375rem" }}>
                          {title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>{client}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={tender.category} size="small" variant="outlined" sx={{ height: 22, borderRadius: 1, fontSize: "0.6875rem" }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <MapPin size={15} style={{ opacity: 0.55 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>{location}</Typography>
                        </Box>
                      </TableCell>
                      {userLocation && (
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
                            {tenderDistances[tender.id] !== undefined
                              ? `${Math.round(tenderDistances[tender.id])}km`
                              : "–"}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <DeadlineDisplay value={tender.deadlineISO ?? tender.deadline} compact />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>{tender.source}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="medium"
                          onClick={() => fetchDetail(tender)}
                          aria-label={`${title} prüfen`}
                          title="Ausschreibung prüfen"
                          sx={{ minWidth: 0 }}
                        >
                          <Eye size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTableFrame>
        </Box>
      )}

      {!loading && hasMore && (
        <Box ref={loadMoreRef} sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <Button
            variant="outlined"
            onClick={loadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
          >
            {loadingMore ? "Weitere Ausschreibungen werden geladen..." : "Weitere Ausschreibungen laden"}
          </Button>
        </Box>
      )}

      {/* No geo results state */}
      {!loading && displayedTenders.length === 0 && tenders.length > 0 && (
        <ResourceState
          kind="empty"
          icon={Search}
          title="Keine Ausschreibungen im Umkreis gefunden"
          description="Erweitern Sie den Suchradius oder entfernen Sie den Standortfilter."
          action={(
            <Button
              variant="outlined"
              startIcon={<SearchLocationIcon size={20} />}
              onClick={clearGeolocation}
            >
              Standortfilter entfernen
            </Button>
          )}
        />
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
            <Typography variant="h6" component="p" fontWeight={600} sx={{ color: "text.primary", fontSize: "1.25rem" }}>
              Ausschreibung
            </Typography>
            <Button
              type="button"
              size="small"
              variant={copyStatus === "copied" ? "contained" : "outlined"}
              color={copyStatus === "error" ? "error" : "primary"}
              startIcon={copyStatus === "copied" ? <Check size={16} /> : copyStatus === "error" ? <Copy size={16} /> : <Bot size={16} />}
              onClick={() => void copyModalContent()}
              disabled={!detailData || !selectedTender}
              aria-label="Gesamten Inhalt der Ausschreibung für eine KI kopieren"
              sx={{ textTransform: "none", whiteSpace: "nowrap", minHeight: 32 }}
            >
              {copyStatus === "copied" ? "Kopiert" : copyStatus === "error" ? "Erneut kopieren" : "Für KI kopieren"}
            </Button>
          </Box>
          <IconButton onClick={() => setDetailOpen(false)} size="medium" aria-label="Ausschreibung schließen">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent ref={dialogContentRef} dividers>
          {detailLoading && (
            <Stack spacing={3} sx={{ py: 1 }}>
              <Skeleton variant="text" width="80%" height={40} />
              <Skeleton variant="text" width="50%" height={28} />
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="40%" height={28} />
              <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: 1, mt: 1 }} />
            </Stack>
          )}
          {detailError && (
            <Alert severity="error">{detailError}</Alert>
          )}
          {detailData && selectedTender && (() => {
            const d = detailData as Record<string, unknown>;
            const t = selectedTender;
            const smallVendorDetail = d.smallVendor && typeof d.smallVendor === "object" && !Array.isArray(d.smallVendor)
              ? d.smallVendor as { fit?: unknown; badges?: unknown; why?: unknown; risks?: unknown }
              : null;
            const smallVendorWhy = Array.isArray(smallVendorDetail?.why)
              ? smallVendorDetail.why.filter((item): item is string => typeof item === "string" && item.length > 0)
              : [];
            const smallVendorRisks = Array.isArray(smallVendorDetail?.risks)
              ? smallVendorDetail.risks.filter((item): item is string => typeof item === "string" && item.length > 0)
              : [];
            const smallVendorFitValue = typeof smallVendorDetail?.fit === "number" ? smallVendorDetail.fit : null;
            const smallVendorBadges = Array.isArray(smallVendorDetail?.badges)
              ? smallVendorDetail.badges.filter((item): item is string => typeof item === "string" && item.length > 0)
              : [];
            const display = projectPublicDisplayFields({
              title: t.title,
              client: [d.client, t.client],
              location: [d.location, t.location],
              summary: [d.summary, d.description, t.description],
              descriptionMarkdown: d.descriptionMarkdown,
            });
            const title = display.title ?? "";
            const client = display.client ?? "";
            const location = display.location ?? "–";
            const deadline = pickValidatedPublicCandidate(d.deadline, t.deadline);
            const deadlineISO = pickValidatedPublicCandidate(d.deadlineISO, t.deadlineISO);
            const description = display.description ?? "";
            const descriptionMarkdown = display.descriptionMarkdown;
            const markdownHasSection = (label: string): boolean => hasCanonicalPublicDescriptionSection(descriptionMarkdown, label);
            const markdownHasScope = markdownHasSection("Leistungsumfang");
            const markdownHasRequirements = markdownHasSection("Anforderungen");
            const markdownHasAwards = markdownHasSection("Zuschlagskriterien");
            const scope = pickValidatedPublicCandidate(d.scope) || null;
            const estimatedValue = pickValidatedPublicCandidate(d.estimatedValue) || null;
            const procedure = pickValidatedPublicCandidate(d.procedure) || null;
            const duration = pickValidatedPublicCandidate(d.duration) || null;
            const contact = pickValidatedPublicCandidate(d.contact) || null;
            const requirements = Array.isArray(d.requirements)
              ? d.requirements.map((value) => normalizePublicDisplayCandidate(value)).filter((value): value is string => Boolean(value))
              : [];
            const awardCriteria = Array.isArray(d.awardCriteria)
              ? d.awardCriteria.map((value) => normalizePublicDisplayCandidate(value)).filter((value): value is string => Boolean(value))
              : [];
            const pdfUrls = Array.isArray(d.pdfUrls) ? d.pdfUrls as string[] : t.pdfUrls ?? [];
            const documentRows = Array.isArray(d.documents)
              ? d.documents.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
                .filter((document) => !isPortalActionUrl(typeof document.url === "string" ? document.url : null))
              : [];
            const resourceRows = Array.isArray(d.resources)
              ? d.resources.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
                .filter((resource) => !isGenericPortalNavigationResource({
                  url: typeof resource.url === "string" ? resource.url : null,
                  canonicalUrl: typeof resource.canonicalUrl === "string" ? resource.canonicalUrl : null,
                  label: typeof resource.label === "string" ? resource.label : null,
                  filename: typeof resource.filename === "string" ? resource.filename : null,
                  resourceType: typeof resource.resourceType === "string" ? resource.resourceType : null,
                }))
              : [];
            const documentLinks = [
              ...documentRows.map((document) => ({
                documentId: typeof document.id === "number" ? document.id : null,
                url: typeof document.url === "string" ? document.url : null,
                label: typeof document.filename === "string" ? document.filename : null,
                 filename: typeof document.filename === "string" ? document.filename : null,
                 contentType: typeof document.contentType === "string" ? document.contentType : null,
                 resourceType: "document",
                roles: Array.isArray(document.roles) ? document.roles.filter((role): role is string => typeof role === "string") : [],
                status: typeof document.downloadStatus === "string" ? document.downloadStatus : null,
                parseStatus: typeof document.parseStatus === "string" ? document.parseStatus : null,
                summary: typeof document.summary === "string" ? document.summary : null,
              })),
              ...resourceRows
                .filter((resource) => (resource.resourceType === "document" || resource.resourceType === "download") && !isPortalActionUrl(typeof resource.url === "string" ? resource.url : null))
                .map((resource) => ({
                  documentId: typeof resource.documentId === "number" ? resource.documentId : null,
                  url: typeof resource.url === "string" ? resource.url : null,
                  label: typeof resource.label === "string" ? resource.label : null,
                   filename: typeof resource.filename === "string" ? resource.filename : null,
                   contentType: typeof resource.contentType === "string" ? resource.contentType : null,
                   resourceType: typeof resource.resourceType === "string" ? resource.resourceType : null,
                  roles: Array.isArray(resource.roleHints) ? resource.roleHints.filter((role): role is string => typeof role === "string") : [],
                  status: typeof resource.status === "string" ? resource.status : null,
                  parseStatus: null,
                  summary: null,
                })),
              ...pdfUrls.filter((url) => !isPortalActionUrl(url)).map((url) => ({
                documentId: null,
                url,
                label: null,
                 filename: null,
                 contentType: null,
                 resourceType: "document",
                roles: [],
                status: "discovered",
                parseStatus: null,
                summary: null,
              })),
            ]
              .filter((document) => document.documentId !== null || document.url !== null)
              .filter((document, index, documents) => {
                const identity = documentIdentityKey(document)
                  ?? (document.documentId !== null ? `id:${document.documentId}` : document.url);
                return documents.findIndex((candidate) => {
                  const candidateIdentity = documentIdentityKey(candidate)
                    ?? (candidate.documentId !== null ? `id:${candidate.documentId}` : candidate.url);
                  return candidateIdentity === identity;
                }) === index;
              });
            const documentAnalysis = d.documentAnalysis && typeof d.documentAnalysis === "object" && !Array.isArray(d.documentAnalysis)
              ? d.documentAnalysis as Record<string, unknown>
              : null;
            const analysisCoverage = documentAnalysis?.coverage && typeof documentAnalysis.coverage === "object" && !Array.isArray(documentAnalysis.coverage)
              ? documentAnalysis.coverage as Record<string, unknown>
              : null;
            const analysisEvidence = Array.isArray(documentAnalysis?.evidence)
              ? documentAnalysis.evidence.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
              : [];

            return (
              <Stack spacing={3}>
                <Typography variant="h5" component="p" fontWeight={600} sx={{ lineHeight: 1.3, color: "text.primary", fontSize: { xs: "1.5rem", md: "1.75rem" } }}>
                  {title || "–"}
                </Typography>

                {/* Key Facts */}
                <Stack spacing={3}>
                  {client && !markdownHasSection("Auftraggeber") && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Auftraggeber
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "text.primary" }}>
                        {client}
                      </Typography>
                    </Box>
                  )}
                  {estimatedValue && !markdownHasSection("Auftragswert") && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Geschätzter Auftragswert
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "text.primary" }}>
                        {estimatedValue}
                      </Typography>
                    </Box>
                  )}
                  {deadline && !markdownHasSection("Angebotsfrist") && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Frist
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: deadlineColor(deadlineISO ?? deadline) }}>
                        {deadline}{deadlineLabel(deadlineISO ?? deadline) ? ` (${deadlineLabel(deadlineISO ?? deadline)})` : ""}
                      </Typography>
                    </Box>
                  )}
                  {!markdownHasSection("Leistungsort") && <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Standort
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "text.primary" }}>
                      {location}
                    </Typography>
                  </Box>}
                  {procedure && !markdownHasSection("Verfahren") && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Verfahren
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "0.9375rem", lineHeight: 1.5, color: "text.primary" }}>
                        {procedure}
                      </Typography>
                    </Box>
                  )}
                  {duration && !markdownHasSection("Laufzeit") && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Laufzeit
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "0.9375rem", lineHeight: 1.5, color: "text.primary" }}>
                        {duration}
                      </Typography>
                    </Box>
                  )}
                  {t.category && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Kategorie
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "text.primary" }}>
                        {t.category}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                {smallVendorFitValue !== null && (
                  <Box
                    sx={{
                      border: "1px solid var(--color-smallvendor-border)",
                      bgcolor: smallVendorFitValue >= 75 ? "var(--color-smallvendor-soft)" : "transparent",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                      <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.8, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                        Small Vendor Fit
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: smallVendorFitValue >= 75 ? "success.dark" : "text.secondary" }}>
                        {smallVendorFitValue} / 100
                      </Typography>
                      {smallVendorBadges.map((badge) => (
                        <Chip key={badge} label={badge} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />
                      ))}
                    </Box>
                    {smallVendorWhy.length > 0 && (
                      <Box sx={{ mb: smallVendorRisks.length > 0 ? 1.5 : 0 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, color: "text.primary" }}>
                          Warum passt diese Ausschreibung zu einem kleinen Softwareunternehmen?
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {smallVendorWhy.map((item) => (
                            <li key={item}>
                              <Typography variant="body2" sx={{ lineHeight: 1.5, color: "text.primary", fontSize: "0.875rem" }}>
                                {item}
                              </Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                    {smallVendorRisks.length > 0 && (
                      <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, color: "text.primary" }}>
                          Was könnte zum Ausschluss führen?
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {smallVendorRisks.map((item) => (
                            <li key={item}>
                              <Typography variant="body2" sx={{ lineHeight: 1.5, color: "text.primary", fontSize: "0.875rem" }}>
                                {item}
                              </Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Description */}
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                    Beschreibung
                  </Typography>
                  <SafeMarkdown
                    content={descriptionMarkdown}
                    sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "text.primary" }}
                    fallback={
                      <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "text.primary" }}>
                        {description ? (description.length > 600 ? description.slice(0, 600) + "..." : description) : "–"}
                      </Typography>
                    }
                  />
                </Box>

                {/* Scope (detailed) */}
                {scope && scope.length > 0 && scope !== description && !markdownHasScope && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Leistungsumfang
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", whiteSpace: "pre-line", color: "text.primary" }}>
                      {scope}
                    </Typography>
                  </Box>
                )}

                {/* Requirements */}
                {requirements.length > 0 && !markdownHasRequirements && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Anforderungen
                    </Typography>
                    <Stack spacing={0.5}>
                      {requirements.map((req, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", pl: 1.5, color: "text.primary", position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "text.secondary" } }}>
                          {req}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Award Criteria */}
                {awardCriteria.length > 0 && !markdownHasAwards && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Zuschlagskriterien
                    </Typography>
                    <Stack spacing={0.5}>
                      {awardCriteria.map((crit, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", pl: 1.5, color: "text.primary", position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "text.secondary" } }}>
                          {crit}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Contact */}
                {contact && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Kontakt
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", whiteSpace: "pre-line", color: "text.primary" }}>
                      {contact}
                    </Typography>
                  </Box>
                )}

                {/* PDFs */}
                {documentLinks.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Dokumente
                    </Typography>
                    <Stack spacing={1}>
                      {documentLinks.map((document, index) => (
                        <PdfDocumentLink
                          key={`${document.documentId ?? document.url}-${index}`}
                          url={document.url}
                          documentId={document.documentId}
                          tenderId={t.id}
                          index={index}
                          label={document.label}
                          filename={document.filename}
                           roles={document.roles}
                           status={document.status}
                           parseStatus={document.parseStatus}
                           initialSummary={document.summary}
                         />
                      ))}
                    </Stack>
                  </Box>
                )}

                {documentAnalysis && analysisCoverage && (typeof analysisCoverage.discovered === "number" || analysisEvidence.length > 0) && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "text.secondary", fontSize: "0.75rem" }}>
                      Dokumentenanalyse
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.5 }}>
                      {typeof analysisCoverage.parsed === "number" ? analysisCoverage.parsed : 0}/{typeof analysisCoverage.discovered === "number" ? analysisCoverage.discovered : 0} Dokumente analysiert
                    </Typography>
                    {analysisEvidence.slice(0, 4).map((evidence, index) => (
                      <Typography key={`${String(evidence.field)}-${String(evidence.documentId)}-${index}`} variant="caption" sx={{ display: "block", mt: 0.75, color: "text.secondary", lineHeight: 1.5 }}>
                        {documentAnalysisFieldLabel(evidence.field) ? `${documentAnalysisFieldLabel(evidence.field)}: ` : ""}{typeof evidence.quote === "string" ? `„${evidence.quote}”` : ""}{typeof evidence.page === "number" ? ` (Seite ${evidence.page})` : ""}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          {selectedTender && (
            <Button
              href={`/ausschreibung/${selectedTender.id}/${getCanonicalTenderSlug(selectedTender.slug ?? null, selectedTender.title, { client: selectedTender.client, location: selectedTender.location })}`}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<ExternalLink size={20} />}
              variant="contained"
              size="medium"
            >
              Details ansehen
            </Button>
          )}
          {selectedTender?.sourceUrl && (
            <Button
              href={selectedTender.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="medium"
              color="inherit"
              sx={{ color: "text.secondary" }}
            >
              Quelle öffnen
            </Button>
          )}
          <Button onClick={() => setDetailOpen(false)} size="medium">
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



function DeadlineDisplay({ value, compact = false }: { value: string | null | undefined; compact?: boolean }) {
  const date = formatDeadlineDE(value);
  const relative = deadlineLabel(value);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      <Calendar size={compact ? 15 : 18} style={{ opacity: 0.55, flexShrink: 0 }} />
      <Typography
        variant="body2"
        sx={{
          color: date ? deadlineColor(value) : "text.secondary",
          fontSize: compact ? "0.8125rem" : "0.8125rem",
          lineHeight: 1.4,
        }}
      >
        {date ? `${date}${relative ? ` · ${relative}` : ""}` : "Keine Frist bekannt"}
      </Typography>
    </Box>
  );
}

function TenderCard({ tender, onDetailClick, distance }: { tender: ApiTender; onDetailClick: (tender: ApiTender) => void; distance?: number }) {
  const display = projectTenderDisplay(tender);
  const title = display.title ?? "–";
  const client = display.client ?? "–";
  const description = display.description ?? "–";
  const displayLocation = display.location ?? "–";
  const smallVendor = tender.smallVendor;
  const smallVendorHighlight = Boolean(smallVendor && smallVendor.fit >= 75);

  return (
    <Card
      variant="outlined"
      onClick={() => onDetailClick(tender)}
      role="button"
      tabIndex={0}
      aria-label={`${title} prüfen`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDetailClick(tender);
        }
      }}
      sx={{
        cursor: "pointer",
        borderRadius: 2,
        transition: "border-color 0.2s",
        ...(smallVendorHighlight
          ? { bgcolor: "var(--color-smallvendor-soft)", border: "1px solid var(--color-smallvendor-border)" }
          : {}),
        "&:hover": {
          borderColor: "primary.light",
        },
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "flex-start" },
            justifyContent: "space-between",
            gap: { xs: 1, sm: 2 },
            mb: 1.5,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {smallVendor && smallVendor.badges.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
                {smallVendor.badges.map((badge) => (
                  <Chip
                    key={badge}
                    label={badge}
                    size="small"
                    variant="outlined"
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ))}
              </Box>
            )}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: "0.9375rem", color: "text.primary" }}>
              {title}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Building2 size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
                {client}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
            {distance !== undefined && (
              <Chip
                label={`${Math.round(distance)}km`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, height: 22, borderRadius: 1, fontSize: "0.6875rem" }}
              />
            )}
            <Chip
              label={tender.category}
              size="small"
              variant="outlined"
              sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "flex-start" }, height: 22, borderRadius: 1, fontSize: "0.6875rem" }}
            />
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{
            mb: 2,
            lineHeight: 1.5,
            color: "text.primary",
            fontSize: "0.9375rem",
            display: "-webkit-box",
            WebkitLineClamp: { xs: 2, sm: 3 },
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </Typography>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 2 }}
          flexWrap="wrap"
          useFlexGap
          sx={{
            pt: 1.5,
            borderTop: 1,
            borderColor: "divider",
            mb: 1.5,
          }}
        >
          {tender.contractValueMax && tender.contractValueMax > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" fontWeight={600} color="success.main" sx={{ fontSize: "0.8125rem" }}>
                {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(tender.contractValueMax)}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <MapPin size={18} style={{ opacity: 0.5 }} />
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>{displayLocation}</Typography>
          </Box>
          <Box sx={{ ml: { xs: 1, sm: 2 } }}>
            <DeadlineDisplay value={tender.deadlineISO ?? tender.deadline} />
          </Box>
          {tender.referenceNumber && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FileText size={18} style={{ opacity: 0.5 }} />
              <Typography
                variant="body2"
                sx={{ fontFamily: '"IBM Plex Mono", monospace', color: "text.secondary", fontSize: "0.8125rem" }}
              >
                {tender.referenceNumber}
              </Typography>
            </Box>
          )}
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pt: 1.5,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
            Quelle: {tender.source}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "primary.main" }}>
            <Eye size={18} />
            <Typography variant="caption" fontWeight={500} sx={{ fontSize: "0.75rem" }}>
              Ausschreibung prüfen
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
