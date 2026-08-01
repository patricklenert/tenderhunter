"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Skeleton,
  Typography,
} from "@mui/material";
import { Check, Globe, Plus } from "lucide-react";

export interface UserCompany {
  id: number;
  companyId: number;
  isActive: boolean;
  label: string;
  companyName: string;
  websiteUrl: string | null;
  description: string | null;
  industry: string | null;
  logoUrl: string | null;
  teamSize: number | null;
  capabilities: string[];
  certifications: string[];
  regions: string[];
  createdAt: string;
}

interface CompanySelectorProps {
  onSelect: (company: UserCompany) => void;
  onNewAnalysis: () => void;
  activeCompanyId?: number | null;
}

export function CompanySelector({ onSelect, onNewAnalysis, activeCompanyId }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<number | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/user/companies");
      const data = await res.json();
      if (data.companies) {
        setCompanies(data.companies);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSetActive = async (company: UserCompany) => {
    setSwitching(company.id);
    try {
      if (!company.isActive) {
        await fetch(`/api/user/companies/${company.id}/active`, { method: "PUT" });
        setCompanies((prev) =>
          prev.map((c) => ({ ...c, isActive: c.id === company.id }))
        );
      }
      onSelect(company);
    } catch {
      // ignore
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Paper
      component="section"
      aria-labelledby="company-selector-title"
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        height: "100%",
        p: { xs: 2, sm: 3 },
        borderRadius: 1.5,
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="company-selector-title"
            component="h2"
            fontWeight={600}
            sx={{
              fontSize: { xs: "1.25rem", lg: "1.05rem" },
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              whiteSpace: { lg: "nowrap" },
            }}
          >
            Vorhandenes Unternehmensprofil auswählen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>
            Nutzen Sie ein gespeichertes Profil für Ihre Vorschau.
          </Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<Plus size={15} aria-hidden="true" />} onClick={onNewAnalysis} sx={{ minHeight: 36, px: 1.25 }}>
          Neues Profil
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "grid", gap: 1, pt: 0.5 }} aria-label="Unternehmensprofile werden geladen">
          {[0, 1, 2].map((index) => <Skeleton key={index} variant="rounded" height={104} animation="wave" />)}
        </Box>
      ) : companies.length === 0 ? (
        <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper" }}>
          <Typography variant="body2" fontWeight={600}>
            Noch kein Unternehmensprofil vorhanden
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.55 }}>
            Analysieren Sie Ihre Website, um ein Unternehmensprofil anzulegen.
          </Typography>
          <Button variant="outlined" size="small" startIcon={<Plus size={15} aria-hidden="true" />} onClick={onNewAnalysis} sx={{ mt: 1.5 }}>
            Neues Profil anlegen
          </Button>
        </Box>
      ) : (
        <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
          {companies.map((company, index) => {
            const isActive = company.isActive || company.id === activeCompanyId;
            const initials = (company.label || company.companyName)
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
            const visibleCapabilities = company.capabilities.slice(0, 3);
            const remainingCapabilities = company.capabilities.length - visibleCapabilities.length;

            return (
              <ListItem key={company.id} disablePadding divider={index < companies.length - 1}>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleSetActive(company)}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${company.label || company.companyName} für die Vorschau verwenden`}
                  sx={{
                    alignItems: "flex-start",
                    gap: 1.5,
                    px: 1.75,
                    py: 1.75,
                    border: "1px solid transparent",
                    borderRadius: 1,
                    transition: "background-color 180ms ease-out, border-color 180ms ease-out",
                    "&.Mui-selected": {
                      bgcolor: "rgba(233, 100, 77, 0.06)",
                      borderColor: "primary.main",
                      "&:hover": { bgcolor: "rgba(233, 100, 77, 0.08)" },
                    },
                    "&:not(.Mui-selected):hover": { bgcolor: "action.hover" },
                    "&.Mui-focusVisible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: -2,
                    },
                  }}
                >
                  {company.logoUrl ? (
                    <Box
                      component="img"
                      src={company.logoUrl}
                      alt=""
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        objectFit: "contain",
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        p: 0.5,
                        flexShrink: 0,
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: "action.selected", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">{initials || "U"}</Typography>
                    </Box>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.95rem", lineHeight: 1.35, overflowWrap: "anywhere" }}>
                        {company.label || company.companyName}
                      </Typography>
                      {switching === company.id ? <CircularProgress size={17} aria-label="Profil wird ausgewählt" /> : isActive ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", flexShrink: 0, pt: 0.125 }}>
                          <Box sx={{ width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid", borderColor: "primary.main", bgcolor: "rgba(233, 100, 77, 0.06)", color: "primary.dark" }}>
                            <Check size={13} aria-hidden="true" />
                          </Box>
                          <Typography variant="caption" fontWeight={600}>Ausgewählt</Typography>
                        </Box>
                      ) : null}
                    </Box>
                    {company.websiteUrl && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, minWidth: 0 }}>
                        <Globe size={13} aria-hidden="true" color="currentColor" />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {company.websiteUrl.replace(/^https?:\/\//, "")}
                        </Typography>
                      </Box>
                    )}
                    {visibleCapabilities.length > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 0.9, fontSize: "0.8125rem", lineHeight: 1.5 }}>
                        Leistungen: {visibleCapabilities.join(", ")}{remainingCapabilities > 0 ? ` und ${remainingCapabilities} weitere` : ""}
                      </Typography>
                    )}
                  </Box>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
