"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from "@mui/material";

const SOCIO_ECONOMIC_OPTIONS = [
  ["small_business", "Kleines Unternehmen (Small Business)"],
  ["wosb", "Frauenunternehmen (Women-Owned Small Business, WOSB)"],
  ["edwosb", "Wirtschaftlich benachteiligtes Frauenunternehmen (EDWOSB)"],
  ["sdvosb", "Unternehmen im Besitz dienstunfähiger Veteraninnen und Veteranen (SDVOSB)"],
  ["vosb", "Unternehmen im Besitz von Veteraninnen und Veteranen (VOSB)"],
  ["8a", "8(a)-Förderprogramm (Business Development)"],
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
      if (!response.ok || !result.id) throw new Error("Das Profil konnte nicht gespeichert werden.");
      window.localStorage.setItem("tenderhunter.usCompanyId", String(result.id));
      setSaved("Profil gespeichert. Tenderhunter verwendet es in diesem Browser für Passungs- und Bereitschaftsprüfungen.");
    } catch {
      setError("Das Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevation={0} sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 2.25, md: 3.5 } }}>
        <Stack spacing={2.5} component="form" onSubmit={save}>
          <Box>
            <Typography variant="overline" sx={{ color: "secondary.main", fontWeight: 800, letterSpacing: "0.12em" }}>Unternehmensprofil für den US-Markt</Typography>
            <Typography component="h1" sx={{ color: "text.primary", fontSize: { xs: "2rem", md: "2.8rem" }, fontWeight: 850, lineHeight: 1.05, letterSpacing: "-0.045em", mt: 0.5 }}>Passungsprüfungen auf Ihr Unternehmen abstimmen.</Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.7, mt: 1 }}>Hinterlegen Sie einmal Ihre fachlichen Leistungen und Angaben zur Teilnahmeberechtigung. Für ein direktes Angebot an US-Bundesbehörden benötigen Sie eine UEI und eine Registrierung bei SAM.gov. Gespräche mit Hauptauftragnehmern sind auch vorher möglich.</Typography>
          </Box>
          {saved && <Alert severity="success" action={<Button component={Link} href="/#us" color="inherit" size="small">Ausschreibungen ansehen</Button>}>{saved}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Firmenname" value={name} onChange={(event) => setName(event.target.value)} required fullWidth />
          <TextField label="Leistungen und Kompetenzen" value={capabilities} onChange={(event) => setCapabilities(event.target.value)} fullWidth multiline minRows={2} helperText="Trennen Sie die Angaben durch Kommas. Verwenden Sie möglichst Begriffe aus der Sprache der Ausschreibung, zum Beispiel: cloud migration, cybersecurity, data engineering." />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="NAICS-Codes" value={naicsCodes} onChange={(event) => setNaicsCodes(event.target.value)} fullWidth helperText="Sechsstellige Codes, durch Kommas getrennt." placeholder="541511, 541512" />
            <TextField label="PSC-Codes" value={pscCodes} onChange={(event) => setPscCodes(event.target.value)} fullWidth helperText="Zwei bis vier Zeichen, durch Kommas getrennt." placeholder="D302, D399" />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Unique Entity ID (UEI)" value={uei} onChange={(event) => setUei(event.target.value.toUpperCase())} fullWidth inputProps={{ maxLength: 12 }} helperText="Bis zum Abschluss der Registrierung bei SAM.gov optional." />
            <TextField label="CAGE-Code" value={cageCode} onChange={(event) => setCageCode(event.target.value.toUpperCase())} fullWidth inputProps={{ maxLength: 5 }} helperText="Bis zur Vergabe durch SAM.gov optional." />
          </Stack>
          <Box>
            <Typography fontWeight={800}>Sozioökonomische Förderkategorien</Typography>
            <FormGroup sx={{ mt: 0.5 }}>
              {SOCIO_ECONOMIC_OPTIONS.map(([value, label]) => <FormControlLabel key={value} control={<Checkbox checked={socioEconomic.includes(value)} onChange={() => toggleStatus(value)} />} label={label} />)}
            </FormGroup>
          </Box>
          <Button type="submit" variant="contained" color="primary" disabled={saving || !name.trim()} sx={{ alignSelf: "flex-start", px: 3 }}>{saving ? "Profil wird gespeichert" : "US-Profil speichern"}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
