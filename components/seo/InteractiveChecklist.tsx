"use client";

import { useState } from "react";
import { Box, Stack, Typography, Chip, LinearProgress, IconButton, Tooltip } from "@mui/material";
import { CheckCircle2, Circle, Copy, Check, ListChecks } from "lucide-react";

interface InteractiveChecklistProps {
  title: string;
  items: string[];
}

export default function InteractiveChecklist({ title, items }: InteractiveChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const progress = items.length > 0 ? (checked.size / items.length) * 100 : 0;
  const allDone = checked.size === items.length;

  const copyAll = async () => {
    const text = `${title}\n\n${items.map((item, i) => `[${checked.has(i) ? "x" : " "}] ${item}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ListChecks size={20} color="#e9644d" />
          <Typography variant="h6" component="h2" fontWeight={700}>
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={`${checked.size}/${items.length}`}
            color={allDone ? "success" : "default"}
            variant={allDone ? "filled" : "outlined"}
            sx={{ fontWeight: 600, fontSize: "0.75rem" }}
          />
          <Tooltip title={copied ? "Kopiert!" : "Als Text kopieren"}>
            <IconButton
              size="small"
              onClick={copyAll}
              aria-label={copied ? "Checkliste kopiert" : "Checkliste als Text kopieren"}
              sx={{ bgcolor: copied ? "success.50" : "transparent" }}
            >
              {copied ? <Check size={16} color="#2e7d32" /> : <Copy size={16} color="#667288" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {checked.size > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mb: 2,
            height: 6,
            borderRadius: 3,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": {
              bgcolor: allDone ? "success.main" : "primary.main",
              borderRadius: 3,
            },
          }}
        />
      )}

      <Stack spacing={1}>
        {items.map((item, i) => {
          const isChecked = checked.has(i);
          return (
            <Stack
              key={i}
              direction="row"
              spacing={1.5}
              alignItems="flex-start"
              onClick={() => toggle(i)}
              sx={{
                cursor: "pointer",
                py: 1,
                px: 1.5,
                borderRadius: 1,
                transition: "background 0.15s",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {isChecked ? (
                <CheckCircle2 size={20} color="#2e7d32" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <Circle size={20} color="#bbb" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.7,
                  color: isChecked ? "text.disabled" : "text.secondary",
                  textDecoration: isChecked ? "line-through" : "none",
                  transition: "all 0.15s",
                }}
              >
                {item}
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      {allDone && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: "success.50", borderRadius: 1, textAlign: "center" }}>
          <Typography variant="body2" color="success.main" fontWeight={600}>
            Alle Punkte erledigt!
          </Typography>
        </Box>
      )}
    </Box>
  );
}
