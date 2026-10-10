import type { ComponentType, ReactNode } from "react";
import { AlertCircle, FileSearch } from "lucide-react";
import { Box, CircularProgress, Paper, Skeleton, Stack, Typography } from "@mui/material";

type ResourceStateKind = "loading" | "error" | "empty";

type StateIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

interface ResourceStateProps {
  kind: ResourceStateKind;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: StateIcon;
  compact?: boolean;
}

const stateTone: Record<ResourceStateKind, { borderColor: string; iconColor: string; iconBackground: string }> = {
  loading: {
    borderColor: "divider",
    iconColor: "primary.main",
    iconBackground: "primary.light",
  },
  error: {
    borderColor: "error.main",
    iconColor: "error.main",
    iconBackground: "error.light",
  },
  empty: {
    borderColor: "divider",
    iconColor: "text.secondary",
    iconBackground: "action.hover",
  },
};

export function ResourceState({
  kind,
  title,
  description,
  action,
  secondaryAction,
  icon,
  compact = false,
}: ResourceStateProps) {
  const tone = stateTone[kind];
  const Icon = icon ?? (kind === "error" ? AlertCircle : FileSearch);
  const hasActions = Boolean(action || secondaryAction);

  return (
    <Paper
      variant="outlined"
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "empty" ? "polite" : undefined}
      sx={{
        borderRadius: 2,
        borderColor: tone.borderColor,
        bgcolor: "background.paper",
        p: compact ? 1.5 : { xs: 2.5, sm: 4 },
        textAlign: compact ? "left" : "center",
      }}
    >
      <Stack
        direction={compact ? "row" : "column"}
        spacing={compact ? 1.25 : 1.5}
        alignItems="center"
        justifyContent="center"
      >
        <Box
          aria-hidden={true}
          sx={{
            width: compact ? 32 : 44,
            height: compact ? 32 : 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: tone.iconColor,
            bgcolor: tone.iconBackground,
          }}
        >
          {kind === "loading" ? <CircularProgress size={compact ? 17 : 22} color="primary" /> : <Icon size={compact ? 18 : 22} strokeWidth={2} aria-hidden={true} />}
        </Box>

        <Box sx={{ minWidth: 0, flex: compact ? 1 : undefined }}>
          <Typography variant={compact ? "body2" : "h6"} component="p" fontWeight={700}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: compact ? 0.25 : 0.75, lineHeight: 1.6 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      {kind === "loading" && !compact ? (
        <Stack spacing={0.75} sx={{ width: "100%", maxWidth: 420, mx: "auto", mt: 2 }} aria-hidden="true">
          <Skeleton variant="rounded" height={10} width="92%" />
          <Skeleton variant="rounded" height={10} width="76%" />
          <Skeleton variant="rounded" height={10} width="84%" />
        </Stack>
      ) : null}

      {hasActions ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="center"
          alignItems="stretch"
          sx={{ mt: compact ? 1.25 : 2.5 }}
        >
          {action}
          {secondaryAction}
        </Stack>
      ) : null}
    </Paper>
  );
}
