"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { DeepDiveResult } from "@/lib/small-vendor-deep-dive";

export interface DeepDiveState {
  status: "pending" | "running" | "ready" | "failed";
  model?: string | null;
  result?: DeepDiveResult | null;
  corpusStats?: Record<string, number> | null;
  error?: string | null;
  updatedAt?: string | null;
}

interface SmallVendorDeepDiveProps {
  tenderId: number;
  initial: DeepDiveState | null;
}

interface DeepDiveView {
  status: "none" | "pending" | "running" | "ready" | "failed";
  model: string | null;
  result: DeepDiveResult | null;
  error: string | null;
  updatedAt: string | null;
}

const buildView = (initial: DeepDiveState | null): DeepDiveView => ({
  status: initial?.status ?? "none",
  model: initial?.model ?? null,
  result: initial?.result ?? null,
  error: initial?.error ?? null,
  updatedAt: initial?.updatedAt ?? null,
});

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const blockHeadingSx = {
  color: "#2d3544",
  fontSize: "1rem",
  fontWeight: 700,
  mb: 0.75,
} as const;

const bodyTextSx = {
  color: "#38505b",
  fontSize: "0.9375rem",
  lineHeight: 1.65,
} as const;

function TextBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography component="h3" sx={blockHeadingSx}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ListBlock({ title, items, warn = false }: { title: string; items: string[]; warn?: boolean }) {
  const color = warn ? "#92400e" : "#38505b";
  return (
    <Box>
      <Typography component="h3" sx={blockHeadingSx}>
        {title}
      </Typography>
      <Box
        component="ul"
        sx={{
          m: 0,
          pl: 2.25,
          color,
          "& li + li": { mt: 0.75 },
          "& li::marker": { color },
        }}
      >
        {items.map((item, index) => (
          <li key={`${index}-${item.slice(0, 24)}`}>
            <Typography component="span" sx={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
              {item}
            </Typography>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export function SmallVendorDeepDive({ tenderId, initial }: SmallVendorDeepDiveProps) {
  const [view, setView] = useState<DeepDiveView>(() => buildView(initial));
  const [busy, setBusy] = useState(false);

  const isActive = view.status === "pending" || view.status === "running";
  const showIntro = view.status === "none"
    || view.status === "failed"
    || (view.status === "ready" && !view.result);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/tenders/deep-dive?tenderId=${tenderId}`, { cache: "no-store" });
          if (!response.ok) {
            if (cancelled) return;
            setView({
              status: "failed",
              model: null,
              result: null,
              error: "Der Status der Tiefenanalyse konnte nicht geladen werden.",
              updatedAt: null,
            });
            return;
          }
          const data = (await response.json()) as DeepDiveState | { tenderId: number; status: "none" };
          if (cancelled) return;
          if (data.status === "none") {
            setView(buildView(null));
            return;
          }
          setView({
            status: data.status,
            model: data.model ?? null,
            result: data.result ?? null,
            error: data.error ?? null,
            updatedAt: data.updatedAt ?? null,
          });
        } catch {
          // Transiente Netzwerkfehler: Polling läuft weiter.
        }
      })();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isActive, tenderId]);

  const startAnalysis = async (force: boolean): Promise<void> => {
    setBusy(true);
    try {
      const response = await fetch("/api/tenders/deep-dive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenderId, force }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setView({
          status: "failed",
          model: null,
          result: null,
          error: payload?.error ?? "Die Tiefenanalyse konnte nicht gestartet werden.",
          updatedAt: null,
        });
        return;
      }
      const payload = (await response.json().catch(() => null)) as { status?: string } | null;
      setView({
        status: payload?.status === "running" ? "running" : "pending",
        model: null,
        result: null,
        error: null,
        updatedAt: null,
      });
    } catch {
      setView({
        status: "failed",
        model: null,
        result: null,
        error: "Netzwerkfehler: Die Tiefenanalyse konnte nicht gestartet werden.",
        updatedAt: null,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStart = (): void => {
    void startAnalysis(false);
  };

  const handleRerun = (): void => {
    if (!window.confirm("Erneut analysieren und Dokumente neu laden?")) return;
    void startAnalysis(true);
  };

  const result = view.result;

  return (
    <Box
      component="section"
      aria-labelledby="deepdive-heading"
      sx={{
        mb: { xs: 4, md: 5 },
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: "#eef7f5",
        border: "1px solid #b8ddd4",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
        <Typography
          id="deepdive-heading"
          component="h2"
          sx={{
            color: "#163b4a",
            fontSize: { xs: "1.25rem", md: "1.375rem" },
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
          }}
        >
          KI-Tiefenanalyse
        </Typography>
        <Chip
          label="GLM"
          size="small"
          sx={{
            height: 22,
            bgcolor: "#0f766e",
            color: "#ffffff",
            fontWeight: 700,
            borderRadius: 1,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      </Stack>

      {showIntro && (
        <Box>
          <Typography sx={{ maxWidth: "72ch", color: "#38505b", lineHeight: 1.65 }}>
            Lädt fehlgeschlagene Dokumente neu, analysiert alle Unterlagen mit GLM und erklärt in einfacher Sprache,
            was der Auftraggeber will. Dauer 1–3 Minuten.
          </Typography>
          {view.error && (
            <Typography sx={{ mt: 1.25, color: "#b91c1c", fontWeight: 600 }}>
              Fehler: {view.error}
            </Typography>
          )}
          <Button
            variant="contained"
            disabled={busy}
            onClick={handleStart}
            sx={{ mt: 1.75, bgcolor: "#0f766e", "&:hover": { bgcolor: "#0d5f57" } }}
          >
            {view.status === "none" ? "Tiefenanalyse starten" : "Erneut versuchen"}
          </Button>
        </Box>
      )}

      {isActive && (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <CircularProgress size={18} sx={{ color: "#0f766e" }} />
          <Typography sx={{ color: "#38505b", lineHeight: 1.55 }}>
            Dokumente werden geladen und mit GLM analysiert … Dies kann 1–3 Minuten dauern.
          </Typography>
        </Stack>
      )}

      {view.status === "ready" && result && (
        <Stack spacing={2.25}>
          {result.zusammenfassung && (
            <Typography sx={{ color: "#163b4a", fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.5 }}>
              {result.zusammenfassung}
            </Typography>
          )}
          {result.zielAuftraggeber && (
            <TextBlock title="Was will der Auftraggeber?">
              <Typography sx={bodyTextSx}>{result.zielAuftraggeber}</Typography>
            </TextBlock>
          )}
          {result.wasWirdGekauft.length > 0 && (
            <ListBlock title="Was wird gekauft?" items={result.wasWirdGekauft} />
          )}
          {result.umfang && (
            <TextBlock title="Umfang">
              <Typography sx={bodyTextSx}>{result.umfang}</Typography>
            </TextBlock>
          )}
          {result.anforderungen.length > 0 && (
            <ListBlock title="Anforderungen" items={result.anforderungen} />
          )}
          {result.hindernisse.length > 0 && (
            <ListBlock title="Hürden für kleine Anbieter" items={result.hindernisse} warn />
          )}
          {(result.budgetLaufzeit || result.verfahrenFristen) && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
              {result.budgetLaufzeit && (
                <TextBlock title="Budget & Laufzeit">
                  <Typography sx={bodyTextSx}>{result.budgetLaufzeit}</Typography>
                </TextBlock>
              )}
              {result.verfahrenFristen && (
                <TextBlock title="Verfahren & Fristen">
                  <Typography sx={bodyTextSx}>{result.verfahrenFristen}</Typography>
                </TextBlock>
              )}
            </Box>
          )}
          {result.einschaetzung && (
            <TextBlock title="Einschätzung">
              <Typography sx={{ color: "#0f766e", fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.65 }}>
                {result.einschaetzung}
              </Typography>
            </TextBlock>
          )}
          {result.offenePunkte.length > 0 && (
            <ListBlock title="Offene Punkte" items={result.offenePunkte} />
          )}
          {result.quellen.length > 0 && (
            <Box>
              <Typography component="h3" sx={blockHeadingSx}>
                Quellen
              </Typography>
              <Stack spacing={0.25}>
                {result.quellen.map((quelle, index) => (
                  <Typography key={`${quelle.dokument}-${index}`} variant="caption" sx={{ color: "#667288" }}>
                    {quelle.dokument}
                    {quelle.seite ? ` (Seite ${quelle.seite})` : ""}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            sx={{ borderTop: "1px solid rgba(184, 221, 212, 0.7)", pt: 1.5 }}
          >
            <Typography variant="caption" sx={{ color: "#667288" }}>
              {[
                view.model ?? "",
                view.updatedAt ? `Analysiert am ${formatDateTime(view.updatedAt)}` : "",
              ].filter(Boolean).join(" · ")}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={handleRerun}
              sx={{ color: "#0f766e", borderColor: "#0f766e", "&:hover": { borderColor: "#0d5f57", bgcolor: "rgba(15, 118, 110, 0.04)" } }}
            >
              Neu analysieren
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
