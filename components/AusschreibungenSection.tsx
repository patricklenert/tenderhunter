"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
}

export function AusschreibungenSection({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showBanner, setShowBanner] = useState(false);
  const [tenders, setTenders] = useState<ApiTender[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

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

  const searchTendersApi = useCallback(async (query: string, location: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (location.startsWith("bl:")) params.set("bundesland", location.slice(3));
      if (location.startsWith("city:")) params.set("city", location.slice(5));
      params.set("limit", "100");

      const res = await fetch(`/api/tenders/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTenders(data.items ?? []);
      setTotalResults(data.total ?? data.items?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
      setTenders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchTendersApi(searchQuery, selectedLocation);
    }, searchQuery ? 350 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedLocation, searchTendersApi]);

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
  }, []);

  const locationOptions = useMemo(() => getAllLocationOptions(), []);

  const displayedTenders = useMemo(() => {
    if (!userLocation) return tenders;
    return tenders.filter((tender) => {
      const distance = tenderDistances[tender.id];
      if (distance === undefined) return true;
      return distance <= GEO_RADIUS_KM;
    });
  }, [tenders, userLocation, tenderDistances]);

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
              Mehr Umsatz durch Ausschreibungen für Ihre Firma
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
              onClick={() => searchTendersApi(searchQuery, selectedLocation)}
              disabled={loading}
              size="medium"
              sx={{ height: 48, width: 48 }}
            >
              <RefreshCw size={22} className={loading ? "animate-spin" : ""} />
            </IconButton>
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
          {loading
            ? "Lade Ausschreibungen..."
            : userLocation
            ? `${displayedTenders.length} von ${tenders.length} Ausschreibungen im Umkreis von ${GEO_RADIUS_KM}km`
            : `${totalResults} Ausschreibungen gefunden`}
        </Typography>
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
            onClick={() => searchTendersApi(searchQuery, selectedLocation)}
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
            {searchQuery || selectedLocation ? "Keine Ausschreibungen gefunden" : "Noch keine Ausschreibungen vorhanden"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: "auto" }}>
            {searchQuery || selectedLocation
              ? "Versuchen Sie andere Suchbegriffe oder Standortfilter."
              : "Der Hintergrund-Job sucht automatisch nach neuen Ausschreibungen."}
          </Typography>
          {(searchQuery || selectedLocation) ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => {
                setSearchQuery("");
                setSelectedLocation("");
                clearGeolocation();
              }}
            >
              Filter zurücksetzen
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={20} />}
              onClick={() => searchTendersApi("", "")}
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
                    <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{tender.location}</Typography>
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
                    <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{tender.deadline ?? "–"}</Typography>
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
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="h6" component="p" fontWeight={600} sx={{ color: "#1e293b", fontSize: "1.25rem" }}>
            Ausschreibung
          </Typography>
          <IconButton onClick={() => setDetailOpen(false)} size="medium">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
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
            <Alert severity={detailError === "Ausschreibung nicht gefunden" ? "warning" : "error"}>
              {detailError === "Ausschreibung nicht gefunden"
                ? "Diese Ausschreibung ist nicht mehr verfügbar. Sie wurde entfernt oder ist abgelaufen."
                : detailError}
            </Alert>
          )}
          {detailData && selectedTender && (() => {
            const d = detailData as Record<string, unknown>;
            const t = selectedTender;
            const client = typeof d.client === "string" && d.client.length > 0 ? d.client : t.client;
            const location = typeof d.location === "string" && d.location.length > 0 ? d.location : t.location;
            const deadline = typeof d.deadline === "string" && d.deadline.length > 0 ? d.deadline : t.deadline;
            const deadlineISO = typeof d.deadlineISO === "string" && d.deadlineISO.length > 0 ? d.deadlineISO : t.deadlineISO;
            const description = typeof d.description === "string" && d.description.length > 0 ? d.description : t.description;
            const scope = typeof d.scope === "string" && d.scope.length > 0 ? d.scope : null;
            const estimatedValue = typeof d.estimatedValue === "string" && d.estimatedValue.length > 0 ? d.estimatedValue : null;
            const procedure = typeof d.procedure === "string" && d.procedure.length > 0 ? d.procedure : null;
            const duration = typeof d.duration === "string" && d.duration.length > 0 ? d.duration : null;
            const contact = typeof d.contact === "string" && d.contact.length > 0 ? d.contact : null;
            const requirements = Array.isArray(d.requirements) ? d.requirements as string[] : [];
            const awardCriteria = Array.isArray(d.awardCriteria) ? d.awardCriteria as string[] : [];
            const pdfUrls = Array.isArray(d.pdfUrls) ? d.pdfUrls as string[] : t.pdfUrls ?? [];

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

                {/* Description */}
                {description && description.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Beschreibung
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "#334155" }}>
                      {description.length > 600 ? description.slice(0, 600) + "..." : description}
                    </Typography>
                  </Box>
                )}

                {/* Scope (detailed) */}
                {scope && scope.length > 0 && scope !== description && (
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
                {requirements.length > 0 && (
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
                {awardCriteria.length > 0 && (
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
                {pdfUrls.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2, color: "#475569", fontSize: "0.75rem" }}>
                      Dokumente
                    </Typography>
                    <Stack spacing={1}>
                      {pdfUrls.map((url, i) => (
                        <PdfDocumentLink key={i} url={url} index={i} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          {selectedTender && (
            <Button
              href={`/ausschreibung/${selectedTender.id}/${generateTenderSlug(selectedTender.title, selectedTender.location)}`}
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
          direction={{ xs: "column", sm: "row" }}
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
          {tender.location && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <MapPin size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>{tender.location}</Typography>
            </Box>
          )}
          {tender.deadline && formatDeadlineDE(tender.deadline) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Calendar size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>Frist: {formatDeadlineDE(tender.deadline)}{deadlineLabel(tender.deadlineISO ?? tender.deadline) ? ` (${deadlineLabel(tender.deadlineISO ?? tender.deadline)})` : ""}</Typography>
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
