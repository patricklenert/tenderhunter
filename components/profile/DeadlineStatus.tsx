import { Box, Typography } from "@mui/material";
import { Clock, AlertTriangle, XCircle } from "lucide-react";
import { formatDeadlineDE, daysUntil } from "@/lib/date-utils";

interface DeadlineStatusProps {
  deadline: string | null;
}

export function DeadlineStatus({ deadline }: DeadlineStatusProps) {
  if (!deadline) return null;
  const formatted = formatDeadlineDE(deadline);
  if (!formatted) return null;

  const days = daysUntil(deadline);

  if (days === null) return null;

  if (days < 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <XCircle size={13} color="#b91c1c" />
        <Typography variant="caption" sx={{ color: "#b91c1c", fontWeight: 500, fontSize: "0.75rem" }}>
          Abgelaufen
        </Typography>
      </Box>
    );
  }

  if (days <= 7) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <AlertTriangle size={13} color="#b45309" />
        <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 500, fontSize: "0.75rem" }}>
          {days === 0 ? "Heute" : days === 1 ? "Morgen" : `Noch ${days} Tage`}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Clock size={13} color="#64748b" />
      <Typography variant="caption" sx={{ color: "#475569", fontWeight: 500, fontSize: "0.75rem" }}>
        {formatted}
      </Typography>
    </Box>
  );
}
