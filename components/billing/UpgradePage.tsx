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
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ShieldCheck,
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

const PLAN_COPY: Record<CheckoutBillingPlan, {
  label: string;
  cadence: string;
  billing: string;
  benefit: string;
  savings: string | null;
  action: string;
}> = {
  weekly: {
    label: "Wochenplan",
    cadence: "pro Woche",
    billing: "Wöchentliche Abrechnung.",
    benefit: "Flexibel prüfen und die Laufzeit bequem verwalten.",
    savings: null,
    action: "Flexibel starten",
  },
  quarterly: {
    label: "3-Monats-Plan",
    cadence: "für 3 Monate",
    billing: "Einmalige Abrechnung für drei Monate.",
    benefit: "Mehr Zeit für Recherche, Bewertung und die nächsten Schritte.",
    savings: "Entspricht 3,25 US-Dollar pro Woche · Sie sparen 73 % gegenüber dem Wochenplan.",
    action: "Jetzt Pro freischalten",
  },
};

const HERO_OUTCOMES = [
  "Unpassende Ausschreibungen früh aussortieren",
  "Fehlende Nachweise und Risiken sofort erkennen",
  "Mit einem klaren Angebotsplan starten",
] as const;

const INCLUDED_FEATURES = [
  "Einschätzung der Passung zum Unternehmensprofil",
  "Kritische Muss-Kriterien und fehlende Nachweise",
  "Risiken, Ausschlüsse und offene Punkte",
  "Anforderungsmatrix für die vollständige Prüfung",
  "Priorisierte nächste Aufgaben für Ihr Team",
  "Brief- und Matrix-Exporte für die Übergabe",
];

const TRUST_POINTS = [
  "Jederzeit kündbar",
  "Keine automatische Verlängerung beim Wochenplan",
  "Sicherer Checkout über Stripe",
] as const;

