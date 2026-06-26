"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";

interface CompanyFormState {
  name: string;
  capabilities: string;
  certifications: string;
  regions: string;
  teamSize: string;
}

export function CompaniesSection() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyFormState>({
    name: "",
    capabilities: "",
    certifications: "",
    regions: "",
    teamSize: "",
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: string; message: string } | null>(null);

  const parseCommaList = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const capabilities = parseCommaList(form.capabilities);
    if (capabilities.length === 0) {
      setFeedback({ tone: "error", message: "Bitte mindestens eine Faehigkeit eintragen." });
      return;
    }

    const teamSizeRaw = form.teamSize.trim();
    let parsedTeamSize: number | undefined;
    if (teamSizeRaw.length > 0) {
      const n = Number.parseInt(teamSizeRaw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setFeedback({ tone: "error", message: "Teamgroesse muss eine positive Zahl sein." });
        return;
      }
      parsedTeamSize = n;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      capabilities,
      certifications: parseCommaList(form.certifications),
      regions: parseCommaList(form.regions),
    };
    if (parsedTeamSize) payload.team_size = parsedTeamSize;

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/company-profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Fehler");

      const id = typeof result.id === "number" ? result.id : null;
      setFeedback({
        tone: "success",
        message: id ? `Unternehmen gespeichert (ID ${id}).` : "Unternehmen gespeichert.",
      });
      setForm({ name: "", capabilities: "", certifications: "", regions: "", teamSize: "" });
      router.refresh();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Fehler beim Speichern.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Plus className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Unternehmen anlegen</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <label>
            Firmenname
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Palema Digital GmbH"
            />
          </label>

          <label>
            Faehigkeiten (mit Komma trennen)
            <input
              required
              value={form.capabilities}
              onChange={(e) => setForm((p) => ({ ...p, capabilities: e.target.value }))}
              placeholder="Cloud, DevOps, Betrieb"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label>
              Zertifikate
              <input
                value={form.certifications}
                onChange={(e) => setForm((p) => ({ ...p, certifications: e.target.value }))}
                placeholder="ISO 27001, BSI C5"
              />
            </label>
            <label>
              Regionen
              <input
                value={form.regions}
                onChange={(e) => setForm((p) => ({ ...p, regions: e.target.value }))}
                placeholder="Deutschland, DACH"
              />
            </label>
          </div>

          <label>
            Teamgroesse (optional)
            <input
              type="number"
              min={1}
              value={form.teamSize}
              onChange={(e) => setForm((p) => ({ ...p, teamSize: e.target.value }))}
              placeholder="35"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Speichert..." : "Speichern"}
          </button>
        </form>

        {feedback && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm ${
              feedback.tone === "success"
                ? "bg-success-soft text-success border border-success/20"
                : "bg-danger-soft text-danger border border-danger/20"
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Unternehmen werden verwendet, um Ausschreibungen zu bewerten und Empfehlungen zu erstellen.
        </p>
      </div>
    </div>
  );
}
