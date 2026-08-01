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
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  action: string;
}> = {
  weekly: {
    label: "Wochenplan",
    cadence: "pro Woche",
    billing: "Wöchentliche Abrechnung über Stripe.",
    action: "Mit dem Wochenplan starten",
  },
  quarterly: {
    label: "3-Monats-Plan",
    cadence: "alle 3 Monate",
    billing: "Abrechnung alle drei Monate über Stripe.",
    action: "Ausschreibungen 3 Monate prüfen",
  },
};

const HERO_OUTCOMES = [
  {
    title: "Unpassende Ausschreibungen früh aussortieren",
    description: "Erkennen Sie vor der Bearbeitung, ob Voraussetzungen, Leistungen und Fristen realistisch passen.",
  },
  {
    title: "Kritische Anforderungen sofort sehen",
    description: "Fehlende Nachweise, Risiken und offene Punkte werden früh sichtbar.",
  },
  {
    title: "Mit einem klaren Angebotsplan starten",
    description: "Priorisierte Aufgaben, Anforderungsmatrix und Entscheidungsgrundlage bleiben an einem Ort.",
  },
] as const;

const INCLUDED_FEATURES = [
  "Passung zum Unternehmensprofil und Risikosignale",
  "Vergabeunterlagen und Dokumente in einem Arbeitsfall",
  "Muss-Kriterien und Nachweise in einer Anforderungsmatrix",
  "Priorisierte nächste Aufgaben für die Angebotsvorbereitung",
  "Bid Pack sowie Brief- und Matrix-Exporte für das Team",
  "U.S. Pursuit Briefs und Such-Alerts",
];