const FAQS = [
  {
    question: "Was ist in Tenderhunter Pro enthalten?",
    answer: "Pro schaltet die Arbeitsansicht frei, die eine Ausschreibung gegen Ihr Unternehmen prüft und daraus eine Fit-Bewertung, kritische Muss-Kriterien, fehlende Nachweise, Risiken und nächste Aufgaben ableitet. Brief- und Matrix-Exporte unterstützen die Übergabe im Team.",
  },
  {
    question: "Unterscheiden sich die Funktionen zwischen beiden Plänen?",
    answer: "Nein. Beide Pläne enthalten dieselben Pro-Funktionen. Der Unterschied liegt ausschließlich in Laufzeit, Abrechnungsrhythmus und Preisvorteil.",
  },
  {
    question: "Kann ich den Wochenplan kündigen?",
    answer: "Die Billing-Verwaltung einschließlich Kündigung erfolgt über das Stripe-Kundenportal. Tenderhunter führt dafür keinen eigenen Kündigungsdialog innerhalb der App.",
  },
  {
    question: "Wie funktioniert die Zahlung?",
    answer: "Nach der Anmeldung werden Sie zum sicheren Stripe Checkout weitergeleitet. Sie wählen dort die Zahlungsart und schließen die Subscription für den gewählten Wochen- oder Drei-Monats-Plan ab.",
  },
  {
    question: "Was passiert nach dem Kauf?",
    answer: "Stripe leitet Sie zurück zu dieser Seite. Sobald Tenderhunter die Stripe-Bestätigung verarbeitet hat, stehen die Pro-Arbeitsansichten für Ihre Ausschreibungen bereit.",
  },
  {
    question: "Kann ich Rechnungen herunterladen?",
    answer: "Tenderhunter bietet keine eigene Rechnungshistorie an. Das Stripe-Kundenportal ist der vorgesehene Ort für Billing-Verwaltung und die dort verfügbaren Rechnungsunterlagen.",
  },
  {
    question: "Welche Funktionen stehen für U.S. Opportunities zur Verfügung?",
    answer: "Die U.S.-Suche und die Opportunity-Grunddaten bleiben zugänglich. Pro ergänzt Pursuit Briefs mit Fit- und Readiness-Prüfung, Checkliste, Teaming-Ressourcen und Such-Alerts für neue passende Opportunities, einschließlich Subcontracting-Möglichkeiten.",
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
    if (!session?.user?.id) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<BillingStatusResponse> : null)
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const checkoutState = new URLSearchParams(window.location.search).get("checkout");
    if (checkoutState === "success") {
      setMessage("Checkout abgeschlossen. Der Zugang wird nach der Stripe-Bestätigung geprüft.");
      setCheckoutPending(true);
    }
    if (checkoutState === "cancelled") {
      setMessage("Checkout abgebrochen. Ihr Zugang bleibt unverändert.");
    }
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
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json() as CheckoutResponse;
      if (response.status === 409 && payload.code === "ALREADY_SUBSCRIBED") {
        setError("Für dieses Konto besteht bereits ein aktiver Pro-Zugang. Öffnen Sie die Billing-Verwaltung.");
        setShowPortalAction(true);
        setLoadingPlan(null);
        return;
      }
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Checkout konnte nicht gestartet werden.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout konnte nicht gestartet werden.");
      setRetryPlan(plan);
      setLoadingPlan(null);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!checkoutPending || !session?.user?.id) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pollStatus = async () => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        if (response.ok) {
          const nextStatus = await response.json() as BillingStatusResponse;
          if (!cancelled) setStatus(nextStatus);
          if (nextStatus.active) {
            if (!cancelled) {
              setCheckoutPending(false);
              setMessage("Ihr Pro-Zugang ist aktiv. Die Premium-Aktionen sind freigeschaltet.");
            }
            return;
          }
        }
      } catch {
        // The existing checkout message remains visible while Stripe confirms the subscription.
      }

      attempts += 1;
      if (!cancelled && attempts < 8) {
        timer = setTimeout(() => void pollStatus(), 1500);
      } else if (!cancelled) {
        setCheckoutPending(false);
      }
    };

    void pollStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkoutPending, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const pendingPlan = parseBillingPlan(window.sessionStorage.getItem("tenderhunter:pending-billing-plan"));
    if (!pendingPlan) return;
    window.sessionStorage.removeItem("tenderhunter:pending-billing-plan");
    void startCheckout(pendingPlan);
  }, [session?.user?.id, startCheckout]);

  const openPortal = async () => {
    setError(null);
    setRetryPlan(null);
    setShowPortalAction(false);
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json() as CheckoutResponse;
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Billing-Verwaltung konnte nicht geöffnet werden.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing-Verwaltung konnte nicht geöffnet werden.");
    } finally {
      setPortalLoading(false);
    }
  };

  const plansDisabled = sessionPending || Boolean(status?.active) || loadingPlan !== null || checkoutPending;

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", py: { xs: 1.5, sm: 2, md: 2.5 } }}>
      <Container maxWidth={false} sx={{ width: "100%", boxSizing: "border-box", maxWidth: 1180, px: { xs: 2, sm: 3 } }}>
        <Box component="header" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 36, mb: { xs: 2, md: 2.5 } }}>
          <Link href="/" aria-label="Tenderhunter Startseite" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            <Image src="/logo.webp" alt="Tenderhunter" width={112} height={35} priority />
          </Link>
          <Button component={Link} href="/" variant="text" color="inherit" startIcon={<ArrowLeft size={16} />} sx={{ color: "#9ca3af", fontSize: "0.8125rem", px: 1, minHeight: 36 }}>
            Zur App
          </Button>
        </Box>

        <Stack spacing={{ xs: 4, md: 5 }}>
          <Box component="section" aria-labelledby="upgrade-title" sx={{ width: "100%", maxWidth: 1040, mx: "auto", textAlign: "center" }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.12em" }}>
              Tenderhunter Pro
            </Typography>
            <Typography id="upgrade-title" component="h1" sx={{ mt: 0.75, mx: "auto", maxWidth: 980, overflowWrap: "normal", hyphens: "none", fontSize: { xs: "2.25rem", sm: "2.75rem", md: "3.25rem" }, lineHeight: 1.05, letterSpacing: "-0.045em", fontWeight: 700 }}>
              Prüfen Sie in wenigen Minuten, ob sich eine Ausschreibung für Ihr Unternehmen lohnt.
            </Typography>
            <Typography component="p" sx={{ mt: 1.75, mx: "auto", maxWidth: 760, color: "text.secondary", fontSize: { xs: "1rem", md: "1.06rem" }, lineHeight: 1.6 }}>
              Tenderhunter erkennt fehlende Muss-Kriterien, zentrale Risiken und die nächsten Aufgaben in Minuten – und spart Ihrem Team spürbar Recherchezeit bei der manuellen Prüfung jeder Ausschreibung.
            </Typography>
            <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: { xs: 2.5, md: 3 }, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 1.25, sm: 2.5 }, textAlign: "left" }}>
              {HERO_OUTCOMES.map((title) => (
                <HeroOutcome key={title} title={title} />
              ))}
            </Box>
          </Box>

          <UpgradeProductPreview />

          <Box component="section" aria-labelledby="features-title" sx={{ borderTop: 1, borderColor: "divider", pt: { xs: 3, md: 4 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 0.7fr) minmax(0, 1.3fr)" }, gap: { xs: 3, md: 7 }, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Konkrete Arbeitsergebnisse
              </Typography>
              <Typography id="features-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Was Ihr Team nach der Prüfung in der Hand hat.
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 4, rowGap: 1.5 }}>
                {INCLUDED_FEATURES.map((feature) => (
                  <Stack component="li" key={feature} direction="row" spacing={1.25} alignItems="flex-start">
                    <Check size={18} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ lineHeight: 1.55 }}>{feature}</Typography>
                  </Stack>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, lineHeight: 1.5 }}>
                Separat für U.S. Opportunities: Pursuit Briefs und Such-Alerts für neue passende Opportunities.
              </Typography>
            </Box>
          </Box>

          <Box component="section" aria-label="Zielgruppe" sx={{ width: "100%", minWidth: 0 }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ color: "text.secondary", width: "100%" }}>
              <Box sx={{ height: 1, flex: 1, bgcolor: "divider", maxWidth: 120, minWidth: 0 }} />
              <Typography component="p" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8125rem", fontWeight: 600, textAlign: "center", whiteSpace: { sm: "nowrap" }, m: 0 }}>
                Entwickelt für Bid- und Business-Development-Teams im deutschen Mittelstand
              </Typography>
              <Box sx={{ height: 1, flex: 1, bgcolor: "divider", maxWidth: 120, minWidth: 0 }} />
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="plans-title" sx={{ width: "100%", minWidth: 0 }}>
            <Stack spacing={{ xs: 2, sm: 2.5 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                  Pro-Zugang
                </Typography>
                <Typography id="plans-title" component="h2" variant="h5" fontWeight={700} sx={{ mt: 0.35 }}>
                  Direkt mit der nächsten Prüfung starten.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5 }}>
                  Wählen Sie die Abrechnung, die zu Ihrem Team passt.
                </Typography>
              </Box>

              {message && <Alert severity="info" role="status" onClose={() => setMessage(null)}>{message}</Alert>}
              {error && (
                <Alert
                  severity="error"
                  role="alert"
                  onClose={() => { setError(null); setRetryPlan(null); setShowPortalAction(false); }}
                  action={retryPlan ? (
                    <Button color="inherit" size="small" onClick={() => void startCheckout(retryPlan)} startIcon={<ArrowRight size={14} />}>
                      Erneut versuchen
                    </Button>
                  ) : showPortalAction ? (
                    <Button color="inherit" size="small" onClick={() => void openPortal()} disabled={portalLoading} startIcon={portalLoading ? <CircularProgress size={14} color="inherit" /> : <CreditCard size={14} />}>
                      Billing verwalten
                    </Button>
                  ) : undefined}
                >
                  {error}
                </Alert>
              )}

              {status?.active && (
                <Alert severity="success" icon={<ShieldCheck size={20} />}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={700}>Ihr Pro-Zugang ist aktiv.</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {status.cancelAtPeriodEnd ? "Ihr Zugang bleibt bis zum Ende der aktuellen Laufzeit aktiv." : "Ihre Premium-Aktionen sind freigeschaltet."}
                      </Typography>
                    </Box>
                    <Button variant="outlined" onClick={() => void openPortal()} disabled={portalLoading} startIcon={portalLoading ? <CircularProgress size={15} color="inherit" /> : <CreditCard size={16} />} sx={{ flexShrink: 0 }}>
                      {portalLoading ? "Wird geöffnet ..." : "Billing verwalten"}
                    </Button>
                  </Stack>
                </Alert>
              )}

              <Box role="group" aria-label="Tenderhunter Pro Pläne" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2 } }}>
                <PlanOption plan="quarterly" recommended onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} />
                <PlanOption plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} />
              </Box>

              <Stack role="list" direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 2.5 }} justifyContent="center" alignItems="center" sx={{ mt: 0.5, textAlign: "center" }}>
                {TRUST_POINTS.map((label) => (
                  <Stack key={label} role="listitem" direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary" }}>
                    <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.4 }}>{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="audience-title" sx={{ p: { xs: 2.5, md: 4 }, border: 1, borderColor: "divider", borderRadius: 2.5, bgcolor: "rgba(232,239,245,0.48)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.8fr) minmax(0, 1.2fr)" }, gap: { xs: 3, md: 7 }, alignItems: "start", minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Für wen Pro gedacht ist
              </Typography>
              <Typography id="audience-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Für Teams, die Ausschreibungen gemeinsam bewerten.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.65, maxWidth: 480 }}>
                Für kleine und mittlere Bid- und Business-Development-Teams, die Entscheidungen, Nachweise und nächste Aufgaben an einem Ort abstimmen wollen.
              </Typography>
            </Box>
            <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0, minWidth: 0 }}>
              <UseCase>Wenn mehrere Personen Muss-Kriterien und Nachweise abstimmen</UseCase>
              <UseCase>Wenn Go-/No-Go-Entscheidungen nachvollziehbar bleiben sollen</UseCase>
              <UseCase>Wenn aus der Prüfung direkt priorisierte Aufgaben entstehen sollen</UseCase>
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="faq-title" sx={{ minWidth: 0 }}>
            <Box sx={{ maxWidth: 680, mb: 3 }}>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Fragen zur Entscheidung
              </Typography>
              <Typography id="faq-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Klarheit vor dem Checkout.
              </Typography>
            </Box>
            <Box sx={{ borderTop: 1, borderColor: "divider", minWidth: 0, overflow: "hidden" }}>
              {FAQS.map(({ question, answer }) => (
                <Accordion key={question} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderBottom: 1, borderColor: "divider", "&::before": { display: "none" }, overflow: "hidden" }}>
                  <AccordionSummary expandIcon={<ChevronDown size={19} />} sx={{ px: 0, minHeight: 58, "& .MuiAccordionSummary-content": { my: 1.5, minWidth: 0, overflow: "hidden" } }}>
                    <Typography component="h3" fontWeight={700} sx={{ pr: 1, overflowWrap: "anywhere" }}>{question}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0, pb: 2.5, maxWidth: { xs: "100%", sm: 760 }, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, overflowWrap: "anywhere" }}>{answer}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="closing-title" sx={{ p: { xs: 2.5, md: 4 }, border: 1, borderColor: "divider", borderRadius: 2.5, bgcolor: "background.paper", minWidth: 0 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between" alignItems={{ md: "center" }}>
              <Box sx={{ maxWidth: 620, minWidth: 0 }}>
                <Typography id="closing-title" component="h2" variant="h3" sx={{ fontSize: { xs: "1.7rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                  Prüfen Sie Ihre nächste Ausschreibung, bevor Ihr Team Angebotsstunden einplant.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                  Beginnen Sie mit einer Ausschreibung und machen Sie die nächsten Schritte im Team sichtbar.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: "100%", maxWidth: 460, flexShrink: 0 }}>
                <CheckoutButton plan="quarterly" onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} />
                <CheckoutButton plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} soft />
              </Stack>
            </Stack>
          </Box>

          <Stack justifyContent="center" alignItems="center" sx={{ pb: 2, color: "text.secondary" }}>
            <Typography variant="caption">Billing und Rechnungsunterlagen werden über das Stripe-Kundenportal verwaltet.</Typography>
          </Stack>
        </Stack>
      </Container>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab="login" />
    </Box>
  );
}

function HeroOutcome({ title }: { title: string }) {
  return (
    <Stack component="li" direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box sx={{ display: "grid", placeItems: "center", width: 22, height: 22, flexShrink: 0, borderRadius: "50%", bgcolor: "primary.light", color: "primary.dark", mt: 0.1 }}>
        <Check size={14} aria-hidden="true" />
      </Box>
      <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.45 }}>{title}</Typography>
    </Stack>
  );
}

