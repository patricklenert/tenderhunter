"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Chip, Collapse, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { ArrowUpRight, Building2, CalendarClock, MapPin, Search } from "lucide-react";
import { US_CATEGORIES } from "@/lib/us/categorize";
import { PaywallPanel } from "@/components/billing/PaywallPanel";

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
        if (!response.ok) throw new Error("Opportunity search is temporarily unavailable.");
        const payload = await response.json() as SearchResponse;
        setItems(payload.items);
        setTotal(payload.total);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Opportunity search failed.");
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
      const payload = await response.json() as { status?: string; error?: string };
      if (response.status === 401 || response.status === 402) {
        setAlertPaywall(true);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Unable to create alert subscription.");
      setAlertMessage(payload.status === "already_confirmed" ? "This alert is already active." : "Check your inbox to confirm the alert subscription.");
      if (payload.status !== "already_confirmed") setAlertEmail("");
    } catch (cause) {
      setAlertMessage(cause instanceof Error ? cause.message : "Unable to create alert subscription.");
    } finally {
      setAlertLoading(false);
    }
  };

  return (
    <Box component="section" lang="en" sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-start" }} spacing={2}>
          <Box sx={{ maxWidth: 760 }}>
            <Typography variant="h5" component="h1" fontWeight={600} sx={{ color: "#1e293b", fontSize: { xs: "1.5rem", md: "1.75rem" } }}>
              U.S. Opportunities
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "#475569", fontSize: "0.9375rem", lineHeight: 1.6 }}>
              Public and private procurement opportunities across the United States, including federal and subcontracting work.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button component={Link} href="/us/profile" variant="outlined" size="small" sx={{ whiteSpace: "nowrap" }}>
              Set up U.S. profile
            </Button>
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => setAlertOpen((open) => !open)}
              aria-expanded={alertOpen}
              sx={{ whiteSpace: "nowrap" }}
            >
              {alertOpen ? "Close search alert" : "Set up search alert"}
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keywords, agency, solicitation..."
            slotProps={{ input: { startAdornment: <Search size={22} style={{ marginRight: 10 }} /> } }}
          />
          <TextField select fullWidth label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <MenuItem value="">All categories</MenuItem>
            {US_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="State" value={state} onChange={(event) => setState(event.target.value)}>
            {US_STATES.map((item) => <MenuItem key={item || "all"} value={item}>{item || "All states"}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Opportunity type" value={subcontracting} onChange={(event) => setSubcontracting(event.target.value as "all" | "sub" | "direct")}>
            <MenuItem value="all">All opportunity types</MenuItem>
            <MenuItem value="direct">Federal</MenuItem>
            <MenuItem value="sub">Subcontracting</MenuItem>
          </TextField>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
            {loading ? "Refreshing opportunities" : `${total.toLocaleString("en-US")} active opportunities`}
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748b" }}>
            Federal and subcontracting opportunities
          </Typography>
        </Stack>
      </Box>

      <Collapse in={alertOpen} unmountOnExit>
        {alertPaywall ? (
          <Box sx={{ mb: 3 }}>
            <PaywallPanel feature="U.S. Alerts" title="Such-Alerts für neue Chancen freischalten" description="Deine Filter bleiben frei. Mit einem Billing-Plan erhältst du automatisch neue passende U.S. Opportunities per E-Mail." />
          </Box>
        ) : (
          <Paper
            component="form"
            variant="outlined"
            onSubmit={(event) => { event.preventDefault(); void subscribeToAlerts(); }}
            sx={{ mb: 3, borderRadius: "6px", p: { xs: 2, md: 2.25 } }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: "#1e293b" }}>Get alerts for this search</Typography>
                <Typography variant="caption" color="text.secondary">We&apos;ll email you when new matching opportunities appear. Double opt-in required.</Typography>
              </Box>
              <TextField type="email" required size="small" label="Your email" value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} sx={{ minWidth: { md: 240 } }} />
              <Button type="submit" variant="outlined" size="small" disabled={alertLoading} sx={{ whiteSpace: "nowrap" }}>
                {alertLoading ? "Saving..." : "Subscribe"}
              </Button>
            </Stack>
            {alertMessage && <Typography variant="body2" sx={{ mt: 1.5, color: "primary.dark" }}>{alertMessage}</Typography>}
          </Paper>
        )}
      </Collapse>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="Refreshing opportunities" sx={{ mb: 2, borderRadius: 1 }} />}

      {items.length === 0 && !loading ? (
        <Paper elevation={0} variant="outlined" sx={{ borderRadius: "6px", py: 6, px: 3, textAlign: "center" }}>
          <Typography variant="h6" component="p" fontWeight={600} sx={{ mb: 1, color: "#1e293b" }}>
            No active opportunities match these filters
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Broaden your terms or check again after the next source refresh.
          </Typography>
        </Paper>
      ) : items.length > 0 ? (
        <Stack spacing={2}>
          {items.map((item) => {
            const location = [item.location, item.state]
              .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
              .join(", ");
            const typeChipSx = item.subcontracting
              ? { borderColor: "rgba(25, 118, 210, 0.35)", color: "#1d4f72", bgcolor: "rgba(25, 118, 210, 0.05)" }
              : { borderColor: "rgba(233, 100, 77, 0.4)", color: "primary.dark", bgcolor: "rgba(233, 100, 77, 0.06)" };

            return (
              <Card
                key={item.id}
                variant="outlined"
                sx={{
                  borderRadius: "6px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  "&:hover": { borderColor: "primary.light", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                        <Chip label={item.subcontracting ? "Subcontracting" : "Federal"} size="small" variant="outlined" sx={typeChipSx} />
                        {item.category && <Chip label={item.category} size="small" variant="outlined" />}
                        {item.setAside && <Chip label={item.setAside} size="small" variant="outlined" />}
                        {item.naicsCodes.slice(0, 2).map((code) => <Chip key={code} label={`NAICS ${code}`} size="small" variant="outlined" />)}
                      </Stack>
                      <Typography variant="subtitle1" component="h2" fontWeight={600} sx={{ color: "#1e293b", lineHeight: 1.35, overflowWrap: "anywhere" }}>
                        {item.title}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ color: "#475569", flexWrap: "wrap", rowGap: 0.75 }}>
                      {item.buyer && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", fontSize: "0.8125rem" }}><Building2 size={15} />{item.buyer}</Typography>}
                      {location && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", fontSize: "0.8125rem" }}><MapPin size={15} />{location}</Typography>}
                      {item.deadline && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", color: "#984e16", fontWeight: 700, fontSize: "0.8125rem" }}><CalendarClock size={15} />Due {item.deadline}</Typography>}
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                      <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                        Source: {item.source}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                        <Button component={Link} href={`/us/tender/${item.id}`} size="small" variant="text" endIcon={<ArrowUpRight size={16} />}>
                          Details
                        </Button>
                        <Button component={Link} href={`/us/tender/${item.id}`} size="small" variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }}>
                          Pursuit brief
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
