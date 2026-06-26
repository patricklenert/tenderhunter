"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "running" | "done" | "failed";

interface JobItem {
  id: number;
  type: string;
  status: JobStatus;
  retries: number;
  maxRetries: number;
  runAfter: string;
  lastError: string | null;
}

const JOB_LABELS: Record<string, string> = {
  crawl_sources: "Suche",
  fetch_documents: "Laden",
  parse_documents: "Lesen",
  structure_tender: "Ordnen",
  score_tender: "Bewerten",
  generate_insight: "Empfehlung",
  notify_company: "Hinweis",
};

const STATUS_CLASSES: Record<JobStatus, string> = {
  pending: "bg-accent-soft text-accent",
  running: "bg-warning-soft text-warning",
  done: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Wartet",
  running: "Laeuft",
  done: "Fertig",
  failed: "Fehler",
};

export function PipelineSection() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: string; message: string } | null>(null);
  const [batchLimit, setBatchLimit] = useState("20");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlName, setCrawlName] = useState("");

  const refreshJobs = async () => {
    try {
      const res = await fetch("/api/jobs?limit=20", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || !Array.isArray(payload.items)) {
        setJobs([]);
        return;
      }
      const next: JobItem[] = [];
      for (const item of payload.items) {
        if (
          typeof item.id !== "number" ||
          typeof item.type !== "string" ||
          !["pending", "running", "done", "failed"].includes(item.status)
        )
          continue;
        next.push({
          id: item.id,
          type: item.type,
          status: item.status,
          retries: typeof item.retries === "number" ? item.retries : 0,
          maxRetries: typeof item.max_retries === "number" ? item.max_retries : 3,
          runAfter: typeof item.run_after === "string" ? item.run_after : "",
          lastError: typeof item.last_error === "string" ? item.last_error : null,
        });
      }
      setJobs(next);
    } catch {
      setJobs([]);
    }
  };

  useEffect(() => {
    void refreshJobs();
  }, []);

  const runAction = async (mode: "once" | "batch") => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (mode === "once") {
        const res = await fetch("/api/pipeline/run-once", { method: "POST" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Fehler");
        setFeedback({
          tone: "success",
          message: payload.processed === false ? "Keine offene Aufgabe." : "Aufgabe bearbeitet.",
        });
      } else {
        const limit = Math.max(1, Math.min(Number.parseInt(batchLimit) || 20, 200));
        const res = await fetch(`/api/pipeline/run-batch?limit=${limit}`, { method: "POST" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Fehler");
        const processed = typeof payload.processed === "number" ? payload.processed : 0;
        setFeedback({
          tone: "success",
          message: processed === 0 ? "Keine offenen Aufgaben." : `${processed} Aufgaben bearbeitet.`,
        });
      }
      await refreshJobs();
      router.refresh();
    } catch (err) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setBusy(false);
    }
  };

  const handleCrawl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const body: Record<string, unknown> = {};
    if (crawlUrl.trim()) {
      body.sources = [{ name: crawlName.trim() || undefined, url: crawlUrl.trim() }];
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/pipeline/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Fehler");
      const jobId = typeof payload.enqueued_job_id === "number" ? payload.enqueued_job_id : null;
      setFeedback({ tone: "success", message: jobId ? `Suche gestartet (Aufgabe ${jobId}).` : "Suche gestartet." });
      setCrawlUrl("");
      setCrawlName("");
      await refreshJobs();
      router.refresh();
    } catch (err) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aufgaben</h3>
          <div className="space-y-2">
            <button
              onClick={() => void runAction("once")}
              disabled={busy}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Naechste Aufgabe
            </button>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={200}
                value={batchLimit}
                onChange={(e) => setBatchLimit(e.target.value)}
                className="w-20 text-center text-sm border border-border rounded-lg bg-surface text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
              <button
                onClick={() => void runAction("batch")}
                disabled={busy}
                className="flex-1 px-4 py-2.5 bg-surface-strong text-foreground text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stapel starten
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Suche</h3>
          <form onSubmit={handleCrawl} className="space-y-2">
            <input
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              type="url"
              placeholder="https://www.bund.de/..."
              className="w-full text-sm border border-border rounded-lg bg-surface text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <input
              value={crawlName}
              onChange={(e) => setCrawlName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full text-sm border border-border rounded-lg bg-surface text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 bg-surface-strong text-foreground text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suche starten
            </button>
          </form>
        </div>
      </div>

      {feedback && (
        <div
          className={`text-sm px-4 py-3 rounded-lg ${
            feedback.tone === "success"
              ? "bg-success-soft text-success border border-success/20"
              : "bg-danger-soft text-danger border border-danger/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Letzte Aufgaben</h3>
          <button
            onClick={() => void refreshJobs()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Aktualisieren
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Noch keine Aufgaben.</p>
        ) : (
          <div className="divide-y divide-border">
            {jobs.map((job) => (
              <div key={job.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{JOB_LABELS[job.type] ?? job.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    #{job.id} · Versuch {job.retries}/{job.maxRetries}
                    {job.lastError && <span className="text-danger"> · {job.lastError}</span>}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[job.status]}`}>
                  {STATUS_LABELS[job.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