const FAQS = [
  {
    question: "Was ist in Tenderhunter Pro enthalten?",
    answer: "Pro schaltet die Arbeitsansicht frei, die eine Ausschreibung gegen Ihr Unternehmen prüft und daraus Risiken, Muss-Kriterien, nächste Aufgaben und einen Angebotsplan ableitet. Dazu gehören KI-Matching, Unternehmensanalyse, Anforderungsmatrix, Bid Packs, Dokumente, Exporte sowie U.S. Pursuit Briefs und Such-Alerts.",
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
        <Box component="header" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44, mb: { xs: 1.5, md: 3.5 } }}>
          <Link href="/" aria-label="Tenderhunter Startseite" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            <Image src="/logo.webp" alt="Tenderhunter" width={120} height={37} priority />
          </Link>
          <Button component={Link} href="/" variant="text" color="inherit" startIcon={<ArrowLeft size={17} />} sx={{ color: "text.secondary", px: 1, minHeight: 40 }}>
            Zur App
          </Button>
        </Box>

        <Stack spacing={{ xs: 6, md: 8 }}>
          <Box component="section" aria-labelledby="upgrade-title" sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(370px, 0.82fr)" }, gap: { xs: 2.5, md: 6 }, alignItems: "start" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.12em" }}>
                Tenderhunter Pro
              </Typography>
              <Typography id="upgrade-title" component="h1" sx={{ mt: 0.75, maxWidth: 670, overflowWrap: "normal", hyphens: "none", fontSize: { xs: "2.05rem", sm: "2.65rem", md: "3.05rem" }, lineHeight: 1.07, letterSpacing: "-0.045em", fontWeight: 700 }}>
                In wenigen Minuten wissen, ob sich diese Ausschreibung für Ihr Unternehmen lohnt.
              </Typography>
              <Typography component="p" sx={{ mt: 1.75, maxWidth: 650, color: "text.secondary", fontSize: { xs: "1rem", md: "1.06rem" }, lineHeight: 1.6 }}>
                Tenderhunter prüft Passung, Muss-Kriterien und Risiken und erstellt einen konkreten Angebotsplan, bevor Ihr Team Stunden in eine ungeeignete Ausschreibung investiert.
              </Typography>

            </Box>

            <Paper component="section" aria-labelledby="plans-title" variant="outlined" sx={{ p: { xs: 1.75, sm: 2.25 }, minWidth: 0, borderRadius: 2.5, bgcolor: "background.paper" }}>
              <Stack spacing={{ xs: 1.25, sm: 1.5 }}>
                <Box>
                  <Typography id="plans-title" component="h2" variant="h5" fontWeight={700}>
                    Direkt mit der nächsten Prüfung starten
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5 }}>
                    Beide Pläne enthalten alle Pro-Funktionen.
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

                <Stack spacing={1} role="group" aria-label="Tenderhunter Pro Pläne">
                  <PlanOption plan="quarterly" recommended onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} />
                  <PlanOption plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <Typography variant="caption">Sicherer Checkout über Stripe.</Typography>
                </Stack>
              </Stack>
            </Paper>

            <Stack component="ul" spacing={1.35} sx={{ listStyle: "none", p: 0, m: 0, maxWidth: 630, gridColumn: { md: "1" } }}>
              {HERO_OUTCOMES.map(({ title, description }) => (
                <HeroOutcome key={title} title={title}>{description}</HeroOutcome>
              ))}
            </Stack>
          </Box>

          <UpgradeProductPreview />

          <Box component="section" aria-labelledby="features-title" sx={{ borderTop: 1, borderColor: "divider", pt: { xs: 3, md: 4 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 0.7fr) minmax(0, 1.3fr)" }, gap: { xs: 3, md: 7 } }}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                In beiden Plänen enthalten
              </Typography>
              <Typography id="features-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Was nach der Prüfung für Ihr Team bereitsteht.
              </Typography>
            </Box>
            <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 4, rowGap: 1.5 }}>
              {INCLUDED_FEATURES.map((feature) => (
                <Stack component="li" key={feature} direction="row" spacing={1.25} alignItems="flex-start">
                  <Check size={18} color="currentColor" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ lineHeight: 1.55 }}>{feature}</Typography>
                </Stack>
              ))}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="audience-title" sx={{ p: { xs: 2.5, md: 4 }, border: 1, borderColor: "divider", borderRadius: 2.5, bgcolor: "rgba(232,239,245,0.48)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.8fr) minmax(0, 1.2fr)" }, gap: { xs: 3, md: 7 }, alignItems: "start" }}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Für wen Pro gedacht ist
              </Typography>
              <Typography id="audience-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Für Teams, die vor der Angebotsarbeit Klarheit brauchen.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.65, maxWidth: 480 }}>
                Für kleine und mittlere Bid- und Business-Development-Teams, die nur Ressourcen binden wollen, wenn eine Vergabe realistisch verfolgt werden kann.
              </Typography>
            </Box>
            <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
              <UseCase>Frühe Prüfung, bevor Angebotsstunden eingeplant werden</UseCase>
              <UseCase>Nachvollziehbare Go-/No-Go-Entscheidungen im Team</UseCase>
              <UseCase>Klare Übergabe von Risiken, Nachweisen und Aufgaben</UseCase>
              <UseCase>Recherche von U.S. Opportunities und Subcontracting-Möglichkeiten</UseCase>
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="faq-title">
            <Box sx={{ maxWidth: 680, mb: 3 }}>
              <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing="0.1em">
                Fragen zur Entscheidung
              </Typography>
              <Typography id="faq-title" component="h2" variant="h3" sx={{ mt: 0.75, fontSize: { xs: "1.75rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                Klarheit vor dem Checkout.
              </Typography>
            </Box>
            <Box sx={{ borderTop: 1, borderColor: "divider" }}>
              {FAQS.map(({ question, answer }) => (
                <Accordion key={question} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderBottom: 1, borderColor: "divider", "&::before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ChevronDown size={19} />} sx={{ px: 0, minHeight: 58, "& .MuiAccordionSummary-content": { my: 1.5 } }}>
                    <Typography component="h3" fontWeight={700}>{question}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0, pb: 2.5, maxWidth: 760 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{answer}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="closing-title" sx={{ p: { xs: 2.5, md: 4 }, border: 1, borderColor: "divider", borderRadius: 2.5, bgcolor: "background.paper" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between" alignItems={{ md: "center" }}>
              <Box sx={{ maxWidth: 620 }}>
                <Typography id="closing-title" component="h2" variant="h3" sx={{ fontSize: { xs: "1.7rem", md: "2rem" }, letterSpacing: "-0.025em" }}>
                  Nicht jede Ausschreibung verdient Stunden Ihres Teams.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                  Prüfen Sie Passung, sehen Sie kritische Anforderungen früher und starten Sie nur mit einem klaren Angebotsplan.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: { xs: "100%", md: "auto" }, flexShrink: 0 }}>
                <CheckoutButton plan="quarterly" onSelect={startCheckout} loading={loadingPlan === "quarterly"} disabled={plansDisabled} fullWidth={false} />
                <CheckoutButton plan="weekly" onSelect={startCheckout} loading={loadingPlan === "weekly"} disabled={plansDisabled} variant="outlined" fullWidth={false} />
              </Stack>
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center" alignItems="center" sx={{ pb: 2, color: "text.secondary" }}>
            <Typography variant="caption">Sicherer Checkout über Stripe.</Typography>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
            <Typography variant="caption">Billing und Rechnungsunterlagen werden über das Stripe-Kundenportal verwaltet.</Typography>
          </Stack>
        </Stack>
      </Container>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab="login" />
    </Box>
  );
}

function HeroOutcome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack component="li" direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ display: "grid", placeItems: "center", width: 22, height: 22, flexShrink: 0, borderRadius: "50%", bgcolor: "primary.light", color: "primary.dark", mt: 0.1 }}>
        <Check size={14} aria-hidden="true" />
      </Box>
      <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
        <Box component="span" sx={{ display: "block", fontWeight: 700, color: "text.primary" }}>{title}</Box>
        <Box component="span" sx={{ color: "text.secondary" }}>{children}</Box>
      </Typography>
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
  variant = "contained",
  fullWidth = true,
}: {
  plan: CheckoutBillingPlan;
  onSelect: (plan: CheckoutBillingPlan) => void;
  loading: boolean;
  disabled: boolean;
  variant?: "contained" | "outlined";
  fullWidth?: boolean;
}) {
  return (
    <Button
      fullWidth={fullWidth}
      variant={variant}
      onClick={() => onSelect(plan)}
      disabled={disabled || loading}
      aria-busy={loading}
      endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={16} />}
      sx={{ whiteSpace: { xs: "normal", sm: "nowrap" }, flex: { xs: "1 1 auto", sm: "0 1 auto" }, minWidth: { sm: 0 }, fontSize: { xs: "0.78rem", sm: "0.875rem" }, lineHeight: { xs: 1.25, sm: 1.75 }, py: { xs: 0.75, sm: 0.75 } }}
    >
      {loading ? "Checkout wird geöffnet ..." : PLAN_COPY[plan].action}
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

  return (
    <Box component="article" sx={{ p: { xs: 1.25, sm: 1.75 }, border: 1, borderColor: recommended ? "primary.light" : "divider", borderRadius: 2, bgcolor: recommended ? "rgba(248,216,210,0.22)" : "transparent" }}>
      <Stack direction="row" spacing={1.25} justifyContent="space-between" alignItems="center">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing="0.08em">
              {copy.label}
            </Typography>
            {recommended && <Chip label="Beste Preis-Leistung" size="small" variant="outlined" sx={{ fontWeight: 700 }} />}
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ mt: 0.5 }}>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.04em">{details.price}</Typography>
            <Typography variant="body2" color="text.secondary">{copy.cadence}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {copy.billing}
          </Typography>
          {plan === "quarterly" && (
            <Typography variant="caption" color="primary.dark" fontWeight={700} sx={{ display: "block", mt: 0.5 }}>
              75 % günstiger als 13 einzelne Wochen.
            </Typography>
          )}
        </Box>
        <Box sx={{ width: { xs: 136, sm: 222 }, flexShrink: 0 }}>
          <CheckoutButton plan={plan} onSelect={onSelect} loading={loading} disabled={disabled} variant={recommended ? "contained" : "outlined"} />
        </Box>
      </Stack>
    </Box>
  );
}
