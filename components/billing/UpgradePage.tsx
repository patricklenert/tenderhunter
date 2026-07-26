"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { BILLING_PLANS, parseBillingPlan, type BillingPlan } from "@/lib/billing";
import { useSession } from "@/lib/auth-client";

interface BillingStatusResponse {
  active: boolean;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const BENEFITS = [
  "Dokumente und Vergabeunterlagen teilen",
  "KI-Matching und Unternehmensanalyse",
  "Treffer als CSV oder PDF exportieren",
  "U.S. Pursuit Briefs und Such-Alerts",
];

export function UpgradePage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setStatus(null);
      return;
    }

    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<BillingStatusResponse> : null)
      .then((nextStatus) => setStatus(nextStatus))
      .catch(() => setStatus(null));
  }, [session?.user]);

  useEffect(() => {
    const checkoutState = new URLSearchParams(window.location.search).get("checkout");
    if (checkoutState === "success") {
      setMessage("Zahlung abgeschlossen. Der Zugang wird nach der Stripe-Bestätigung aktiviert.");
    }
    if (checkoutState === "cancelled") {
      setMessage("Checkout abgebrochen. Dein Zugang bleibt unverändert.");
    }
  }, []);

  const startCheckout = async (plan: BillingPlan) => {
    if (!session?.user) {
      window.sessionStorage.setItem("tenderhunter:pending-billing-plan", plan);
      setAuthOpen(true);
      return;
    }

    setLoadingPlan(plan);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Checkout konnte nicht gestartet werden.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout konnte nicht gestartet werden.");
      setLoadingPlan(null);
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    const pendingPlan = parseBillingPlan(window.sessionStorage.getItem("tenderhunter:pending-billing-plan"));
    if (!pendingPlan) return;
    window.sessionStorage.removeItem("tenderhunter:pending-billing-plan");
    void startCheckout(pendingPlan);
  }, [session?.user, startCheckout]);

  const openPortal = async () => {
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Billing-Verwaltung konnte nicht geöffnet werden.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing-Verwaltung konnte nicht geöffnet werden.");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 7 } }}>
      <Container maxWidth="md">
        <Stack spacing={{ xs: 3, md: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button component={Link} href="/" startIcon={<ArrowLeft size={17} />} sx={{ color: "text.secondary" }}>
              Zurück zu Tenderhunter
            </Button>
            <Typography variant="subtitle1" fontWeight={800} color="text.primary">
              Tenderhunter
            </Typography>
          </Stack>

          <Box sx={{ maxWidth: 650 }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.12em" }}>
              Mehr Handlungsspielraum
            </Typography>
            <Typography component="h1" variant="h1" sx={{ mt: 1, letterSpacing: "-0.035em", maxWidth: 620 }}>
              Von einem passenden Treffer zur nächsten Entscheidung.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 620, lineHeight: 1.7 }}>
              Die Recherche bleibt offen. Der Billing-Plan schaltet die Aktionen frei, die aus einem Treffer einen belastbaren nächsten Schritt machen.
            </Typography>
          </Box>

          {message && <Alert severity="info" onClose={() => setMessage(null)}>{message}</Alert>}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {status?.active && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "success.light" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <ShieldCheck size={21} color="currentColor" />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>Dein Billing-Plan ist aktiv.</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {status.cancelAtPeriodEnd ? "Der Zugang endet am Ende der aktuellen Laufzeit." : "Alle Premium-Aktionen sind freigeschaltet."}
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => void openPortal()} startIcon={<CreditCard size={16} />}>
                  Billing verwalten
                </Button>
              </Stack>
            </Paper>
          )}

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
            <PlanOption plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={sessionPending || Boolean(status?.active)} />
            <PlanOption plan="yearly" recommended onSelect={startCheckout} loading={loadingPlan === "yearly"} disabled={sessionPending || Boolean(status?.active)} />
          </Stack>

          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Enthalten in beiden Plänen</Typography>
            <Stack spacing={1.25} sx={{ mt: 2 }}>
              {BENEFITS.map((benefit) => (
                <Stack key={benefit} direction="row" spacing={1.25} alignItems="flex-start">
                  <Check size={18} color="currentColor" aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary">{benefit}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <ShieldCheck size={15} /> Sicherer Checkout über Stripe
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
            <Typography variant="caption" color="text.secondary">Kündigung und Rechnungen im Stripe-Kundenportal</Typography>
          </Stack>
        </Stack>
      </Container>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab="login" />
    </Box>
  );
}

function PlanOption({
  plan,
  recommended = false,
  onSelect,
  loading,
  disabled,
}: {
  plan: BillingPlan;
  recommended?: boolean;
  onSelect: (plan: BillingPlan) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const details = BILLING_PLANS[plan];
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        p: { xs: 2.5, md: 3 },
        borderRadius: 2,
        borderColor: recommended ? "primary.main" : "divider",
        boxShadow: recommended ? "0 10px 30px rgba(233, 100, 77, 0.12)" : "none",
        position: "relative",
      }}
    >
      {recommended && <Chip label="Empfohlen" color="primary" size="small" sx={{ position: "absolute", top: 16, right: 16, fontWeight: 700 }} />}
      <Typography variant="overline" color="text.secondary" fontWeight={700}>{details.label}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ mt: 1 }}>
        <Typography variant="h2" fontWeight={800} letterSpacing="-0.04em">{details.price}</Typography>
        <Typography variant="body2" color="text.secondary">{details.cadence}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44, mt: 1.25, lineHeight: 1.55 }}>
        {details.description}
      </Typography>
      {plan === "yearly" && <Typography variant="caption" color="primary.dark" fontWeight={700} sx={{ display: "block", mt: 1 }}>87% günstiger als wöchentliche Zahlung</Typography>}
      <Button
        fullWidth
        variant={recommended ? "contained" : "outlined"}
        size="large"
        endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={17} />}
        onClick={() => onSelect(plan)}
        disabled={disabled || loading}
        sx={{ mt: 3 }}
      >
        {loading ? "Weiterleitung..." : "Plan auswählen"}
      </Button>
    </Paper>
  );
}
