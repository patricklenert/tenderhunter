"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import { Building2, Check, Globe, Plus } from "lucide-react";

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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (companies.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <Building2 size={40} strokeWidth={1.5} style={{ opacity: 0.4 }} />
        <Typography variant="h6" fontWeight={600} sx={{ mt: 2 }}>
          Kein Unternehmensprofil gefunden
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Führen Sie zuerst eine Analyse durch, um Ihr Unternehmen anzulegen.
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={onNewAnalysis}>
          Neue Analyse starten
        </Button>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em" color="text.secondary">
          Unternehmensprofil auswählen
        </Typography>
        <Button size="small" startIcon={<Plus size={14} />} onClick={onNewAnalysis} sx={{ textTransform: "none", fontSize: "0.75rem" }}>
          Neu
        </Button>
      </Box>
      {companies.map((company) => {
        const isActive = company.isActive || company.id === activeCompanyId;
        return (
          <Paper
            key={company.id}
            variant="outlined"
            onClick={() => handleSetActive(company)}
            sx={{
              p: 2,
              borderRadius: 2,
              cursor: "pointer",
              borderColor: isActive ? "primary.main" : "divider",
              borderWidth: isActive ? 2 : 1,
              bgcolor: isActive ? "action.hover" : "transparent",
              transition: "all 0.15s",
              "&:hover": isActive ? {} : { borderColor: "text.secondary", bgcolor: "action.hover" },
              position: "relative",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {company.logoUrl ? (
                <Box
                  component="img"
                  src={company.logoUrl}
                  alt={company.companyName}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    objectFit: "contain",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    p: 0.5,
                  }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    bgcolor: "action.selected",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2 size={18} color="text.secondary" />
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {company.label}
                  </Typography>
                  {isActive && (
                    <Chip label="Aktiv" size="small" color="primary" variant="filled" sx={{ height: 20, fontSize: "0.65rem" }} />
                  )}
                </Box>
                {company.websiteUrl && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                    <Globe size={12} color="text.secondary" />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {company.websiteUrl.replace(/^https?:\/\//, "")}
                    </Typography>
                  </Box>
                )}
              </Box>
              {switching === company.id && <CircularProgress size={18} />}
              {isActive && switching !== company.id && <Check size={18} color="primary" />}
            </Box>
            {company.capabilities.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {company.capabilities.slice(0, 4).map((cap) => (
                  <Chip key={cap} label={cap} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                ))}
                {company.capabilities.length > 4 && (
                  <Chip label={`+${company.capabilities.length - 4}`} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                )}
              </Box>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
