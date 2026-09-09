import { Chip } from "@mui/material";
import { AlertTriangle, Clock3, HelpCircle, XCircle } from "lucide-react";
import { formatDeadlineDE, type DeadlineState } from "@/lib/date-utils";

interface DeadlineStatusProps {
  deadlineAt: string | null;
  deadlineDays: number | null;
  deadlineState: DeadlineState;
}

export function DeadlineStatus({ deadlineAt, deadlineDays, deadlineState }: DeadlineStatusProps) {
  const formatted = formatDeadlineDE(deadlineAt);
  const state = deadlineState;
  const dateLabel = formatted && deadlineAt ? <time dateTime={deadlineAt}>{formatted}</time> : null;

  if (state === "missing" || !dateLabel) {
    return (
      <Chip
        icon={<HelpCircle size={13} aria-hidden="true" />}
        label="Frist nicht angegeben"
        size="small"
        sx={{
          height: 26,
          borderRadius: 1,
          bgcolor: "background.default",
          color: "text.secondary",
          border: "1px solid",
          borderColor: "divider",
          fontSize: "0.7rem",
          fontWeight: 650,
          "& .MuiChip-icon": { color: "text.secondary", ml: 0.7 },
        }}
      />
    );
  }

  if (state === "expired") {
    return (
      <Chip
        icon={<XCircle size={13} aria-hidden="true" />}
        label={<span>Abgelaufen · {dateLabel}</span>}
        size="small"
        sx={{
          height: 26,
          borderRadius: 1,
          bgcolor: "background.default",
          color: "text.secondary",
          border: "1px solid",
          borderColor: "divider",
          fontSize: "0.7rem",
          fontWeight: 650,
          "& .MuiChip-icon": { color: "text.secondary", ml: 0.7 },
        }}
      />
    );
  }

  const urgent = deadlineDays !== null && deadlineDays <= 7;
  return (
    <Chip
      icon={urgent ? <AlertTriangle size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
      label={
        <span>
          {urgent
            ? `${deadlineDays === 0 ? "Heute" : deadlineDays === 1 ? "Morgen" : `Noch ${deadlineDays} Tage`} · `
            : "Frist "}
          {dateLabel}
        </span>
      }
      size="small"
      sx={{
        height: 26,
        borderRadius: 1,
        bgcolor: urgent ? "warning.light" : "background.paper",
        color: urgent ? "warning.main" : "text.secondary",
        border: "1px solid",
        borderColor: urgent ? "warning.light" : "divider",
        fontSize: "0.7rem",
        fontWeight: 700,
        "& .MuiChip-icon": { color: urgent ? "warning.main" : "text.secondary", ml: 0.7 },
      }}
    />
  );
}
