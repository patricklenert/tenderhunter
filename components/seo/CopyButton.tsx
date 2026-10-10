"use client";

import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = "Kopieren" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Tooltip title={copied ? "Kopiert!" : label}>
      <IconButton
        size="small"
        onClick={handleCopy}
        aria-label={copied ? `${label}: kopiert` : label}
        sx={{
          bgcolor: copied ? "success.50" : "transparent",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {copied ? <Check size={15} color="#2e7d32" /> : <Copy size={15} color="#999" />}
      </IconButton>
    </Tooltip>
  );
}