function UseCase({ children }: { children: React.ReactNode }) {
  return (
    <Stack component="li" direction="row" spacing={1.25} alignItems="flex-start">
      <Check size={18} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ lineHeight: 1.55 }}>{children}</Typography>
    </Stack>
  );
}

function CheckoutButton({
  plan,
  onSelect,
  loading,
  disabled,
  soft = false,
}: {
  plan: CheckoutBillingPlan;
  onSelect: (plan: CheckoutBillingPlan) => void;
  loading: boolean;
  disabled: boolean;
  soft?: boolean;
}) {
  return (
    <Button
      fullWidth
      variant={soft ? "outlined" : "contained"}
      onClick={() => onSelect(plan)}
      disabled={disabled || loading}
      aria-busy={loading}
      endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={16} />}
      sx={[
        { width: "100%", minWidth: 0, flex: "1 1 0", whiteSpace: "nowrap", fontSize: { xs: "0.78rem", sm: "0.875rem" }, lineHeight: { xs: 1.25, sm: 1.75 }, py: { xs: 0.75, sm: 0.75 } },
        soft && {
          bgcolor: "rgba(248,216,210,0.5)",
          borderColor: "primary.main",
          color: "primary.main",
          "&:hover": { bgcolor: "rgba(248,216,210,0.75)", borderColor: "primary.dark" },
        },
      ]}
    >
      {loading ? "Wird geöffnet ..." : PLAN_COPY[plan].action}
    </Button>
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
  const copy = PLAN_COPY[plan];
  const priceLabel = `${details.price.replace("$", "")} US-Dollar ${copy.cadence}`;

  return (
    <Box component="article" sx={{ height: "100%", p: { xs: 2, sm: 2.5 }, border: recommended ? 2 : 1, borderColor: recommended ? "primary.main" : "divider", borderRadius: 2, bgcolor: recommended ? "rgba(248,216,210,0.3)" : "background.paper", minWidth: 0 }}>
      <Stack spacing={0.75} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap>
          <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing="0.08em">
            {copy.label}
          </Typography>
          {recommended && (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: "primary.dark" }}>
              <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main" }} />
              <Typography component="span" variant="caption" fontWeight={800} sx={{ whiteSpace: "nowrap" }}>
                Beste Preis-Leistung
              </Typography>
            </Stack>
          )}
        </Stack>
        <Typography variant="h4" fontWeight={800} letterSpacing="-0.04em" sx={{ mt: 0.25, fontSize: { xs: "1.8rem", sm: "2rem" } }}>
          {priceLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
          {copy.billing}
        </Typography>
        {copy.savings && (
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", lineHeight: 1.45 }}>
            {copy.savings}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.5 }}>
          {copy.benefit}
        </Typography>
        <Box sx={{ mt: "auto", pt: 1.25 }}>
          <CheckoutButton plan={plan} onSelect={onSelect} loading={loading} disabled={disabled} soft={!recommended} />
        </Box>
      </Stack>
    </Box>
  );
}
