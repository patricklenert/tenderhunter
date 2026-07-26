"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Chip, Container, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { ArrowUpRight, Building2, CalendarClock, Landmark, Search, ShieldCheck } from "lucide-react";
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
    <Box sx={{ background: "linear-gradient(180deg, #eff5fb 0, #fff 42rem)", minHeight: "100vh", py: { xs: 4, md: 7 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3.5}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-start" }} spacing={2}>
            <Box sx={{ maxWidth: 760 }}>
              <Typography variant="overline" sx={{ color: "#0d5c80", fontWeight: 800, letterSpacing: "0.12em" }}>
                U.S. Procurement Opportunity Desk
              </Typography>
              <Typography component="h1" sx={{ color: "#102a43", fontSize: { xs: "2.35rem", md: "4rem" }, fontWeight: 850, lineHeight: 0.98, letterSpacing: "-0.055em", mt: 1 }}>
                Find the contract. Build the team. Make the move.
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: { xs: "1rem", md: "1.15rem" }, lineHeight: 1.7, mt: 2, maxWidth: 670 }}>
                Active U.S. federal, state, and subcontracting opportunities from SAM.gov, Texas ESBD, and SBA. Open any opportunity for a direct-bid readiness check, a registration roadmap, and comparable prime contractors.
              </Typography>
            </Box>
            <Button component={Link} href="/us/profile" variant="outlined" sx={{ borderColor: "#0d5c80", color: "#0d5c80", whiteSpace: "nowrap" }}>Set up U.S. profile</Button>
          </Stack>

          <Card elevation={0} sx={{ border: "1px solid #cddce8", borderRadius: 3, bgcolor: "rgba(255,255,255,.92)" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
                <TextField
                  fullWidth
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search keywords, agency, solicitation..."
                  slotProps={{ input: { startAdornment: <Search size={19} style={{ marginRight: 10, color: "#50758a" }} /> } }}
                />
                <TextField select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} sx={{ minWidth: { md: 180 } }}>
                  <MenuItem value="">All categories</MenuItem>
                  {US_CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </TextField>
                <TextField select label="State" value={state} onChange={(event) => setState(event.target.value)} sx={{ minWidth: { md: 138 } }}>
                  {US_STATES.map((item) => <MenuItem key={item || "all"} value={item}>{item || "All states"}</MenuItem>)}
                </TextField>
                <TextField select label="Type" value={subcontracting} onChange={(event) => setSubcontracting(event.target.value as "all" | "sub" | "direct")} sx={{ minWidth: { md: 138 } }}>
                  <MenuItem value="all">All types</MenuItem>
                  <MenuItem value="sub">Subcontracting</MenuItem>
                  <MenuItem value="direct">Direct bid</MenuItem>
                </TextField>
              </Stack>
            </CardContent>
          </Card>

          {alertPaywall ? (
            <PaywallPanel feature="U.S. Alerts" title="Such-Alerts für neue Chancen freischalten" description="Deine Filter bleiben frei. Mit einem Billing-Plan erhältst du automatisch neue passende U.S. Opportunities per E-Mail." />
          ) : (
            <Card elevation={0} sx={{ border: "1px solid #cddce8", borderRadius: 3, bgcolor: "#f5fbfe" }}>
              <CardContent component="form" onSubmit={(event) => { event.preventDefault(); void subscribeToAlerts(); }} sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={800} sx={{ color: "#102a43" }}>Get alerts for this search</Typography>
                    <Typography variant="body2" color="text.secondary">We&apos;ll email you when new matching opportunities appear. Double opt-in required.</Typography>
                  </Box>
                  <TextField type="email" required size="small" label="Your email" value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} sx={{ minWidth: { md: 240 } }} />
                  <Button type="submit" variant="contained" disabled={alertLoading} sx={{ bgcolor: "#0d5c80", whiteSpace: "nowrap" }}>{alertLoading ? "Saving..." : "Subscribe"}</Button>
                </Stack>
                {alertMessage && <Typography variant="body2" sx={{ mt: 1.5, color: "#0d5c80" }}>{alertMessage}</Typography>}
              </CardContent>
            </Card>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="subtitle2" color="text.secondary">{loading ? "Refreshing opportunities" : `${total.toLocaleString("en-US")} active opportunities`}</Typography>
            <Chip icon={<ShieldCheck size={15} />} label="Subcontractor-ready research" size="small" sx={{ bgcolor: "#e2f0ec", color: "#135f4d" }} />
          </Stack>
          {loading && <LinearProgress aria-label="Refreshing opportunities" sx={{ borderRadius: 1 }} />}

          {items.length === 0 && !loading ? (
            <Alert severity="info">No active opportunities match these filters. Broaden your terms or check again after the next source refresh.</Alert>
          ) : items.length > 0 ? (
            <Stack spacing={1.25}>
              {items.map((item) => (
                <Card key={item.id} elevation={0} sx={{ border: "1px solid #d6e0e9", borderRadius: 2.5, transition: "transform .16s ease, box-shadow .16s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 12px 28px rgba(25, 66, 95, .11)" } }}>
                  <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                          <Chip label={item.subcontracting ? "Subcontracting" : "Federal opportunity"} size="small" color={item.subcontracting ? "secondary" : "primary"} />
                          {item.setAside && <Chip label={item.setAside} size="small" variant="outlined" />}
                          {item.category && <Chip label={item.category} size="small" variant="outlined" sx={{ borderColor: "#b9d2e3", color: "#36607a" }} />}
                          {item.naicsCodes.slice(0, 2).map((code) => <Chip key={code} label={`NAICS ${code}`} size="small" variant="outlined" />)}
                        </Stack>
                        <Typography variant="h6" component="h2" sx={{ color: "#102a43", fontWeight: 760, lineHeight: 1.25 }}>{item.title}</Typography>
                        <Stack direction="row" spacing={1.7} sx={{ mt: 1.25, color: "text.secondary", flexWrap: "wrap", rowGap: 0.7 }}>
                          {item.buyer && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center" }}><Building2 size={15} />{item.buyer}</Typography>}
                          {item.location && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center" }}><Landmark size={15} />{item.location}</Typography>}
                          {item.deadline && <Typography variant="body2" sx={{ display: "flex", gap: 0.55, alignItems: "center", color: "#984e16", fontWeight: 700 }}><CalendarClock size={15} />Due {item.deadline}</Typography>}
                        </Stack>
                      </Box>
                      <Button component={Link} href={`/us/tender/${item.id}`} endIcon={<ArrowUpRight size={17} />} variant="contained" sx={{ alignSelf: { md: "center" }, whiteSpace: "nowrap", bgcolor: "#0d5c80", "&:hover": { bgcolor: "#074664" } }}>
                        Pursuit brief
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
