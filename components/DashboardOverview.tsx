"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
} from "@mui/material";
import { LayoutGrid } from "lucide-react";
import { PaywallPanel } from "@/components/billing/PaywallPanel";

interface DashboardMetrics {
  tenders: number;
  companies: number;
  jobsOpen: number;
  insights: number;
  avgWinProbability: number;
  killSwitchCount: number;
  trackedWorkflow: {
    total: number;
    dueSoon: number;
    byStatus: { status: string; count: number }[];
  };
  sourceQuality: {
    byStatus: { status: string; count: number }[];
    bySource: { source: string; total: number; qualified: number }[];
  };
}

export function DashboardOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        if (res.status === 402) {
          setPaywall(true);
          return null;
        }
        return res.json();
      })
      .then((data) => setMetrics(data))
      .catch(console.error);
  }, []);

  if (paywall) {
    return <PaywallPanel feature="KI-Analyse" title="Die Übersicht freischalten" description="Deine Ausschreibungen bleiben frei. Billing schaltet Scoring, Empfehlungen und die Teamübersicht frei." />;
  }

  if (!metrics) return <Typography>Lade...</Typography>;

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h4" fontWeight={700}>Übersicht</Typography>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Tender</Typography>
            <Typography variant="h5">{metrics.tenders}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Verfolgt</Typography>
            <Typography variant="h5">{metrics.trackedWorkflow.total}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Fristen (7d)</Typography>
            <Typography variant="h5">{metrics.trackedWorkflow.dueSoon}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
