"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  ListChecks,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { UpgradeProductPreview } from "@/components/billing/UpgradeProductPreview";
import { BILLING_PLANS, parseBillingPlan, type CheckoutBillingPlan } from "@/lib/billing";
import { useSession } from "@/lib/auth-client";

interface BillingStatusResponse {
  active: boolean;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface CheckoutResponse {
  url?: string;
  error?: string;
  code?: string;
}

const BENEFITS = [
  { icon: ShieldAlert, title: "Risiken sofort sichtbar", desc: "Ausschlussgründe und Haftungsfallen bevor Angebotsstunden fließen." },
  { icon: ClipboardCheck, title: "Muss-Kriterien geprüft", desc: "Fehlende Nachweise und Zertifikate innerhalb von Minuten erkannt." },
  { icon: ListChecks, title: "Klare nächste Schritte", desc: "Priorisierte Aufgaben für Ihr Team – kein Rätselraten nach der Prüfung." },
] as const;

const FAQS = [
  {
    q: "Was ist in Pro enthalten?",
    a: "Pro schaltet die Arbeitsansicht frei: Fit-Score, Muss-Kriterien, Risiken, nächste Schritte und Exporte für jedes Vergabeverfahren.",
  },
  {
    q: "Kann ich jederzeit kündigen?",
    a: "Ja. Die Kündigung erfolgt über das Stripe-Kundenportal – ohne Wartezeit oder Kündigungsfrist beim Wochenplan.",
  },
  {
    q: "Wie funktioniert die Zahlung?",
    a: "Nach der Anmeldung werden Sie zum sicheren Stripe Checkout weitergeleitet. Sie wählen die Zahlungsart und schließen das Abonnement ab.",
  },
  {
    q: "Gibt es Rechnungen?",
    a: "Ja. Rechnungen und Billing-Unterlagen stehen jederzeit im Stripe-Kundenportal bereit.",
  },
] as const;

export function UpgradePage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<CheckoutBillingPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [retryPlan, setRetryPlan] = useState<CheckoutBillingPlan | null>(null);
  const [showPortalAction, setShowPortalAction] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) { setStatus(null); return; }
    let cancelled = false;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (r) => r.ok ? r.json() as Promise<BillingStatusResponse> : null)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    const cs = new URLSearchParams(window.location.search).get("checkout");
    if (cs === "success") { setMessage("Checkout abgeschlossen. Der Zugang wird nach der Stripe-Bestätigung geprüft."); setCheckoutPending(true); }
    if (cs === "cancelled") { setMessage("Checkout abgebrochen. Ihr Zugang bleibt unverändert."); }
  }, []);

  const startCheckout = useCallback(async (plan: CheckoutBillingPlan) => {
    if (!session?.user) {
      window.sessionStorage.setItem("tenderhunter:pending-billing-plan", plan);
      setAuthOpen(true);
      return;
    }
    setLoadingPlan(plan);
    setRetryPlan(null);
    setShowPortalAction(false);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const payload = await res.json() as CheckoutResponse;
      if (res.status === 409 && payload.code === "ALREADY_SUBSCRIBED") {
        setError("Für dieses Konto besteht bereits ein aktiver Pro-Zugang. Öffnen Sie die Billing-Verwaltung.");
        setShowPortalAction(true);
        setLoadingPlan(null);
        return;
      }
      if (!res.ok || !payload.url) throw new Error(payload.error ?? "Checkout konnte nicht gestartet werden.");
      window.location.assign(payload.url);
    } catch (c) {
      setError(c instanceof Error ? c.message : "Checkout konnte nicht gestartet werden.");
      setRetryPlan(plan);
      setLoadingPlan(null);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!checkoutPending || !session?.user?.id) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        if (r.ok) {
          const s = await r.json() as BillingStatusResponse;
          if (!cancelled) setStatus(s);
          if (s.active) { if (!cancelled) { setCheckoutPending(false); setMessage("Ihr Pro-Zugang ist aktiv."); } return; }
        }
      } catch {}
      attempts += 1;
      if (!cancelled && attempts < 8) timer = setTimeout(() => void poll(), 1500);
      else if (!cancelled) setCheckoutPending(false);
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [checkoutPending, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const p = parseBillingPlan(window.sessionStorage.getItem("tenderhunter:pending-billing-plan"));
    if (!p) return;
    window.sessionStorage.removeItem("tenderhunter:pending-billing-plan");
    void startCheckout(p);
  }, [session?.user?.id, startCheckout]);

  const openPortal = async () => {
    setError(null); setRetryPlan(null); setShowPortalAction(false); setPortalLoading(true);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const p = await r.json() as CheckoutResponse;
      if (!r.ok || !p.url) throw new Error(p.error ?? "Billing-Verwaltung konnte nicht geöffnet werden.");
      window.location.assign(p.url);
    } catch (c) {
      setError(c instanceof Error ? c.message : "Billing-Verwaltung konnte nicht geöffnet werden.");
    } finally { setPortalLoading(false); }
  };

  const plansDisabled = sessionPending || Boolean(status?.active) || loadingPlan !== null || checkoutPending;

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, md: 3 } }}>
        <Box component="header" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 36, mb: { xs: 3, md: 4 } }}>
          <Link href="/" aria-label="Tenderhunter Startseite" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            <Image src="/logo.webp" alt="Tenderhunter" width={112} height={35} priority />
          </Link>
          <Button component={Link} href="/" variant="text" color="inherit" startIcon={<ArrowLeft size={16} />} sx={{ color: "#9ca3af", fontSize: "0.8125rem", px: 1, minHeight: 36 }}>
            Zur App
          </Button>
        </Box>

        <Stack spacing={{ xs: 5, md: 6 }}>
          <Box component="section" aria-labelledby="hero-title" sx={{ textAlign: "center" }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.12em", fontSize: "0.7rem" }}>
              Tenderhunter Pro
            </Typography>
            <Typography id="hero-title" component="h1" sx={{ mt: 1, fontSize: { xs: "2rem", sm: "2.5rem" }, lineHeight: 1.1, letterSpacing: "-0.04em", fontWeight: 700 }}>
              Ausschreibungen prüfen.
              <br />
              Entscheidungen in Minuten treffen.
            </Typography>
            <Typography component="p" sx={{ mt: 1.5, mx: "auto", maxWidth: 480, color: "text.secondary", fontSize: "0.95rem", lineHeight: 1.6 }}>
              Fehlende Muss-Kriterien, Risiken und nächste Aufgaben – erkannt in Minuten, nicht Stunden.
            </Typography>
          </Box>

          <Stack spacing={1.5}>
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <Stack key={title} direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "primary.light", color: "primary.dark", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={18} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{desc}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>

          <UpgradeProductPreview />

          <Box component="section" aria-labelledby="pricing-title" sx={{ textAlign: "center" }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.1em", fontSize: "0.7rem" }}>
              Pro-Zugang
            </Typography>
            <Typography id="pricing-title" component="h2" sx={{ mt: 0.5, fontSize: { xs: "1.5rem", sm: "1.75rem" }, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Wählen Sie Ihren Plan.
            </Typography>

            {message && <Alert severity="info" role="status" onClose={() => setMessage(null)} sx={{ mt: 2, textAlign: "left" }}>{message}</Alert>}
            {error && (
              <Alert severity="error" role="alert" onClose={() => { setError(null); setRetryPlan(null); setShowPortalAction(false); }} sx={{ mt: 2, textAlign: "left" }}
                action={retryPlan ? <Button color="inherit" size="small" onClick={() => void startCheckout(retryPlan)} startIcon={<ArrowRight size={14} />}>Erneut versuchen</Button> : showPortalAction ? <Button color="inherit" size="small" onClick={() => void openPortal()} disabled={portalLoading} startIcon={portalLoading ? <CircularProgress size={14} color="inherit" /> : <CreditCard size={14} />}>Billing verwalten</Button> : undefined}
              >{error}</Alert>
            )}
            {status?.active && (
              <Alert severity="success" icon={<ShieldCheck size={20} />} sx={{ mt: 2, textAlign: "left" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={700}>Ihr Pro-Zugang ist aktiv.</Typography>
                    <Typography variant="body2" color="text.secondary">{status.cancelAtPeriodEnd ? "Ihr Zugang bleibt bis zum Ende der aktuellen Laufzeit aktiv." : "Ihre Premium-Aktionen sind freigeschaltet."}</Typography>
                  </Box>
                  <Button variant="outlined" onClick={() => void openPortal()} disabled={portalLoading} startIcon={portalLoading ? <CircularProgress size={15} color="inherit" /> : <CreditCard size={16} />} sx={{ flexShrink: 0 }}>{portalLoading ? "Wird geöffnet ..." : "Billing verwalten"}</Button>
                </Stack>
              </Alert>
            )}

            <Stack spacing={1.5} sx={{ mt: 2.5 }} role="group" aria-label="Tenderhunter Pro Pläne">
              <PlanOption plan="quarterly" recommended onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} />
              <PlanOption plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} />
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {["Jederzeit kündbar", "Sicherer Checkout", "Inkl. MwSt."].map((t) => (
                <Stack key={t} direction="row" spacing={0.5} alignItems="center" sx={{ color: "text.secondary" }}>
                  <Check size={14} aria-hidden="true" />
                  <Typography variant="caption" fontWeight={600}>{t}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="faq-title">
            <Typography id="faq-title" component="h2" sx={{ fontSize: "1.25rem", fontWeight: 700, mb: 1.5 }}>
              Häufige Fragen
            </Typography>
            <Box sx={{ borderTop: 1, borderColor: "divider", overflow: "hidden" }}>
              {FAQS.map(({ q, a }) => (
                <Accordion key={q} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderBottom: 1, borderColor: "divider", "&::before": { display: "none" }, overflow: "hidden" }}>
                  <AccordionSummary expandIcon={<ChevronDown size={18} />} sx={{ px: 0, minHeight: 52, "& .MuiAccordionSummary-content": { my: 1.25, minWidth: 0, overflow: "hidden" } }}>
                    <Typography component="h3" fontWeight={700} variant="body2" sx={{ pr: 1, overflowWrap: "anywhere" }}>{q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0, pb: 2, maxWidth: 560, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, overflowWrap: "anywhere" }}>{a}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", pb: 3 }}>
            Billing und Rechnungen werden über das Stripe-Kundenportal verwaltet.
          </Typography>
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
  plan: CheckoutBillingPlan;
  recommended?: boolean;
  onSelect: (plan: CheckoutBillingPlan) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const details = BILLING_PLANS[plan];

  return (
    <Box
      component="article"
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: recommended ? 2 : 1,
        borderColor: recommended ? "primary.main" : "divider",
        borderRadius: 2.5,
        bgcolor: recommended ? "primary.light" : "background.paper",
        textAlign: "left",
        position: "relative",
        transition: "border-color 0.15s, box-shadow 0.15s",
        "&:hover": { borderColor: recommended ? "primary.dark" : "text.secondary" },
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing="0.08em" sx={{ fontSize: "0.7rem" }}>
            {details.label}
          </Typography>
          {recommended && (
            <Box sx={{ px: 1, py: 0.2, borderRadius: 999, bgcolor: "primary.main", color: "primary.contrastText" }}>
              <Typography component="span" variant="caption" fontWeight={800} sx={{ whiteSpace: "nowrap", fontSize: "0.65rem" }}>
                Empfohlen
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={0.5}>
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.04em" sx={{ fontSize: { xs: "1.75rem", sm: "2rem" } }}>
            {details.price} {details.currency}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {details.cadence}
          </Typography>
        </Stack>

        <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0 }}>
          {details.features.map((f) => (
            <Stack key={f} component="li" direction="row" spacing={1} alignItems="center">
              <Check size={14} style={{ flexShrink: 0, color: "var(--mui-palette-primary-main)" }} />
              <Typography variant="caption" sx={{ lineHeight: 1.4 }}>{f}</Typography>
            </Stack>
          ))}
        </Stack>

        <Button
          fullWidth
          variant={recommended ? "contained" : "outlined"}
          onClick={() => onSelect(plan)}
          disabled={disabled || loading}
          aria-busy={loading}
          endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={16} />}
          sx={{ mt: 0.5, py: 1, fontSize: "0.875rem" }}
        >
          {loading ? "Wird geöffnet ..." : recommended ? "Jetzt Pro freischalten" : "Flexibel starten"}
        </Button>
      </Stack>
    </Box>
  );
}
