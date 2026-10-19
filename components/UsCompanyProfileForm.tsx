"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from "@mui/material";

const SOCIO_ECONOMIC_OPTIONS = [
  ["small_business", "Small business"],
  ["wosb", "Women-Owned Small Business (WOSB)"],
  ["edwosb", "Economically Disadvantaged WOSB"],
  ["sdvosb", "Service-Disabled Veteran-Owned Small Business"],
  ["vosb", "Veteran-Owned Small Business"],
  ["8a", "8(a) Business Development"],
  ["hubzone", "HUBZone"],
] as const;

const splitValues = (value: string): string[] => value.split(",").map((item) => item.trim()).filter(Boolean);

export function UsCompanyProfileForm() {
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [naicsCodes, setNaicsCodes] = useState("");
  const [pscCodes, setPscCodes] = useState("");
  const [uei, setUei] = useState("");
  const [cageCode, setCageCode] = useState("");
  const [socioEconomic, setSocioEconomic] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = (status: string) => {
    setSocioEconomic((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/us/company-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          capabilities: splitValues(capabilities),
          certifications: [],
          regions: [],
          markets: ["US"],
          naics_codes: splitValues(naicsCodes),
          psc_codes: splitValues(pscCodes).map((code) => code.toUpperCase()),
          uei: uei.trim() || undefined,
          cage_code: cageCode.trim() || undefined,
          socio_economic: socioEconomic,
        }),
      });
      const result = await response.json() as { id?: number; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Your profile could not be saved.");
      window.localStorage.setItem("tenderhunter.usCompanyId", String(result.id));
      setSaved("Profile saved. Pursuit briefs will now use it for fit and readiness checks on this browser.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevation={0} sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 2.25, md: 3.5 } }}>
        <Stack spacing={2.5} component="form" onSubmit={save}>
          <Box>
            <Typography variant="overline" sx={{ color: "secondary.main", fontWeight: 800, letterSpacing: "0.12em" }}>U.S. pursuit profile</Typography>
            <Typography component="h1" sx={{ color: "text.primary", fontSize: { xs: "2rem", md: "2.8rem" }, fontWeight: 850, lineHeight: 1.05, letterSpacing: "-0.045em", mt: 0.5 }}>Make every pursuit brief specific to your LLC.</Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7, mt: 1 }}>Save your U.S. eligibility and technical fit once. A UEI is required for direct federal bidding; you can still use the profile for teaming before registration is complete.</Typography>
          </Box>
          {saved && <Alert severity="success" action={<Button component={Link} href="/#us" color="inherit" size="small">Browse opportunities</Button>}>{saved}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Company name" value={name} onChange={(event) => setName(event.target.value)} required fullWidth />
          <TextField label="Capabilities" value={capabilities} onChange={(event) => setCapabilities(event.target.value)} fullWidth multiline minRows={2} helperText="Separate capabilities with commas, for example: cloud migration, cybersecurity, data engineering." />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="NAICS codes" value={naicsCodes} onChange={(event) => setNaicsCodes(event.target.value)} fullWidth helperText="Six-digit codes, separated by commas." placeholder="541511, 541512" />
            <TextField label="PSC codes" value={pscCodes} onChange={(event) => setPscCodes(event.target.value)} fullWidth helperText="Two to four characters, separated by commas." placeholder="D302, D399" />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Unique Entity ID (UEI)" value={uei} onChange={(event) => setUei(event.target.value.toUpperCase())} fullWidth inputProps={{ maxLength: 12 }} helperText="Optional until you complete SAM.gov registration." />
            <TextField label="CAGE code" value={cageCode} onChange={(event) => setCageCode(event.target.value.toUpperCase())} fullWidth inputProps={{ maxLength: 5 }} helperText="Optional until assigned through SAM.gov." />
          </Stack>
          <Box>
            <Typography fontWeight={800}>Socio-economic eligibility</Typography>
            <FormGroup sx={{ mt: 0.5 }}>
              {SOCIO_ECONOMIC_OPTIONS.map(([value, label]) => <FormControlLabel key={value} control={<Checkbox checked={socioEconomic.includes(value)} onChange={() => toggleStatus(value)} />} label={label} />)}
            </FormGroup>
          </Box>
          <Button type="submit" variant="contained" color="primary" disabled={saving || !name.trim()} sx={{ alignSelf: "flex-start", px: 3 }}>{saving ? "Saving profile" : "Save U.S. profile"}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
