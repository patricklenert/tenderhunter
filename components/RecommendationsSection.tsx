"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { PaywallPanel } from "@/components/billing/PaywallPanel";

type TrackingEventType = "pursued" | "won" | "lost";

interface CompanyOption {
  id: number;
  name: string;
}

interface RecommendationItem {
  tenderId: number;
  title: string;
  source: string;
  fit: number;
  winProbability: number;
  effort: number;
  requirementCoverage: number;
  killSwitch: boolean;
  explanation: string;
  actions: string[];
  missingItems: string[];
  updatedAt: string;
}

const TRACKING_ACTIONS: { label: string; eventType: TrackingEventType }[] = [
  { label: "Merken", eventType: "pursued" },
  { label: "Gewonnen", eventType: "won" },
  { label: "Verloren", eventType: "lost" },
];

const formatPercent = (v: number) => `${Math.round(v)} %`;
const formatDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("de-DE");
};

const parseJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value))
    return value.filter((i): i is string => typeof i === "string").filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed.filter((i): i is string => typeof i === "string").filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

export function RecommendationsSection() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: string; message: string } | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    fetch("/api/company-profiles", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((p) => {
        if (!Array.isArray(p.items)) return;
        const opts: CompanyOption[] = [];
        for (const item of p.items) {
          if (typeof item.id === "number" && typeof item.name === "string" && item.name.trim())
            opts.push({ id: item.id, name: item.name.trim() });
        }
        setCompanies(opts);
        if (opts.length > 0) setSelectedCompanyId(String(opts[0].id));
      })
      .catch(() => {});
  }, []);

  const loadRecommendations = async () => {
    const companyId = Number.parseInt(selectedCompanyId, 10);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      setFeedback({ tone: "error", message: "Bitte zuerst ein Unternehmen auswaehlen." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/recommendations/${companyId}`, { cache: "no-store" });
      if (res.status === 402) {
        setPaywall(true);
        return;
      }
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Fehler");

      const items: RecommendationItem[] = [];
      if (Array.isArray(payload.items)) {
        for (const item of payload.items) {
          if (typeof item !== "object" || item === null) continue;
          if (typeof item.tender_id !== "number") continue;
          items.push({
            tenderId: item.tender_id,
            title:
              typeof item.title === "string" && item.title.trim()
                ? item.title
                : `#${item.tender_id}`,
            source: typeof item.source === "string" ? item.source : "unbekannt",
            fit: Math.max(0, Math.min(100, typeof item.fit === "number" ? item.fit : 0)),
            winProbability: Math.max(
              0,
              Math.min(100, typeof item.win_probability === "number" ? item.win_probability : 0)
            ),
            effort: Math.max(0, Math.min(100, typeof item.effort === "number" ? item.effort : 0)),
            requirementCoverage:
              Math.max(
                0,
                Math.min(
                  100,
                  (typeof item.requirement_coverage === "number"
                    ? item.requirement_coverage
                    : 0) * 100
                )
              ),
            killSwitch: item.kill_switch === 1 || item.kill_switch === true,
            explanation: typeof item.explanation === "string" ? item.explanation : "",
            actions: parseJsonArray(item.actions_json),
            missingItems: parseJsonArray(item.missing_items_json),
            updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
          });
        }
      }

      setRecommendations(items);
      const companyName =
        companies.find((c) => String(c.id) === selectedCompanyId)?.name ?? `Firma ${companyId}`;
      setFeedback({
        tone: "success",
        message: `${items.length} Empfehlungen fuer ${companyName}.`,
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Fehler beim Laden.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTrack = async (tenderId: number, eventType: TrackingEventType) => {
    const companyId = Number.parseInt(selectedCompanyId, 10);
    if (!Number.isFinite(companyId)) return;

    setTrackingId(tenderId);
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tender_id: tenderId,
          company_id: companyId,
          event_type: eventType,
          metadata: { source: "ui" },
        }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error ?? "Fehler");
      }
      const label = TRACKING_ACTIONS.find((a) => a.eventType === eventType)?.label ?? eventType;
      setFeedback({ tone: "success", message: `Gespeichert: ${label}.` });
      router.refresh();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Fehler beim Speichern.",
      });
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {paywall && <PaywallPanel feature="KI-Empfehlungen" title="Empfehlungen freischalten" description="Die Ausschreibungssuche bleibt offen. Billing schaltet personalisierte Passungs- und Gewinnchancen frei." />}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <label className="flex-1 min-w-0">
            Unternehmen
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              disabled={companies.length === 0}
            >
              {companies.length === 0 ? (
                <option value="">Kein Unternehmen vorhanden</option>
              ) : (
                companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            onClick={() => void loadRecommendations()}
            disabled={busy || companies.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {busy ? "Laedt..." : "Anzeigen"}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            feedback.tone === "success"
              ? "bg-success-soft text-success border border-success/20"
              : "bg-danger-soft text-danger border border-danger/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Keine Empfehlungen</p>
          <p className="text-sm text-muted-foreground mt-1">
            Waehle ein Unternehmen und klicke auf "Anzeigen".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((item) => (
            <div
              key={`${item.tenderId}-${item.updatedAt}`}
              className="bg-surface border border-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.source} · {formatDate(item.updatedAt)}
                  </p>
                </div>
                {item.killSwitch ? (
                  <span className="state-pill state-risk shrink-0">Stopp</span>
                ) : (
                  <span className="state-pill state-ok shrink-0">OK</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Passung</p>
                  <p className="text-sm font-semibold text-foreground">{formatPercent(item.fit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gewinnchance</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPercent(item.winProbability)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aufwand</p>
                  <p className="text-sm font-semibold text-foreground">{formatPercent(item.effort)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Abdeckung</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPercent(item.requirementCoverage)}
                  </p>
                </div>
              </div>

              {item.explanation && (
                <p className="text-sm text-muted-foreground mb-3">{item.explanation}</p>
              )}

              {item.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.actions.map((action) => (
                    <span
                      key={action}
                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              )}

              {item.missingItems.length > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  Fehlt: {item.missingItems.join(", ")}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                {TRACKING_ACTIONS.map((action) => (
                  <button
                    key={`${item.tenderId}-${action.eventType}`}
                    onClick={() => void handleTrack(item.tenderId, action.eventType)}
                    disabled={trackingId === item.tenderId}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface-strong text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {trackingId === item.tenderId ? "..." : action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
