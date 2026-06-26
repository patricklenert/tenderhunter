"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";

type FeedbackTone = "neutral" | "success" | "error";
type JobStatus = "pending" | "running" | "done" | "failed";
type TrackingEventType = "pursued" | "won" | "lost";

interface FeedbackState { tone: FeedbackTone; message: string }
interface CompanyOption { id: number; name: string }
interface JobItem { id: number; type: string; status: JobStatus; retries: number; maxRetries: number; lastError: string | null }

interface RecommendationItem {
  tenderId: number;
  title: string;
  fit: number;
  winProbability: number;
  effort: number;
  killSwitch: boolean;
  explanation: string;
  updatedAt: string;
}

interface CompanyFormState { name: string; capabilities: string; certifications: string; regions: string; teamSize: string }
interface TenderFormState { title: string; url: string; externalId: string }
interface CrawlFormState { name: string; url: string }

const INITIAL_FEEDBACK: FeedbackState = { tone: "neutral", message: "" };

const JOB_LABELS: Record<string, string> = {
  crawl_sources: "Suche", fetch_documents: "Laden", parse_documents: "Lesen",
  structure_tender: "Ordnen", score_tender: "Bewerten", generate_insight: "Empfehlung", notify_company: "Hinweis"
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = { pending: "Wartet", running: "Laeuft", done: "Fertig", failed: "Fehler" };

const TRACKING_ACTIONS: { label: string; eventType: TrackingEventType }[] = [
  { label: "Merken", eventType: "pursued" },
  { label: "Gewonnen", eventType: "won" },
  { label: "Verloren", eventType: "lost" }
];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const parseCommaList = (v: string): string[] => v.split(",").map(s => s.trim()).filter(Boolean);
const toFiniteNumber = (v: unknown, fb = 0): number => typeof v === "number" && Number.isFinite(v) ? v : fb;
const formatPercent = (v: number): string => `${Math.round(v)} %`;
const clamp = (v: number, min = 0, max = 100): number => Math.max(min, Math.min(max, v));

const readPayload = async (r: Response): Promise<unknown> => {
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) return null;
  try { return await r.json(); } catch { return null; }
};

const requestJson = async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : `Fehler ${response.status}`);
  return payload;
};

const feedbackClass = (tone: FeedbackTone): string => `flow-feedback flow-feedback-${tone}`;

