"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Card, CardContent, Chip, Collapse, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { ArrowUpRight, Building2, CalendarClock, MapPin, Search } from "lucide-react";
import { US_CATEGORIES } from "@/lib/us/categorize";
import { PaywallPanel } from "@/components/billing/PaywallPanel";
import { ResourceState } from "@/components/ResourceState";

export interface UsTenderItem {
  id: number;
  title: string;
  source: string;
  sourceUrl: string;
  buyer: string | null;
  location: string | null;
  state: string | null;
  solicitationNumber: string | null;
  naicsCodes: string[];
  pscCodes: string[];
  setAside: string | null;
  contractType: string | null;
  category: string | null;
  deadline: string | null;
  subcontracting: boolean;
}

interface SearchResponse {
  items: UsTenderItem[];
  total: number;
}

const US_STATES = ["", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

const US_CATEGORY_LABELS: Record<(typeof US_CATEGORIES)[number], string> = {
  "Construction & Infrastructure": "Bau und Infrastruktur",
  "IT & Software": "IT und Software",
  "Professional Services": "Fach- und Beratungsleistungen",
  "Healthcare & Social Services": "Gesundheit und Soziales",
  "Facilities & Maintenance": "Gebäudemanagement und Instandhaltung",
  "Equipment & Supplies": "Ausrüstung und Lieferungen",
  Transportation: "Transport und Logistik",
  "Education & Training": "Bildung und Weiterbildung",
  Other: "Weitere",
};

const getUsCategoryLabel = (category: string) =>
  US_CATEGORY_LABELS[category as keyof typeof US_CATEGORY_LABELS] ?? category;

export function UsTendersSection({ initialItems, initialTotal }: { initialItems?: UsTenderItem[]; initialTotal?: number }) {
  const hasInitialData = initialItems !== undefined;
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const [subcontracting, setSubcontracting] = useState<"all" | "sub" | "direct">("all");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertPaywall, setAlertPaywall] = useState(false);
  const [items, setItems] = useState<UsTenderItem[]>(initialItems ?? []);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasFilters = Boolean(query.trim() || state || category || subcontracting !== "all");
    if (hasInitialData && !hasFilters) {
      setItems(initialItems ?? []);
      setTotal(initialTotal ?? 0);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "24" });
        if (query.trim()) params.set("q", query.trim());
        if (state) params.set("state", state);
        if (category) params.set("category", category);
        if (subcontracting === "sub") params.set("subcontracting", "true");
        if (subcontracting === "direct") params.set("subcontracting", "false");
        const response = await fetch(`/api/us/tenders?${params}`, { signal: controller.signal });
        if (!response.ok) {
          setError("Bitte versuchen Sie es erneut.");
          return;
        }
        const payload = await response.json() as SearchResponse;
        setItems(payload.items);
        setTotal(payload.total);
      } catch {
        if (!controller.signal.aborted) setError("Bitte versuchen Sie es erneut.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, hasFilters ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, state, category, subcontracting, initialItems, initialTotal]);

  const subscribeToAlerts = async () => {
    setAlertLoading(true);
    setAlertMessage(null);
    setAlertPaywall(false);
    try {
      const response = await fetch("/api/us/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: alertEmail,
          filters: {
            ...(query.trim() ? { query: query.trim() } : {}),
            ...(state ? { state } : {}),
            ...(category ? { category } : {}),
            ...(subcontracting === "sub" ? { subcontracting: true } : {}),
            ...(subcontracting === "direct" ? { subcontracting: false } : {}),
          },
        }),
      });
      const payload = await response.json() as { status?: string };
      if (response.status === 401 || response.status === 402) {
        setAlertPaywall(true);
        return;
      }
      if (!response.ok) throw new Error("Die Suchbenachrichtigung konnte nicht eingerichtet werden.");
      setAlertMessage(payload.status === "already_confirmed"
        ? "Diese Suchbenachrichtigung ist bereits aktiv."
        : "Bitte bestätigen Sie Ihre Anmeldung über den Link in der E-Mail.");
      if (payload.status !== "already_confirmed") setAlertEmail("");
    } catch {
      setAlertMessage("Die Suchbenachrichtigung konnte nicht eingerichtet werden. Bitte versuchen Sie es erneut.");
    } finally {
      setAlertLoading(false);
    }
  };

  return (
    <Box component="section" lang="de" aria-busy={loading || undefined} sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-start" }} spacing={2}>
          <Box sx={{ maxWidth: 760 }}>
            <Typography variant="h5" component="h1" fontWeight={600} sx={{ color: "text.primary", fontSize: { xs: "1.5rem", md: "1.75rem" } }}>
              Öffentliche und private Aufträge in den USA
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary", fontSize: "0.9375rem", lineHeight: 1.6 }}>
              Finden Sie öffentliche und private US-Aufträge, darunter Bundesaufträge und passende Unteraufträge.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button component={Link} href="/us/profile" variant="outlined" size="small" sx={{ whiteSpace: "nowrap" }}>
              US-Unternehmensprofil einrichten
            </Button>
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => setAlertOpen((open) => !open)}
              aria-expanded={alertOpen}
              sx={{ whiteSpace: "nowrap" }}
            >
              {alertOpen ? "Suchbenachrichtigung schließen" : "Suchbenachrichtigung einrichten"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) repeat(3, minmax(140px, 0.38fr))" },
            gap: 2,
            mb: 2,
          }}
        >
          <TextField
            fullWidth
            label="Suchbegriffe"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Stichworte, Auftraggeber oder Auftragsnummer"
            slotProps={{ input: { startAdornment: <Search size={22} style={{ marginRight: 10 }} /> } }}
          />
          <TextField select fullWidth label="Kategorie" value={category} onChange={(event) => setCategory(event.target.value)}>
            <MenuItem value="">Alle Kategorien</MenuItem>
            {US_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{getUsCategoryLabel(item)}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Bundesstaat" value={state} onChange={(event) => setState(event.target.value)}>
            {US_STATES.map((item) => <MenuItem key={item || "all"} value={item}>{item || "Alle Bundesstaaten"}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Auftragsart" value={subcontracting} onChange={(event) => setSubcontracting(event.target.value as "all" | "sub" | "direct")}>
            <MenuItem value="all">Alle Auftragsarten</MenuItem>
            <MenuItem value="direct">US-Bundesauftrag</MenuItem>
            <MenuItem value="sub">Unterauftrag</MenuItem>
          </TextField>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
            {loading ? "US-Aufträge werden aktualisiert" : `${total.toLocaleString("de-DE")} aktive Aufträge`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            US-Bundesaufträge und Unteraufträge
          </Typography>
        </Stack>
      </Box>

      <Collapse in={alertOpen} unmountOnExit>
        {alertPaywall ? (
          <Box sx={{ mb: 3 }}>
            <PaywallPanel feature="US-Suchbenachrichtigungen" title="Suchbenachrichtigungen für neue Chancen freischalten" description="Ihre Filter bleiben frei. Mit einem aktiven Tarif erhalten Sie passende US-Aufträge automatisch per E-Mail." />
          </Box>
        ) : (
          <Paper
            component="form"
            variant="outlined"
            onSubmit={(event) => { event.preventDefault(); void subscribeToAlerts(); }}
            sx={{ mb: 3, borderRadius: 2, bgcolor: "background.paper", p: { xs: 2, md: 2.25 } }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} color="text.primary">Benachrichtigung für diese Suche einrichten</Typography>
                <Typography variant="caption" color="text.secondary">Sie erhalten eine E-Mail, sobald passende Aufträge vorliegen. Bitte bestätigen Sie Ihre Anmeldung über den Link in der E-Mail.</Typography>
              </Box>
              <TextField type="email" required size="small" label="E-Mail-Adresse" value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} sx={{ minWidth: { md: 240 } }} />
              <Button type="submit" variant="outlined" size="small" disabled={alertLoading} sx={{ whiteSpace: "nowrap" }}>
                {alertLoading ? "Wird gespeichert..." : "Benachrichtigung einrichten"}
              </Button>
            </Stack>
            {alertMessage && <Typography variant="body2" sx={{ mt: 1.5, color: "primary.dark" }}>{alertMessage}</Typography>}
          </Paper>
        )}
      </Collapse>

      {error ? (
        <Box sx={{ mb: 3 }}>
          <ResourceState
            kind="error"
            title="Ergebnisse konnten nicht aktualisiert werden."
            description={error}
          />
        </Box>
      ) : null}
      {loading && items.length === 0 ? (
        <ResourceState
          kind="loading"
          title="US-Aufträge werden geladen"
          description="Wir aktualisieren die Treffer für Ihre Filter."
        />
      ) : null}
      {loading && items.length > 0 ? <LinearProgress aria-label="US-Aufträge werden aktualisiert" sx={{ mb: 2, borderRadius: 1 }} /> : null}

      {items.length === 0 && !loading && !error ? (
        <ResourceState
          kind="empty"
          title="Keine passenden Aufträge gefunden"
          description="Passen Sie Ihre Suchbegriffe oder Filter an und versuchen Sie es erneut."
        />
      ) : items.length > 0 ? (
        <Stack spacing={2}>
          {items.map((item) => {
            const location = [item.location, item.state]
              .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
              .join(", ");
            const typeChipSx = item.subcontracting
              ? { borderColor: "info.main", color: "info.dark", bgcolor: "info.light" }
              : { borderColor: "primary.main", color: "primary.dark", bgcolor: "primary.light" };

            return (
              <Card
                key={item.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  transition: (theme) => theme.transitions.create("border-color", { duration: theme.transitions.duration.short }),
                  "&:hover": { borderColor: "primary.light" },
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                        <Chip label={item.subcontracting ? "Unterauftrag" : "US-Bundesauftrag"} size="small" variant="outlined" sx={typeChipSx} />
                        {item.category && <Chip label={getUsCategoryLabel(item.category)} size="small" variant="outlined" />}
                        {item.setAside && <Chip lang="en" label={item.setAside} size="small" variant="outlined" />}
                        {item.naicsCodes.slice(0, 2).map((code) => <Chip key={code} label={`NAICS ${code}`} size="small" variant="outlined" />)}
                      </Stack>
                      <Typography variant="subtitle1" component="h2" fontWeight={600} sx={{ color: "text.primary", lineHeight: 1.35, overflowWrap: "anywhere" }}>
                        <span lang="en">{item.title}</span>
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ color: "text.secondary", flexWrap: "wrap", rowGap: 0.75 }}>
                      {item.buyer && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", fontSize: "0.8125rem" }}><Building2 size={15} />{item.buyer}</Typography>}
                      {location && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", fontSize: "0.8125rem" }}><MapPin size={15} />{location}</Typography>}
                      {item.deadline && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", color: "warning.main", fontWeight: 700, fontSize: "0.8125rem" }}><CalendarClock size={15} />Frist: {item.deadline}</Typography>}
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                        Quelle: {item.source}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                        <Button component={Link} href={`/us/tender/${item.id}`} size="small" variant="text" endIcon={<ArrowUpRight size={16} />}>
                          Ausschreibung prüfen
                        </Button>
                        <Button component={Link} href={`/us/tender/${item.id}`} size="small" variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }}>
                          Bearbeitungsplan ansehen
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : null}
    </Box>
  );
}
