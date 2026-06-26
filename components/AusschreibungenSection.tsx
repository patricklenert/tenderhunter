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
  Navigation,
} from "lucide-react";
import type { ViewKey } from "@/components/Shell";
import { getAllLocationOptions } from "@/lib/bundesland";

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
            <Typography variant="h6" fontWeight={700} sx={{ color: "#fff", fontSize: { xs: "1rem", sm: "1.25rem" } }}>
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
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          Ausschreibungen durchsuchen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
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
                        <Navigation size={20} />
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

        <Typography variant="body2" color="text.secondary">
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Ausschreibung</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Auftraggeber</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Kategorie</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Standort</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Frist</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Quelle</TableCell>
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
          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
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
          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
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
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Ausschreibung</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Auftraggeber</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Kategorie</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Standort</TableCell>
                {userLocation && <TableCell sx={{ fontWeight: 600 }}>Entfernung</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Frist</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Quelle</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedTenders.map((tender) => (
                <TableRow key={tender.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {tender.title}
                    </Typography>
                    {tender.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {tender.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{tender.client}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={tender.category} size="medium" variant="outlined" />
                  </TableCell>
                  <TableCell>{tender.location}</TableCell>
                  {userLocation && (
                    <TableCell>
                      {tenderDistances[tender.id] !== undefined
                        ? `${Math.round(tenderDistances[tender.id])}km`
                        : "–"}
                    </TableCell>
                  )}
                  <TableCell>{tender.deadline ?? "–"}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{tender.source}</Typography>
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
          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
            Keine Ausschreibungen im Umkreis gefunden
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Erweitern Sie den Suchradius oder entfernen Sie den Standortfilter
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Navigation size={20} />}
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
          <Typography variant="h6" fontWeight={700}>
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
            <Alert severity="error">
              {detailError}
            </Alert>
          )}
          {detailData && selectedTender && (() => {
            const d = detailData as Record<string, unknown>;
            const t = selectedTender;
            const client = typeof d.client === "string" && d.client.length > 0 ? d.client : t.client;
            const location = typeof d.location === "string" && d.location.length > 0 ? d.location : t.location;
            const deadline = typeof d.deadline === "string" && d.deadline.length > 0 ? d.deadline : t.deadline;
            const description = typeof d.description === "string" && d.description.length > 0 ? d.description : t.description;
            const scope = typeof d.scope === "string" && d.scope.length > 0 ? d.scope : null;
            const estimatedValue = typeof d.estimatedValue === "string" && d.estimatedValue.length > 0 ? d.estimatedValue : null;
            const procedure = typeof d.procedure === "string" && d.procedure.length > 0 ? d.procedure : null;
            const duration = typeof d.duration === "string" && d.duration.length > 0 ? d.duration : null;
            const contact = typeof d.contact === "string" && d.contact.length > 0 ? d.contact : null;
            const requirements = Array.isArray(d.requirements) ? d.requirements as string[] : [];
            const awardCriteria = Array.isArray(d.awardCriteria) ? d.awardCriteria as string[] : [];
            const pdfUrls = Array.isArray(d.pdfUrls) ? d.pdfUrls as string[] : t.pdfUrls ?? [];
            const deadlineUrgent = t.deadlineISO ? (new Date(t.deadlineISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 7 : false;

            return (
              <Stack spacing={4}>
                <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                  {t.title}
                </Typography>

                {/* Key Facts */}
                <Stack spacing={3}>
                  {client && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Auftraggeber
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1.3rem", lineHeight: 1.3 }}>
                        {client}
                      </Typography>
                    </Box>
                  )}
                  {estimatedValue && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Geschätzter Auftragswert
                      </Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.5rem", lineHeight: 1.3, color: "success.main" }}>
                        {estimatedValue}
                      </Typography>
                    </Box>
                  )}
                  {deadline && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Frist
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1.3rem", lineHeight: 1.3, color: deadlineUrgent ? "error.main" : "text.primary" }}>
                        {deadline}
                      </Typography>
                    </Box>
                  )}
                  {location && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Standort
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1.3rem", lineHeight: 1.3 }}>
                        {location}
                      </Typography>
                    </Box>
                  )}
                  {procedure && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Verfahren
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "1.05rem", lineHeight: 1.4 }}>
                        {procedure}
                      </Typography>
                    </Box>
                  )}
                  {duration && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Laufzeit
                      </Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ fontSize: "1.05rem", lineHeight: 1.4 }}>
                        {duration}
                      </Typography>
                    </Box>
                  )}
                  {t.category && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 0.5, lineHeight: 1.2 }}>
                        Kategorie
                      </Typography>
                      <Typography variant="h6" fontWeight={600} sx={{ fontSize: "1.3rem", lineHeight: 1.3 }}>
                        {t.category}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                {/* Description */}
                {description && description.length > 0 && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Beschreibung
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.7, fontSize: "1.05rem" }}>
                      {description.length > 600 ? description.slice(0, 600) + "..." : description}
                    </Typography>
                  </Box>
                )}

                {/* Scope (detailed) */}
                {scope && scope.length > 0 && scope !== description && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Leistungsumfang
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.7, fontSize: "1.05rem", whiteSpace: "pre-line" }}>
                      {scope}
                    </Typography>
                  </Box>
                )}

                {/* Requirements */}
                {requirements.length > 0 && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Anforderungen
                    </Typography>
                    <Stack spacing={0.5}>
                      {requirements.map((req, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.6, fontSize: "1rem", pl: 1.5, position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "text.secondary" } }}>
                          {req}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Award Criteria */}
                {awardCriteria.length > 0 && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Zuschlagskriterien
                    </Typography>
                    <Stack spacing={0.5}>
                      {awardCriteria.map((crit, i) => (
                        <Typography key={i} variant="body1" sx={{ lineHeight: 1.6, fontSize: "1rem", pl: 1.5, position: "relative", "&::before": { content: '"•"', position: "absolute", left: 0, color: "text.secondary" } }}>
                          {crit}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Contact */}
                {contact && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Kontakt
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.7, fontSize: "1.05rem", whiteSpace: "pre-line" }}>
                      {contact}
                    </Typography>
                  </Box>
                )}

                {/* PDFs */}
                {pdfUrls.length > 0 && (
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.8, display: "block", mb: 1, lineHeight: 1.2 }}>
                      Dokumente
                    </Typography>
                    <Stack spacing={1}>
                      {pdfUrls.map((url, i) => (
                        <Link
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body1"
                          sx={{ color: "primary.main", textDecoration: "none", fontSize: "1rem", "&:hover": { textDecoration: "underline" } }}
                        >
                          {url.split("/").pop() ?? `Dokument ${i + 1}`}
                        </Link>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          {selectedTender?.sourceUrl && (
            <Button
              href={selectedTender.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<ExternalLink size={20} />}
              size="medium"
            >
              Original ansehen
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
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": {
          borderColor: "primary.light",
          boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 3, sm: 4 }, "&:last-child": { pb: { xs: 3, sm: 4 } } }}>
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
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
              {tender.title}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Building2 size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                {tender.client}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
            {distance !== undefined && (
              <Chip
                label={`${Math.round(distance)}km`}
                size="medium"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            <Chip
              label={tender.category}
              size="medium"
              variant="outlined"
              sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "flex-start" } }}
            />
          </Box>
        </Box>

        {tender.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              lineHeight: 1.6,
              fontSize: { xs: "0.9rem", sm: "1rem" },
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
              <Typography variant="body2" fontWeight={600} color="success.main" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(tender.contractValueMax)}
              </Typography>
            </Box>
          )}
          {tender.location && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <MapPin size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>{tender.location}</Typography>
            </Box>
          )}
          {tender.deadline && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Calendar size={18} style={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>Frist: {tender.deadline}</Typography>
            </Box>
          )}
          {tender.referenceNumber && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FileText size={18} style={{ opacity: 0.5 }} />
              <Typography
                variant="body2"
                sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: { xs: "0.9rem", sm: "1rem" } }}
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
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
            Quelle: {tender.source}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "primary.main" }}>
            <Eye size={18} />
            <Typography variant="caption" fontWeight={500} sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
              Details
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
