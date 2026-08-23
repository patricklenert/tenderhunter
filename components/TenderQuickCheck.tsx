"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, CircleHelp, ExternalLink, ListChecks } from "lucide-react";
import type { TenderCheck, TenderCheckSource } from "@/lib/tender-check";

interface TenderQuickCheckProps {
  tenderId: number;
  initialCheck?: TenderCheck | null;
}

type StateMap = Record<string, boolean>;

const localStateKey = (tenderId: number): string => `tender-check-state:${tenderId}`;

const readLocalState = (tenderId: number): StateMap => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localStateKey(tenderId)) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const state: StateMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
};

const writeLocalState = (tenderId: number, states: StateMap): void => {
  try {
    window.localStorage.setItem(localStateKey(tenderId), JSON.stringify(states));
  } catch {
    // Local storage can be disabled by privacy settings; the in-memory state still works.
  }
};

const formatEventDate = (value: string, precision: "date" | "minute"): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Termin nicht lesbar";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    ...(precision === "minute" ? { timeStyle: "short" } : {}),
  }).format(date);
};

const sourceLabel = (source: TenderCheckSource): string => {
  if (source.type === "tender") return "Ausschreibungsdaten";
  return `${source.filename || "Dokument"}${source.page ? ` · Seite ${source.page}` : ""}`;
};

const sourceHref = (source: TenderCheckSource): string | null => {
  if (source.type !== "document" || !source.documentId || !source.available) return null;
  return `/api/tenders/public/download?documentId=${source.documentId}${source.page ? `#page=${source.page}` : ""}`;
};

function SourceBlock({ source }: { source: TenderCheckSource | null }) {
  if (!source) {
    return <Typography variant="caption" color="text.secondary">Quelle konnte nicht eindeutig zugeordnet werden.</Typography>;
  }

  const href = sourceHref(source);
  return (
    <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
        {sourceLabel(source)}
      </Typography>
      {source.quote ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.5 }}>
          „{source.quote}”
        </Typography>
      ) : null}
      {href ? (
        <Button
          component="a"
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          size="small"
          startIcon={<ExternalLink size={13} />}
          sx={{ mt: 0.5, px: 0, minWidth: 0, textTransform: "none" }}
        >
          Quelle öffnen
        </Button>
      ) : source.type === "document" ? (
        <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
          Quelle derzeit nicht verfügbar
        </Typography>
      ) : null}
    </Box>
  );
}