export function WorkflowStudio() {
  const router = useRouter();

  const [companyForm, setCompanyForm] = useState<CompanyFormState>({ name: "", capabilities: "", certifications: "", regions: "", teamSize: "" });
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyFeedback, setCompanyFeedback] = useState<FeedbackState>(INITIAL_FEEDBACK);

  const [tenderForm, setTenderForm] = useState<TenderFormState>({ title: "", url: "", externalId: "" });
  const [tenderBusy, setTenderBusy] = useState(false);
  const [tenderFeedback, setTenderFeedback] = useState<FeedbackState>(INITIAL_FEEDBACK);

  const [crawlForm, setCrawlForm] = useState<CrawlFormState>({ name: "", url: "" });
  const [batchLimit, setBatchLimit] = useState("20");
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineFeedback, setPipelineFeedback] = useState<FeedbackState>(INITIAL_FEEDBACK);
  const [jobs, setJobs] = useState<JobItem[]>([]);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationFeedback, setRecommendationFeedback] = useState<FeedbackState>(INITIAL_FEEDBACK);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [trackingTenderId, setTrackingTenderId] = useState<number | null>(null);

  const selectedCompanyName = useMemo(() => companies.find(c => String(c.id) === selectedCompanyId)?.name ?? "", [companies, selectedCompanyId]);

  const pipelineOverview = useMemo(() => {
    const counts = jobs.reduce((a, j) => { a[j.status] += 1; return a; }, { pending: 0, running: 0, done: 0, failed: 0 } as Record<JobStatus, number>);
    return counts;
  }, [jobs]);

  const refreshCompanies = async (): Promise<void> => {
    const payload = await requestJson("/api/company-profiles");
    if (!isRecord(payload) || !Array.isArray(payload.items)) { setCompanies([]); return; }
    const next: CompanyOption[] = [];
    for (const item of payload.items) {
      if (!isRecord(item) || typeof item.id !== "number" || typeof item.name !== "string" || !item.name.trim()) continue;
      next.push({ id: item.id, name: item.name.trim() });
    }
    setCompanies(next);
  };

  const refreshJobs = async (): Promise<void> => {
    const payload = await requestJson("/api/jobs?limit=12");
    if (!isRecord(payload) || !Array.isArray(payload.items)) { setJobs([]); return; }
    const next: JobItem[] = [];
    for (const item of payload.items) {
      if (!isRecord(item) || typeof item.id !== "number" || typeof item.type !== "string") continue;
      const s = item.status;
      if (s !== "pending" && s !== "running" && s !== "done" && s !== "failed") continue;
      next.push({ id: item.id, type: item.type, status: s, retries: toFiniteNumber(item.retries), maxRetries: toFiniteNumber(item.max_retries), lastError: typeof item.last_error === "string" ? item.last_error : null });
    }
    setJobs(next);
  };

  useEffect(() => {
    void refreshCompanies().catch(() => {});
    void refreshJobs().catch(() => {});
  }, []);

  useEffect(() => {
    if (companies.length === 0 || selectedCompanyId) return;
    setSelectedCompanyId(String(companies[0]?.id ?? ""));
  }, [companies, selectedCompanyId]);

  const handleCompanySubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (companyBusy) return;
    const capabilities = parseCommaList(companyForm.capabilities);
    if (capabilities.length === 0) { setCompanyFeedback({ tone: "error", message: "Mindestens eine Faehigkeit eintragen." }); return; }
    const teamSizeRaw = companyForm.teamSize.trim();
    let parsedTeamSize: number | undefined;
    if (teamSizeRaw.length > 0) {
      const c = Number.parseInt(teamSizeRaw, 10);
      if (!Number.isFinite(c) || c <= 0) { setCompanyFeedback({ tone: "error", message: "Teamgroesse muss positiv sein." }); return; }
      parsedTeamSize = c;
    }
    const payload: Record<string, unknown> = { name: companyForm.name.trim(), capabilities, certifications: parseCommaList(companyForm.certifications), regions: parseCommaList(companyForm.regions) };
    if (parsedTeamSize) payload.team_size = parsedTeamSize;
    setCompanyBusy(true);
    setCompanyFeedback({ tone: "neutral", message: "Speichert..." });
    try {
      const result = await requestJson("/api/company-profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setCompanyFeedback({ tone: "success", message: isRecord(result) && typeof result.id === "number" ? `Gespeichert (ID ${result.id}).` : "Gespeichert." });
      setCompanyForm({ name: "", capabilities: "", certifications: "", regions: "", teamSize: "" });
      await refreshCompanies();
      router.refresh();
    } catch (error) {
      setCompanyFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler beim Speichern." });
    } finally { setCompanyBusy(false); }
  };

  const handleTenderSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (tenderBusy) return;
    const payload: Record<string, unknown> = { source: "manuell", title: tenderForm.title.trim(), url: tenderForm.url.trim() };
    if (tenderForm.externalId.trim()) payload.external_id = tenderForm.externalId.trim();
    setTenderBusy(true);
    setTenderFeedback({ tone: "neutral", message: "Speichert..." });
    try {
      const result = await requestJson("/api/tenders/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const id = isRecord(result) && typeof result.tender_id === "number" ? result.tender_id : null;
      setTenderFeedback({ tone: "success", message: id ? `Gespeichert (ID ${id}).` : "Gespeichert." });
      setTenderForm({ title: "", url: "", externalId: "" });
      await refreshJobs();
      router.refresh();
    } catch (error) {
      setTenderFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler beim Speichern." });
    } finally { setTenderBusy(false); }
  };

  const runPipelineAction = async (mode: "once" | "batch"): Promise<void> => {
    if (pipelineBusy) return;
    setPipelineBusy(true);
    setPipelineFeedback({ tone: "neutral", message: "Laeuft..." });
    try {
      if (mode === "once") {
        const payload = await requestJson("/api/pipeline/run-once", { method: "POST" });
        setPipelineFeedback(isRecord(payload) && payload.processed === false ? { tone: "neutral", message: "Keine Aufgabe offen." } : { tone: "success", message: "Erledigt." });
      } else {
        const limit = Math.max(1, Math.min(Number.parseInt(batchLimit, 10) || 20, 200));
        const payload = await requestJson(`/api/pipeline/run-batch?limit=${limit}`, { method: "POST" });
        const processed = isRecord(payload) && typeof payload.processed === "number" ? payload.processed : 0;
        setPipelineFeedback(processed === 0 ? { tone: "neutral", message: "Nichts offen." } : { tone: "success", message: `${processed} erledigt.` });
      }
      await refreshJobs();
      router.refresh();
    } catch (error) {
      setPipelineFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler." });
    } finally { setPipelineBusy(false); }
  };

  const handleDefaultCrawl = async (): Promise<void> => {
    if (pipelineBusy) return;
    setPipelineBusy(true);
    setPipelineFeedback({ tone: "neutral", message: "Suche laeuft..." });
    try {
      await requestJson("/api/pipeline/crawl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      setPipelineFeedback({ tone: "success", message: "Suche gestartet." });
      await refreshJobs();
      router.refresh();
    } catch (error) {
      setPipelineFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler." });
    } finally { setPipelineBusy(false); }
  };

  const handleCustomCrawl = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pipelineBusy) return;
    const url = crawlForm.url.trim();
    if (!url) { setPipelineFeedback({ tone: "error", message: "URL fehlt." }); return; }
    setPipelineBusy(true);
    setPipelineFeedback({ tone: "neutral", message: "Suche laeuft..." });
    try {
      await requestJson("/api/pipeline/crawl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sources: [{ name: crawlForm.name.trim() || undefined, url }] }) });
      setPipelineFeedback({ tone: "success", message: "Suche gestartet." });
      setCrawlForm({ name: "", url: "" });
      await refreshJobs();
      router.refresh();
    } catch (error) {
      setPipelineFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler." });
    } finally { setPipelineBusy(false); }
  };

  const handleLoadRecommendations = async (): Promise<void> => {
    if (recommendationBusy) return;
    const companyId = Number.parseInt(selectedCompanyId, 10);
    if (!Number.isFinite(companyId) || companyId <= 0) { setRecommendationFeedback({ tone: "error", message: "Firma waehlen." }); return; }
    setRecommendationBusy(true);
    setRecommendationFeedback({ tone: "neutral", message: "Laedt..." });
    try {
      const payload = await requestJson(`/api/recommendations/${companyId}`);
      if (!isRecord(payload) || !Array.isArray(payload.items)) { setRecommendations([]); setRecommendationFeedback({ tone: "success", message: "0 Empfehlungen." }); return; }
      const items: RecommendationItem[] = [];
      for (const item of payload.items) {
        if (!isRecord(item) || typeof item.tender_id !== "number") continue;
        items.push({
          tenderId: item.tender_id,
          title: typeof item.title === "string" && item.title.trim() ? item.title : `#${item.tender_id}`,
          fit: clamp(toFiniteNumber(item.fit)),
          winProbability: clamp(toFiniteNumber(item.win_probability)),
          effort: clamp(toFiniteNumber(item.effort)),
          killSwitch: item.kill_switch === 1 || item.kill_switch === true,
          explanation: typeof item.explanation === "string" ? item.explanation : "",
          updatedAt: typeof item.updated_at === "string" ? item.updated_at : ""
        });
      }
      setRecommendations(items);
      setRecommendationFeedback({ tone: "success", message: `${items.length} Empfehlungen.` });
    } catch (error) {
      setRecommendationFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler." });
    } finally { setRecommendationBusy(false); }
  };

  const handleTrackEvent = async (tenderId: number, eventType: TrackingEventType): Promise<void> => {
    const companyId = Number.parseInt(selectedCompanyId, 10);
    if (!Number.isFinite(companyId) || companyId <= 0) return;
    setTrackingTenderId(tenderId);
    try {
      await requestJson("/api/tracking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tender_id: tenderId, company_id: companyId, event_type: eventType, metadata: { source: "workflow-ui" } }) });
      setRecommendationFeedback({ tone: "success", message: `Gespeichert: ${TRACKING_ACTIONS.find(a => a.eventType === eventType)?.label ?? eventType}.` });
      router.refresh();
    } catch (error) {
      setRecommendationFeedback({ tone: "error", message: error instanceof Error ? error.message : "Fehler." });
    } finally { setTrackingTenderId(null); }
  };

  return (
    <section className="surface workflow-surface">
      <div className="workflow-head">
        <h2>Ablauf</h2>
      </div>

      <div className="workflow-grid">
        <article className="flow-step flow-profile">
          <header className="flow-headline">
            <span className="step-chip">1</span>
            <h3>Unternehmen</h3>
          </header>
          <form className="flow-form" onSubmit={handleCompanySubmit}>
            <label>
              Name
              <input required value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Faehigkeiten (Komma)
              <input required value={companyForm.capabilities} onChange={e => setCompanyForm(p => ({ ...p, capabilities: e.target.value }))} placeholder="Cloud, DevOps" />
            </label>
            <div className="flow-field-grid">
              <label>
                Zertifikate
                <input value={companyForm.certifications} onChange={e => setCompanyForm(p => ({ ...p, certifications: e.target.value }))} placeholder="ISO 27001" />
              </label>
              <label>
                Regionen
                <input value={companyForm.regions} onChange={e => setCompanyForm(p => ({ ...p, regions: e.target.value }))} placeholder="DACH" />
              </label>
            </div>
            <label>
              Team (optional)
              <input type="number" min={1} value={companyForm.teamSize} onChange={e => setCompanyForm(p => ({ ...p, teamSize: e.target.value }))} />
            </label>
            <button className="action-button" type="submit" disabled={companyBusy}>{companyBusy ? "..." : "Speichern"}</button>
          </form>
          {companyFeedback.message ? <p className={feedbackClass(companyFeedback.tone)}>{companyFeedback.message}</p> : null}
        </article>

        <article className="flow-step flow-tender">
          <header className="flow-headline">
            <span className="step-chip">2</span>
            <h3>Ausschreibung</h3>
          </header>
          <form className="flow-form" onSubmit={handleTenderSubmit}>
            <label>
              Titel
              <input required value={tenderForm.title} onChange={e => setTenderForm(p => ({ ...p, title: e.target.value }))} />
            </label>
            <label>
              URL
              <input required type="url" value={tenderForm.url} onChange={e => setTenderForm(p => ({ ...p, url: e.target.value }))} />
            </label>
            <label>
              Kennnr. (optional)
              <input value={tenderForm.externalId} onChange={e => setTenderForm(p => ({ ...p, externalId: e.target.value }))} />
            </label>
            <button className="action-button" type="submit" disabled={tenderBusy}>{tenderBusy ? "..." : "Speichern"}</button>
          </form>
          {tenderFeedback.message ? <p className={feedbackClass(tenderFeedback.tone)}>{tenderFeedback.message}</p> : null}
        </article>

        <article className="flow-step flow-pipeline">
          <header className="flow-headline">
            <span className="step-chip">3</span>
            <h3>Bearbeitung</h3>
          </header>

          <Skeleton name="pipeline-overview" loading={false}>
            <dl className="pipeline-overview">
              <div><dt>Warten</dt><dd>{pipelineOverview.pending}</dd></div>
              <div><dt>Laeuft</dt><dd>{pipelineOverview.running}</dd></div>
              <div><dt>Fertig</dt><dd>{pipelineOverview.done}</dd></div>
              <div><dt>Fehler</dt><dd>{pipelineOverview.failed}</dd></div>
            </dl>
          </Skeleton>

          <div className="pipeline-layout">
            <section className="pipeline-panel">
              <h4>Aufgaben</h4>
              <div className="pipeline-control-grid">
                <button className="action-button" type="button" onClick={() => void runPipelineAction("once")} disabled={pipelineBusy}>Eine</button>
                <div className="batch-card">
                  <div className="batch-inline">
                    <input type="number" min={1} max={200} value={batchLimit} onChange={e => setBatchLimit(e.target.value)} />
                    <button className="action-button" type="button" onClick={() => void runPipelineAction("batch")} disabled={pipelineBusy}>Alle</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="pipeline-panel">
              <h4>Suche</h4>
              <button className="action-button action-ghost" type="button" onClick={() => void handleDefaultCrawl()} disabled={pipelineBusy}>Standard</button>
              <form className="crawl-stack" onSubmit={e => void handleCustomCrawl(e)}>
                <div className="flow-field-grid">
                  <label>Name<input value={crawlForm.name} onChange={e => setCrawlForm(p => ({ ...p, name: e.target.value }))} /></label>
                  <label>URL<input type="url" required value={crawlForm.url} onChange={e => setCrawlForm(p => ({ ...p, url: e.target.value }))} /></label>
                </div>
                <button className="action-button action-ghost" type="submit" disabled={pipelineBusy}>Starten</button>
              </form>
            </section>
          </div>

          {pipelineFeedback.message ? <p className={feedbackClass(pipelineFeedback.tone)}>{pipelineFeedback.message}</p> : null}

          <Skeleton name="job-feed" loading={false}>
            {jobs.length > 0 && (
              <div className="job-feed-wrap">
                <div className="job-feed-head">
                  <h4>Aufgaben</h4>
                  <button className="text-button" type="button" onClick={() => void refreshJobs()}>Aktualisieren</button>
                </div>
                <ul className="job-feed">
                  {jobs.map(job => (
                    <li key={job.id}>
                      <div className="job-main">
                        <strong>{JOB_LABELS[job.type] ?? job.type.replaceAll("_", " ")}</strong>
                        <span className={`job-state job-state-${job.status}`}>{JOB_STATUS_LABELS[job.status]}</span>
                      </div>
                      {job.lastError ? <p className="job-error">{job.lastError}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Skeleton>
        </article>

        <article className="flow-step flow-recommend">
          <header className="flow-headline">
            <span className="step-chip">4</span>
            <h3>Empfehlungen</h3>
          </header>

          <div className="recommend-controls">
            <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} disabled={companies.length === 0}>
              {companies.length === 0 ? <option value="">Keine Firma</option> : null}
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="action-button" type="button" onClick={() => void handleLoadRecommendations()} disabled={recommendationBusy || companies.length === 0}>{recommendationBusy ? "..." : "Laden"}</button>
          </div>

          {recommendationFeedback.message ? <p className={feedbackClass(recommendationFeedback.tone)}>{recommendationFeedback.message}</p> : null}

          <Skeleton name="recommendations" loading={false}>
            {recommendations.length > 0 && (
              <ul className="recommend-list">
                {recommendations.map(item => (
                  <li key={`${item.tenderId}-${item.updatedAt}`}>
                    <div className="recommend-top">
                      <h4>{item.title}</h4>
                      <span className={`state-pill ${item.killSwitch ? "state-risk" : "state-ok"}`}>{item.killSwitch ? "Stopp" : "OK"}</span>
                    </div>
                    <dl className="recommend-metrics">
                      <div><dt>Passung</dt><dd>{formatPercent(item.fit)}</dd></div>
                      <div><dt>Chance</dt><dd>{formatPercent(item.winProbability)}</dd></div>
                      <div><dt>Aufwand</dt><dd>{formatPercent(item.effort)}</dd></div>
                    </dl>
                    {item.explanation ? <p className="muted" style={{ fontSize: "0.82rem" }}>{item.explanation}</p> : null}
                    <div className="track-actions">
                      {TRACKING_ACTIONS.map(action => (
                        <button key={`${item.tenderId}-${action.eventType}`} className="action-button action-ghost" type="button" onClick={() => void handleTrackEvent(item.tenderId, action.eventType)} disabled={trackingTenderId === item.tenderId}>
                          {trackingTenderId === item.tenderId ? "..." : action.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Skeleton>
        </article>
      </div>
    </section>
  );
}
