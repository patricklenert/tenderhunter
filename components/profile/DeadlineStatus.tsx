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
          bgcolor: "#f1f5f7",
          color: "#667288",
          border: "1px solid #dbe4ea",
          fontSize: "0.7rem",
          fontWeight: 650,
          "& .MuiChip-icon": { color: "#8190a0", ml: 0.7 },
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
          bgcolor: "#f3f4f6",
          color: "#7b8798",
          border: "1px solid #dce1e6",
          fontSize: "0.7rem",
          fontWeight: 650,
          "& .MuiChip-icon": { color: "#9aa5b1", ml: 0.7 },
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
        bgcolor: urgent ? "#fff4df" : "#eef4f7",
        color: urgent ? "#9a5a08" : "#526476",
        border: urgent ? "1px solid #f2d59d" : "1px solid #d8e4ea",
        fontSize: "0.7rem",
        fontWeight: 700,
        "& .MuiChip-icon": { color: urgent ? "#b8750b" : "#718296", ml: 0.7 },
      }}
    />
  );
}
