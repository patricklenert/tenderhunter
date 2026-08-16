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

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: { xs: 2, sm: 0 },
            }}
          >
            {BENEFITS.map(({ icon: Icon, title, desc }, index) => (
              <Stack
                key={title}
                alignItems="center"
                spacing={1.5}
                sx={{
                  textAlign: "center",
                  px: { sm: 3 },
                  py: 2,
                  borderRight: { sm: index < 2 ? "1px solid" : "none" },
                  borderColor: { sm: "divider" },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.5,
                    bgcolor: "primary.light",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 4px 12px rgba(233,100,77,0.15)",
                  }}
                >
                  <Icon size={22} style={{ color: "var(--mui-palette-primary-main)" }} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                    {title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: "block", mt: 0.25 }}>
                    {desc}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>

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

            <Stack spacing={1.25} sx={{ mt: 2.25 }} role="group" aria-label="Tenderhunter Pro Pläne">
              <PlanOption plan="quarterly" recommended onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} />
              <PlanOption plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} />
            </Stack>

            <Stack direction="row" spacing={{ xs: 1.25, sm: 1.75 }} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5, color: "text.secondary", opacity: 0.82 }}>
              {["Jederzeit kündbar", "Sicherer Checkout", "Inkl. MwSt."].map((t) => (
                <Stack key={t} direction="row" spacing={0.45} alignItems="center">
                  <Check size={13} aria-hidden="true" />
                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: "0.68rem" }}>{t}</Typography>
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
  const isQuarterly = plan === "quarterly";
  const features = isQuarterly
    ? ["Alle Pro-Funktionen", "Brief- und Matrix-Export"]
    : ["Alle Pro-Funktionen", "Wöchentlich kündbar"];

  return (
    <Box
      component="article"
      sx={{
        p: { xs: 2, sm: 2.25 },
        border: "1px solid",
        borderColor: recommended ? "rgba(233,100,77,0.34)" : "divider",
        borderRadius: 2.5,
        bgcolor: recommended ? "rgba(233,100,77,0.035)" : "background.paper",
        boxShadow: recommended ? "0 8px 24px rgba(45,53,68,0.05)" : "none",
        textAlign: "left",
        position: "relative",
        transition: "border-color 0.15s, box-shadow 0.15s",
        "&:hover": { borderColor: recommended ? "rgba(233,100,77,0.55)" : "text.secondary" },
      }}
    >
      <Stack spacing={1.15} sx={{ minHeight: { xs: 218, sm: 224 }, justifyContent: "space-between" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing="0.08em" sx={{ fontSize: "0.68rem" }}>
            {details.label}
          </Typography>
          {recommended && (
            <Box sx={{ px: 0.9, py: 0.2, borderRadius: 999, bgcolor: "rgba(233,100,77,0.08)", border: "1px solid rgba(233,100,77,0.2)", color: "primary.dark" }}>
              <Typography component="span" variant="caption" fontWeight={800} sx={{ whiteSpace: "nowrap", fontSize: "0.6rem", letterSpacing: "0.01em" }}>
                Empfohlen
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.05em" sx={{ fontSize: { xs: "1.8rem", sm: "2.05rem" }, lineHeight: 1 }}>
              {details.price} {details.currency}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.55, lineHeight: 1.2 }}>
              {isQuarterly ? "für 3 Monate" : "pro Woche"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35, lineHeight: 1.3 }}>
              {isQuarterly ? "≈ 3,25 € / Woche" : "Maximale Flexibilität"}
            </Typography>
          </Box>
          {isQuarterly && (
            <Box sx={{ px: 1, py: 0.55, borderRadius: 1.5, bgcolor: "rgba(233,100,77,0.1)", color: "primary.dark", flexShrink: 0 }}>
              <Typography variant="caption" fontWeight={800} sx={{ fontSize: "0.65rem", whiteSpace: "nowrap" }}>
                73 % günstiger als der Wochenplan
              </Typography>
            </Box>
          )}
        </Stack>

        <Stack component="ul" spacing={0.65} sx={{ listStyle: "none", p: 0, m: 0 }}>
          {features.map((f) => (
            <Stack key={f} component="li" direction="row" spacing={1} alignItems="center">
              <Check size={13} style={{ flexShrink: 0, color: isQuarterly ? "var(--mui-palette-primary-main)" : "var(--mui-palette-text-secondary)" }} />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, fontSize: "0.7rem" }}>{f}</Typography>
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
          sx={[
            { mt: 0.5, py: 0.9, fontSize: "0.85rem" },
            !recommended && {
              color: "text.secondary",
              borderColor: "divider",
              "&:hover": { borderColor: "text.secondary", bgcolor: "action.hover" },
            },
          ]}
        >
          {loading ? "Wird geöffnet ..." : recommended ? "Jetzt Pro freischalten" : "Flexibel starten"}
        </Button>
      </Stack>
    </Box>
  );
}