export function TenderQuickCheck({ tenderId, initialCheck = null }: TenderQuickCheckProps) {
  const [check, setCheck] = useState<TenderCheck | null>(initialCheck);
  const [loading, setLoading] = useState(!initialCheck);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<StateMap>(() => readLocalState(tenderId));

  useEffect(() => {
    let cancelled = false;
    if (!initialCheck) {
      void fetch("/api/tenders/public/detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenderId }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Schnellcheck konnte nicht geladen werden.");
          return response.json() as Promise<{ documentCheck?: TenderCheck }>;
        })
        .then((payload) => {
          if (!cancelled) setCheck(payload.documentCheck ?? null);
        })
        .catch((cause) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Schnellcheck konnte nicht geladen werden.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    void fetch(`/api/tenders/check-state?tenderId=${tenderId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ states?: StateMap }>;
      })
      .then((payload) => {
        if (!cancelled && payload?.states) setStates((current) => ({ ...current, ...payload.states }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [initialCheck, tenderId]);

  const toggleItem = (key: string, done: boolean): void => {
    const next = { ...states, [key]: done };
    setStates(next);
    writeLocalState(tenderId, next);
    void fetch("/api/tenders/check-state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tender_id: tenderId, item_key: key, done }),
    }).catch(() => undefined);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1, bgcolor: "#f7fafb" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Schnellcheck wird geladen.</Typography>
        </Stack>
      </Box>
    );
  }

  if (!check) {
    return error ? <Alert severity="info">{error} Die Dokumente können weiterhin geöffnet werden.</Alert> : null;
  }

  const openItems = check.checklist.filter((item) => !states[item.key]).length;
  const firstRiskIsImportant = check.risks.some((risk) => risk.severity === "important");
  const calendarHref = `/api/tenders/public/calendar?tenderId=${tenderId}`;

  return (
    <Box component="section" aria-labelledby={`tender-check-${tenderId}`} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1, bgcolor: "#f0f6f8" }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography id={`tender-check-${tenderId}`} component="h2" sx={{ color: "#163b4a", fontSize: "1.2rem", fontWeight: 700 }}>
            Schnellcheck
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "#38505b", lineHeight: 1.55 }}>
            In kurzer Zeit sehen, was fehlt, was auffällt und bis wann du handeln musst.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(255,255,255,0.8)" }}>
            <Typography variant="caption" fontWeight={700}>{openItems} Punkte offen</Typography>
          </Box>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(255,255,255,0.8)" }}>
            <Typography variant="caption" fontWeight={700}>{check.risks.length} Hinweise prüfen</Typography>
          </Box>
          <Box sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(255,255,255,0.8)" }}>
            <Typography variant="caption" fontWeight={700}>
              {check.nextEvent ? `Nächster Termin: ${formatEventDate(check.nextEvent.startsAt, check.nextEvent.datePrecision)}` : "Keine Frist erkannt"}
            </Typography>
          </Box>
        </Stack>

        {check.limitations.length > 0 ? (
          <Alert severity="info" sx={{ bgcolor: "rgba(255,255,255,0.75)" }}>
            {check.limitations.join(" ")} Aussagen bitte im Original prüfen.
          </Alert>
        ) : null}

        <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ChevronDown size={18} />} sx={{ px: 0, minHeight: 42, "& .MuiAccordionSummary-content": { my: 1 } }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListChecks size={18} />
              <Typography fontWeight={700}>Was muss ich einreichen?</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            {check.checklist.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Keine konkreten Anforderungen erkannt. Bitte prüfe die Originalunterlagen.</Typography>
            ) : (
              <Stack spacing={1}>
                {check.checklist.map((item) => (
                  <Box key={item.key} sx={{ p: 1.25, borderRadius: 0.5, bgcolor: "rgba(255,255,255,0.8)" }}>
                    <FormControlLabel
                      control={<Checkbox checked={Boolean(states[item.key])} onChange={(event) => toggleItem(item.key, event.target.checked)} size="small" />}
                      label={<Typography variant="body2" fontWeight={600} sx={{ textDecoration: states[item.key] ? "line-through" : "none" }}>{item.title}</Typography>}
                    />
                    {item.mandatory ? <Typography variant="caption" color="warning.dark" sx={{ display: "block", ml: 4.25 }}>Pflichtpunkt</Typography> : null}
                    {item.certainty !== "confirmed" ? <Typography variant="caption" color="warning.dark" sx={{ display: "block", ml: 4.25, mt: 0.25 }}>Bitte im Original prüfen</Typography> : null}
                    <Box sx={{ ml: { xs: 0, sm: 4.25 } }}><SourceBlock source={item.source} /></Box>
                  </Box>
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded={firstRiskIsImportant} disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ChevronDown size={18} />} sx={{ px: 0, minHeight: 42, "& .MuiAccordionSummary-content": { my: 1 } }}>
            <Stack direction="row" spacing={1} alignItems="center">
              {check.risks.length > 0 ? <AlertTriangle size={18} color="#a16207" /> : <CircleHelp size={18} />}
              <Typography fontWeight={700}>Was könnte problematisch sein?</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            {check.risks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Keine sichere Abweichung in den verfügbaren Unterlagen gefunden.</Typography>
            ) : (
              <Stack spacing={1}>
                {check.risks.map((risk) => (
                  <Box key={risk.key} sx={{ p: 1.25, borderRadius: 0.5, bgcolor: "rgba(255,255,255,0.8)" }}>
                    <Typography variant="body2" fontWeight={700}>{risk.severity === "important" ? "Wichtig: " : "Bitte prüfen: "}{risk.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.55 }}>{risk.explanation}</Typography>
                    {risk.sources.map((source, index) => <SourceBlock key={`${risk.key}-${index}`} source={source} />)}
                  </Box>
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ChevronDown size={18} />} sx={{ px: 0, minHeight: 42, "& .MuiAccordionSummary-content": { my: 1 } }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarDays size={18} />
              <Typography fontWeight={700}>Welche Fristen gelten?</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            {check.events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Keine Frist sicher erkannt. Bitte prüfe die Originalunterlagen.</Typography>
            ) : (
              <Stack spacing={1}>
                {check.events.map((event) => (
                  <Box key={event.key} sx={{ p: 1.25, borderRadius: 0.5, bgcolor: "rgba(255,255,255,0.8)" }}>
                    <Typography variant="body2" fontWeight={700}>{event.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{formatEventDate(event.startsAt, event.datePrecision)}</Typography>
                    <SourceBlock source={event.source} />
                  </Box>
                ))}
                <Button component="a" href={calendarHref} download variant="outlined" startIcon={<CalendarDays size={16} />} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                  {check.events.length > 1 ? "Alle Termine speichern" : "In Kalender speichern"}
                </Button>
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        {check.checklist.length > 0 && openItems === 0 ? (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CheckCircle2 size={16} color="#277544" />
            <Typography variant="caption" color="success.dark">Alle sichtbaren Punkte als erledigt markiert.</Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
