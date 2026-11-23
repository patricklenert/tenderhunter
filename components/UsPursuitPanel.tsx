"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { CheckCircle2, CircleAlert, ExternalLink, UsersRound } from "lucide-react";
import { PaywallPanel } from "@/components/billing/PaywallPanel";
import { getFitScoreTier } from "@/lib/fit-score";

interface PursuitData {
  directBidReady: boolean;
  teamingGuidance: string;
  fit: { score: number; reasons: string[] } | null;
  checklist: Array<{ id: string; label: string; status: "complete" | "action_required" | "not_applicable"; detail: string }>;
  primeContractors: Array<{ name: string; agency: string | null; amount: number | null; description: string | null; usaspendingUrl: string | null }>;
  teamingResources: Array<{ title: string; organization: string; url: string; detail: string }>;
}

interface CompanyProfileOption {
  id: number;
  name: string;
  marketsJson: unknown;
}

const US_PROFILE_KEY = "tenderhunter.usCompanyId";
const FIT_LABELS = { high: "Stark", medium: "Solide", low: "Offen" } as const;

export function UsPursuitPanel({ tenderId }: { tenderId: number }) {
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<PursuitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfileOption[]>([]);

  const load = async (selectedCompanyId = companyId) => {
    setLoading(true);
    setError(null);
    setPaywall(false);
    try {
      const params = selectedCompanyId ? `?companyId=${encodeURIComponent(selectedCompanyId)}` : "";
      const response = await fetch(`/api/us/tenders/${tenderId}/pursuit${params}`);
      const payload = await response.json().catch(() => null) as PursuitData | { error?: string } | null;
      if (response.status === 401 || response.status === 402) {
        setData(null);
        setPaywall(true);
        return;
      }
      if (!response.ok) throw new Error("Der Passungsbrief konnte nicht geladen werden.");
      setData(payload as PursuitData);
    } catch {
      setError("Der Passungsbrief konnte nicht geladen werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedCompanyId = window.localStorage.getItem(US_PROFILE_KEY) ?? "";
    setCompanyId(savedCompanyId);
    void load(savedCompanyId);
    void fetch("/api/us/company-profiles")
      .then(async (response) => response.ok ? response.json() as Promise<{ items?: CompanyProfileOption[] }> : { items: [] })
      .then((payload) => setProfiles((payload.items ?? []).filter((profile) => Array.isArray(profile.marketsJson) && profile.marketsJson.includes("US"))))
      .catch(() => setProfiles([]));
  }, []); // Initial brief does not require a company profile.

  const selectCompany = (value: string) => {
    setCompanyId(value);
    if (value) window.localStorage.setItem(US_PROFILE_KEY, value);
    else window.localStorage.removeItem(US_PROFILE_KEY);
  };

  return (
    <Stack spacing={2}>
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper", borderRadius: 2 }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: "secondary.main", fontWeight: 800 }}>Passung und nächste Schritte</Typography>
          <Typography variant="h6" fontWeight={800} sx={{ color: "text.primary", mt: 0.5 }}>Prüfen Sie zuerst die Voraussetzungen und sprechen Sie passende Hauptauftragnehmer an.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <TextField select label="Unternehmensprofil" size="small" value={companyId} onChange={(event) => selectCompany(event.target.value)} helperText="Berücksichtigt hinterlegte NAICS-, UEI- und Förderstatusdaten." sx={{ minWidth: { sm: 260 } }}>
              <MenuItem value="">Kein Profil ausgewählt</MenuItem>
              {profiles.map((profile) => <MenuItem key={profile.id} value={String(profile.id)}>{profile.name}</MenuItem>)}
            </TextField>
            <Button component={Link} href="/us/profile" variant="outlined" color="secondary" sx={{ alignSelf: { sm: "flex-start" } }}>US-Profil anlegen</Button>
            <Button variant="contained" onClick={() => void load()} disabled={loading} sx={{ alignSelf: { sm: "flex-start" } }}>Passung aktualisieren</Button>
          </Stack>
        </CardContent>
      </Card>
      {loading && <Box role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 4 }}><CircularProgress size={22} aria-hidden="true" /><Typography color="text.secondary">Passung wird ermittelt …</Typography></Box>}
      {paywall && <PaywallPanel feature="US-Passungsbrief" title="Passungsbrief für US-Ausschreibungen freischalten" description="Die Ausschreibung und ihre Kerndaten bleiben frei. Im Abo erhalten Sie den Bereitschaftscheck, Hinweise zu Hauptauftragnehmern und nächste Schritte." />}
      {error && !paywall && <Alert severity="error">{error}</Alert>}
      {data && !loading && <>
        {data.fit && <Alert severity={data.directBidReady ? "success" : "warning"}><Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>Passung: {data.fit.score}/100 · {FIT_LABELS[getFitScoreTier(data.fit.score)]}.</Box>{" "}{data.fit.reasons[0]}</Alert>}
        {!data.fit && <Alert severity="info">Wählen Sie ein US-Unternehmensprofil, damit Tenderhunter die NAICS-Codes und Förderberechtigung abgleichen kann. Solange keine UEI hinterlegt ist, kommen Gespräche mit Hauptauftragnehmern statt einer direkten Angebotsabgabe infrage.</Alert>}
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>Angebots- und Registrierungscheckliste</Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {data.checklist.map((item) => <Box key={item.id} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                <Box component="span" aria-hidden="true" sx={{ display: "flex", flexShrink: 0, mt: "2px", color: item.status === "complete" ? "success.main" : item.status === "not_applicable" ? "text.secondary" : "warning.main" }}>
                  {item.status === "complete" ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
                </Box>
                <Box><Typography fontWeight={700}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{item.detail}</Typography></Box>
              </Box>)}
            </Stack>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center"><Box component="span" aria-hidden="true" sx={{ display: "flex", color: "secondary.main" }}><UsersRound size={21} /></Box><Typography variant="h6" fontWeight={800}>Mögliche Hauptauftragnehmer</Typography></Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{data.teamingGuidance}</Typography>
            <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
              {data.primeContractors.length === 0 ? <Typography variant="body2" color="text.secondary">Aktuell liegen keine vergleichbaren Zuschläge vor. Versuchen Sie es später erneut oder ergänzen Sie weitere NAICS-Codes im Profil.</Typography> : data.primeContractors.map((prime) => <Box key={prime.name} sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={750}>{prime.name}</Typography>{prime.usaspendingUrl && <Button size="small" href={prime.usaspendingUrl} target="_blank" rel="noreferrer" endIcon={<ExternalLink size={14} />}>Zuschlag ansehen</Button>}</Stack>
                <Typography variant="body2" color="text.secondary">{[prime.agency, prime.amount ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 0 }).format(prime.amount) : null].filter(Boolean).join(" · ")}</Typography>
              </Box>)}
            </Stack>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>Offizielle Verzeichnisse für Kooperationen</Typography>
            <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
              {data.teamingResources.map((resource) => <Box key={resource.url} sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={750}>{resource.title}</Typography><Button size="small" href={resource.url} target="_blank" rel="noreferrer" endIcon={<ExternalLink size={14} />}>Verzeichnis öffnen</Button></Stack>
                <Typography variant="body2" color="text.secondary">{`${resource.organization} · ${resource.detail}`}</Typography>
              </Box>)}
            </Stack>
          </CardContent>
        </Card>
      </>}
    </Stack>
  );
}
