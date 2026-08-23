"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
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
  AlertCircle,
  // Crosshair,  // Ursprüngliches Standort-Icon (Lucide) — auskommentiert für Rollback
} from "lucide-react";
import { SearchLocationIcon } from "@/components/icons/SidebarIcons";
import type { ViewKey } from "@/components/Shell";
import { getAllLocationOptions } from "@/lib/bundesland";
import { formatDeadlineDE, deadlineLabel, deadlineColor, cleanPdfFilename } from "@/lib/date-utils";
import { PdfDocumentLink } from "@/components/PdfDocumentLink";
import { TenderQuickCheck } from "@/components/TenderQuickCheck";
import type { TenderCheck } from "@/lib/tender-check";
import { documentAnalysisFieldLabel } from "@/lib/document-analysis";
import { documentIdentityKey } from "@/lib/document-identity";
import { isPortalActionUrl } from "@/lib/resource-url";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { generateTenderSlug } from "@/lib/tender-slug";

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
}

const PAGE_SIZE = 30;

export function AusschreibungenSection({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showBanner, setShowBanner] = useState(false);
  const [tenders, setTenders] = useState<ApiTender[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [todayNewOnly, setTodayNewOnly] = useState(false);
  const [todayNewCount, setTodayNewCount] = useState(0);
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
    query: string,
    location: string,
    signal?: AbortSignal,
    page = 1,
    append = false,
    todayNew = false,
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
      if (query.trim()) params.set("q", query.trim());
      if (location.startsWith("bl:")) params.set("bundesland", location.slice(3));
      if (location.startsWith("city:")) params.set("city", location.slice(5));
      if (todayNew) params.set("todayNew", "1");
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
      searchTendersApi(searchQuery, selectedLocation, controller.signal, 1, false, todayNewOnly);
    }, searchQuery ? 350 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery, selectedLocation, searchTendersApi, todayNewOnly]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    void searchTendersApi(searchQuery, selectedLocation, undefined, currentPage + 1, true, todayNewOnly);
  }, [currentPage, hasMore, loading, searchQuery, selectedLocation, searchTendersApi, todayNewOnly]);

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
          void searchTendersApi(searchQuery, selectedLocation, undefined, 1, false, todayNewOnly);
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
  }, [searchTendersApi, searchQuery, selectedLocation, todayNewOnly]);

  const locationOptions = useMemo(() => getAllLocationOptions(), []);

  const displayedTenders = useMemo(() => {
    if (!userLocation) return tenders;
    return tenders.filter((tender) => {
      const distance = tenderDistances[tender.id];
      if (distance === undefined) return true;
      return distance <= GEO_RADIUS_KM;
    });
  }, [tenders, userLocation, tenderDistances]);

  const hasActiveFilters = Boolean(searchQuery || selectedLocation || todayNewOnly);

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
            bgcolor: "#1E3A5F",
            color: "#fff",
            p: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 4 },
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: { xs: 1.5, sm: 3 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="p" fontWeight={700} sx={{ color: "#fff", fontSize: { xs: "1rem", sm: "1.25rem" } }}>
              Langfristige Verträge mit Behörden und Landesbaubetrieben
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: { xs: "space-between", sm: "flex-end" } }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => onNavigate?.("discovery")}
              sx={{
                whiteSpace: "nowrap",
                bgcolor: "#D4A574",
                color: "#1E3A5F",
                fontWeight: 700,
                fontSize: { xs: "0.85rem", sm: "0.95rem" },
                px: { xs: 2, sm: 3 },
                py: { xs: 1, sm: "auto" },
                flex: { xs: 1, sm: "auto" },
                "&:hover": { bgcolor: "#c49464" },
              }}
            >
              Kostenlose KI-Analyse starten
            </Button>
            <IconButton
              size="medium"
              onClick={dismissBanner}
              sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}
            >
              <X size={18} />
            </IconButton>
          </Box>
        </Paper>
      </Collapse>

      {/* Search and Filter Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" fontWeight={600} sx={{ mb: 1, color: "#1e293b", fontSize: { xs: "1.25rem", md: "1.375rem" } }}>
          Ausschreibungen durchsuchen
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: "#475569", fontSize: "0.9375rem" }}>
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
            >
              <ToggleButton value="cards"><LayoutGrid size={22} /></ToggleButton>
              <ToggleButton value="table"><List size={22} /></ToggleButton>
            </ToggleButtonGroup>
            <IconButton
              onClick={() => searchTendersApi(searchQuery, selectedLocation, undefined, 1, false, todayNewOnly)}
              disabled={loading}
              size="medium"
              sx={{ height: 48, width: 48 }}
            >
              <RefreshCw size={22} className={loading ? "animate-spin" : ""} />
            </IconButton>
          </Box>
        </Stack>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
            {loading
              ? "Lade Ausschreibungen..."
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
              borderColor: todayNewOnly ? "#166534" : "transparent",
              borderRadius: 1,
              color: "#166534",
              backgroundColor: todayNewOnly ? "rgba(22, 101, 52, 0.1)" : "transparent",
              fontSize: "0.8125rem",
              fontWeight: todayNewOnly ? 700 : 500,
              lineHeight: 1.5,
              textTransform: "none",
              "&:hover": {
                backgroundColor: "rgba(22, 101, 52, 0.1)",
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
        <>
          {viewMode === "cards" ? (
            <Stack spacing={2}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} variant="outlined">
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "6px" }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Ausschreibung</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Auftraggeber</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Kategorie</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Standort</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Frist</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Quelle</TableCell>
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
            </TableContainer>
          )}
        </>
      )}

      {/* Error state */}
      {error && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            borderRadius: 3,
            p: 4,
            textAlign: "center",
            bgcolor: "error.light",
            color: "error.contrastText",
          }}
        >
          <AlertCircle size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <Typography variant="h6" component="p" fontWeight={600} sx={{ mb: 1 }}>
            Fehler beim Laden
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
            {error}
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshCw size={20} />}
            onClick={() => searchTendersApi(searchQuery, selectedLocation, undefined, 1, false, todayNewOnly)}
            sx={{
              bgcolor: "#1E3A5F",
              color: "#fff",
              "&:hover": { bgcolor: "#152a45" },
            }}
          >
            Erneut laden
          </Button>
        </Paper>
      )}

      {/* Empty state */}
      {!loading && tenders.length === 0 && !error && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ borderRadius: 3, p: 6, textAlign: "center" }}
        >
          <FileText size={48} color="currentColor" style={{ opacity: 0.3, marginBottom: 16 }} />
          <Typography variant="h6" component="p" fontWeight={600} sx={{ mb: 1 }}>
            {todayNewOnly
              ? "Keine Ausschreibungen in den letzten 3 Tagen gefunden"
              : hasActiveFilters
              ? "Keine Ausschreibungen gefunden"
              : "Noch keine Ausschreibungen vorhanden"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: "auto" }}>
            {todayNewOnly
              ? "Versuchen Sie andere Suchbegriffe oder Standortfilter oder setzen Sie den Filter zurück."
              : hasActiveFilters
              ? "Versuchen Sie andere Suchbegriffe oder Standortfilter."
              : "Der Hintergrund-Job sucht automatisch nach neuen Ausschreibungen."}
          </Typography>
          {hasActiveFilters ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => {
                setSearchQuery("");
                setSelectedLocation("");
                setTodayNewOnly(false);
                clearGeolocation();
              }}
            >
              Filter zurücksetzen
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => searchTendersApi("", "", undefined, 1, false, todayNewOnly)}
            >
              Jetzt laden
            </Button>
          )}
        </Paper>
      )}

      {/* Cards view */}
      {!loading && displayedTenders.length > 0 && viewMode === "cards" && (
        <Stack spacing={2}>
          {displayedTenders.map((tender) => (
            <TenderCard key={tender.id} tender={tender} onDetailClick={fetchDetail} distance={tenderDistances[tender.id]} />
          ))}
        </Stack>
      )}

      {/* Table view */}
      {!loading && displayedTenders.length > 0 && viewMode === "table" && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "6px" }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Ausschreibung</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Auftraggeber</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Kategorie</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Standort</TableCell>
                {userLocation && <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Entfernung</TableCell>}
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Frist</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8125rem" }}>Quelle</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedTenders.map((tender) => (
                <TableRow key={tender.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ color: "#1e293b", fontSize: "0.9375rem" }}>
                      {tender.title}
                    </Typography>
                    {tender.description && (
                      <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {tender.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{tender.client}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={tender.category} size="small" variant="outlined" sx={{ height: 22, borderRadius: "4px", fontSize: "0.6875rem" }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <MapPin size={15} style={{ opacity: 0.55 }} />
                      <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{tender.location || tender.bundesland || "–"}</Typography>
                    </Box>
                  </TableCell>
                  {userLocation && (
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                        {tenderDistances[tender.id] !== undefined
                          ? `${Math.round(tenderDistances[tender.id])}km`
                          : "–"}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    {deadlineLabel(tender.deadlineISO ?? tender.deadline) ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Calendar size={15} style={{ opacity: 0.55 }} />
                        <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                          {deadlineLabel(tender.deadlineISO ?? tender.deadline)}
                        </Typography>
                      </Box>
                    ) : "–"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>{tender.source}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="medium"
                      onClick={() => fetchDetail(tender)}
                      sx={{ minWidth: 0 }}
                    >
                      <Eye size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
        <Paper
          elevation={0}
          variant="outlined"
          sx={{ borderRadius: 3, py: 6, textAlign: "center" }}
        >
          <Search size={48} color="currentColor" style={{ opacity: 0.3, marginBottom: 16 }} />
          <Typography variant="h6" component="p" fontWeight={600} sx={{ mb: 1 }}>
            Keine Ausschreibungen im Umkreis gefunden
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Erweitern Sie den Suchradius oder entfernen Sie den Standortfilter
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SearchLocationIcon size={20} />}
            onClick={clearGeolocation}
          >
            Standortfilter entfernen
          </Button>
        </Paper>
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
            <Typography variant="h6" component="p" fontWeight={600} sx={{ color: "#1e293b", fontSize: "1.25rem" }}>
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
          <IconButton onClick={() => setDetailOpen(false)} size="medium">
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
            const client = typeof d.client === "string" && d.client.length > 0 ? d.client : t.client;
            const location = typeof d.location === "string" && d.location.length > 0
              ? d.location
              : t.location || t.bundesland || "";
            const deadline = typeof d.deadline === "string" && d.deadline.length > 0 ? d.deadline : t.deadline;
            const deadlineISO = typeof d.deadlineISO === "string" && d.deadlineISO.length > 0 ? d.deadlineISO : t.deadlineISO;
            const description = typeof d.description === "string" && d.description.length > 0 ? d.description : t.description;
            const descriptionMarkdown = typeof d.descriptionMarkdown === "string" && d.descriptionMarkdown.trim().length > 0 ? d.descriptionMarkdown : null;
            const markdownHasSection = (label: string): boolean => Boolean(descriptionMarkdown?.includes(`- **${label}:**`));
            const markdownHasScope = markdownHasSection("Leistungsumfang");
            const markdownHasRequirements = markdownHasSection("Anforderungen");
            const markdownHasAwards = markdownHasSection("Zuschlagskriterien");
            const scope = typeof d.scope === "string" && d.scope.length > 0 ? d.scope : null;
            const estimatedValue = typeof d.estimatedValue === "string" && d.estimatedValue.length > 0 ? d.estimatedValue : null;
            const procedure = typeof d.procedure === "string" && d.procedure.length > 0 ? d.procedure : null;
            const duration = typeof d.duration === "string" && d.duration.length > 0 ? d.duration : null;
            const contact = typeof d.contact === "string" && d.contact.length > 0 ? d.contact : null;
            const requirements = Array.isArray(d.requirements) ? d.requirements as string[] : [];
            const awardCriteria = Array.isArray(d.awardCriteria) ? d.awardCriteria as string[] : [];
            const pdfUrls = Array.isArray(d.pdfUrls) ? d.pdfUrls as string[] : t.pdfUrls ?? [];
            const documentRows = Array.isArray(d.documents)
              ? d.documents.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
                .filter((document) => !isPortalActionUrl(typeof document.url === "string" ? document.url : null))
              : [];
            const resourceRows = Array.isArray(d.resources)
              ? d.resources.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
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
            const tenderCheck = d.documentCheck && typeof d.documentCheck === "object" && !Array.isArray(d.documentCheck)
              ? d.documentCheck as TenderCheck
              : null;
            const analysisCoverage = documentAnalysis?.coverage && typeof documentAnalysis.coverage === "object" && !Array.isArray(documentAnalysis.coverage)
              ? documentAnalysis.coverage as Record<string, unknown>
              : null;
            const analysisEvidence = Array.isArray(documentAnalysis?.evidence)
              ? documentAnalysis.evidence.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
              : [];
            const commercialBrief = d.commercialBrief && typeof d.commercialBrief === "object" && !Array.isArray(d.commercialBrief)
              ? d.commercialBrief as Record<string, unknown>
              : null;
            const briefHeadline = typeof commercialBrief?.headline === "string" ? commercialBrief.headline : null;
            const briefRationale = typeof commercialBrief?.rationale === "string" ? commercialBrief.rationale : null;
            const briefNextAction = typeof commercialBrief?.nextAction === "string" ? commercialBrief.nextAction : null;

            return (
              <Stack spacing={3}>
                <Typography variant="h5" component="p" fontWeight={600} sx={{ lineHeight: 1.3, color: "#1e293b", fontSize: { xs: "1.5rem", md: "1.75rem" } }}>
                  {t.title}
                </Typography>

                {/* Key Facts */}
                <Stack spacing={3}>
                  {client && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Auftraggeber
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "#1e293b" }}>
                        {client}
                      </Typography>
                    </Box>
                  )}
                  {estimatedValue && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Geschätzter Auftragswert
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "#1e293b" }}>
                        {estimatedValue}
                      </Typography>
                    </Box>
                  )}
                  {deadline && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Frist
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: deadlineColor(deadlineISO ?? deadline) }}>
                        {deadline}{deadlineLabel(deadlineISO ?? deadline) ? ` (${deadlineLabel(deadlineISO ?? deadline)})` : ""}
                      </Typography>
                    </Box>
                  )}
                  {location && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Standort
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "#1e293b" }}>
                        {location}
                      </Typography>
                    </Box>
                  )}
                  {procedure && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Verfahren
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "0.9375rem", lineHeight: 1.5, color: "#334155" }}>
                        {procedure}
                      </Typography>
                    </Box>
                  )}
                  {duration && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Laufzeit
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "0.9375rem", lineHeight: 1.5, color: "#334155" }}>
                        {duration}
                      </Typography>
                    </Box>
                  )}
                  {t.category && (
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                        Kategorie
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1rem", lineHeight: 1.3, color: "#1e293b" }}>
                        {t.category}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                {briefHeadline && briefRationale && briefNextAction && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#f0f6f8" }}>
                    <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.8, display: "block", mb: 0.75, lineHeight: 1.2, color: "#365d6c", fontSize: "0.75rem" }}>
                      Geschäftsentscheidung
                    </Typography>
                    <Typography sx={{ color: "#163b4a", fontWeight: 700, lineHeight: 1.4 }}>
                      {briefHeadline}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.75, color: "#38505b", lineHeight: 1.55 }}>
                      {briefRationale}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: "#163b4a", fontWeight: 700, lineHeight: 1.5 }}>
                      Nächster Schritt: {briefNextAction}
                    </Typography>
                  </Box>
                )}

                <TenderQuickCheck key={`quick-check-${t.id}`} tenderId={t.id} initialCheck={tenderCheck} />

                {/* Description */}
                {(descriptionMarkdown || (description && description.length > 0)) && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Beschreibung
                    </Typography>
                    <SafeMarkdown
                      content={descriptionMarkdown}
                      sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "#334155" }}
                      fallback={
                        <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "#334155" }}>
                          {description.length > 600 ? description.slice(0, 600) + "..." : description}
                        </Typography>
                      }
                    />
                  </Box>
                )}

                {/* Scope (detailed) */}
                {scope && scope.length > 0 && scope !== description && !markdownHasScope && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Leistungsumfang
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", whiteSpace: "pre-line", color: "#334155" }}>
                      {scope}
                    </Typography>
                  </Box>
                )}

                {/* Requirements */}
                {requirements.length > 0 && !markdownHasRequirements && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Anforderungen
                    </Typography>
                    <Stack spacing={0.5}>
                      {requirements.map((req, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", pl: 1.5, color: "#334155", position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "#475569" } }}>
                          {req}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Award Criteria */}
                {awardCriteria.length > 0 && !markdownHasAwards && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Zuschlagskriterien
                    </Typography>
                    <Stack spacing={0.5}>
                      {awardCriteria.map((crit, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", pl: 1.5, color: "#334155", position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "#475569" } }}>
                          {crit}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Contact */}
                {contact && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Kontakt
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", whiteSpace: "pre-line", color: "#334155" }}>
                      {contact}
                    </Typography>
                  </Box>
                )}

                {/* PDFs */}
                {documentLinks.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
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
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Dokumentenanalyse
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#334155", lineHeight: 1.5 }}>
                      {typeof analysisCoverage.parsed === "number" ? analysisCoverage.parsed : 0}/{typeof analysisCoverage.discovered === "number" ? analysisCoverage.discovered : 0} Dokumente analysiert
                    </Typography>
                    {analysisEvidence.slice(0, 4).map((evidence, index) => (
                      <Typography key={`${String(evidence.field)}-${String(evidence.documentId)}-${index}`} variant="caption" sx={{ display: "block", mt: 0.75, color: "#475569", lineHeight: 1.5 }}>
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
              href={`/ausschreibung/${selectedTender.id}/${selectedTender.slug ?? generateTenderSlug(selectedTender.title, selectedTender.location)}`}
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



function TenderCard({ tender, onDetailClick, distance }: { tender: ApiTender; onDetailClick: (tender: ApiTender) => void; distance?: number }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const displayLocation = tender.location || tender.bundesland || "";

  return (
    <Card
      variant="outlined"
      onClick={() => onDetailClick(tender)}
      sx={{
        cursor: "pointer",
        borderRadius: "6px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": {
          borderColor: "primary.light",
          boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
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
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: "0.9375rem", color: "#1e293b" }}>
              {tender.title}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Building2 size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                {tender.client}
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
                sx={{ fontWeight: 600, height: 22, borderRadius: "4px", fontSize: "0.6875rem" }}
              />
            )}
            <Chip
              label={tender.category}
              size="small"
              variant="outlined"
              sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "flex-start" }, height: 22, borderRadius: "4px", fontSize: "0.6875rem" }}
            />
          </Box>
        </Box>

        {tender.description && (
          <Typography
            variant="body2"
            sx={{
              mb: 2,
              lineHeight: 1.5,
              color: "#334155",
              fontSize: "0.9375rem",
              display: "-webkit-box",
              WebkitLineClamp: { xs: 2, sm: 3 },
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tender.description}
          </Typography>
        )}

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
          {displayLocation && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <MapPin size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{displayLocation}</Typography>
            </Box>
          )}
          {(tender.deadlineISO ?? tender.deadline) && formatDeadlineDE(tender.deadlineISO ?? tender.deadline) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: { xs: 1, sm: 2 } }}>
              <Calendar size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                {deadlineLabel(tender.deadlineISO ?? tender.deadline)}
              </Typography>
            </Box>
          )}
          {tender.referenceNumber && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FileText size={18} style={{ opacity: 0.5 }} />
              <Typography
                variant="body2"
                sx={{ fontFamily: '"IBM Plex Mono", monospace', color: "#475569", fontSize: "0.8125rem" }}
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
          <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
            Quelle: {tender.source}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "primary.main" }}>
            <Eye size={18} />
            <Typography variant="caption" fontWeight={500} sx={{ fontSize: "0.75rem" }}>
              Details
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
