"use client";

import { useState } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import { FileText, ArrowUpRight, Share2, Check } from "lucide-react";
import { cleanPdfFilename } from "@/lib/date-utils";

interface PdfDocumentLinkProps {
  url: string;
  index: number;
}

export function PdfDocumentLink({ url, index }: PdfDocumentLinkProps) {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayName = cleanPdfFilename(url);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tenders/public/download?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Download fehlgeschlagen");
      setPublicUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <FileText size={18} color="#e9644d" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          component="a"
          href={url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          sx={{ textDecoration: "none", color: "text.primary", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {displayName}
          </Typography>
        </Box>
        {publicUrl && (
          <Typography variant="caption" color="success.main" sx={{ wordBreak: "break-all", display: "block", mt: 0.5 }}>
            {publicUrl}
          </Typography>
        )}
        {error && (
          <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
      {publicUrl ? (
        <Button
          size="small"
          variant="outlined"
          color="success"
          startIcon={copied ? <Check size={14} /> : <Share2 size={14} />}
          onClick={handleCopy}
          sx={{ flexShrink: 0, textTransform: "none" }}
        >
          {copied ? "Kopiert!" : "Link kopieren"}
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={loading ? <CircularProgress size={14} /> : <Share2 size={14} />}
          onClick={handleDownload}
          disabled={loading}
          sx={{ flexShrink: 0, textTransform: "none" }}
        >
          {loading ? "Lädt..." : "Teilen"}
        </Button>
      )}
    </Box>
  );
}
