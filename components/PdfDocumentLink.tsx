"use client";

import { useState } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import { FileText, ArrowUpRight, Share2, Check } from "lucide-react";
import { cleanPdfFilename } from "@/lib/date-utils";
import { ROLE_LABELS_DE } from "@/lib/document-classifier";

interface PdfDocumentLinkProps {
  url?: string | null;
  documentId?: number | null;
  tenderId?: number;
  index: number;
  label?: string | null;
  filename?: string | null;
  roles?: string[];
  status?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  discovered: "Entdeckt",
  downloading: "Wird geladen",
  downloaded: "Gespeichert",
  parsed: "Analysiert",
  failed: "Blockiert / fehlgeschlagen",
  blocked: "Zugriff blockiert",
  skipped: "Übersprungen",
  unknown: "Status unbekannt",
};

export function PdfDocumentLink({ url, documentId, tenderId, index, label, filename, roles = [], status }: PdfDocumentLinkProps) {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isStoredDocument = typeof documentId === "number" && Number.isSafeInteger(documentId) && documentId > 0;
  const displayName = filename || label || (url ? cleanPdfFilename(url) : `Dokument ${index + 1}`);
  const documentUrl = isStoredDocument ? `/api/tenders/public/download?documentId=${documentId}` : null;
  const isUnavailable = status === "failed" || status === "blocked";
  const openUrl = documentUrl || (isUnavailable ? null : url);

  const handleDownload = async () => {
    if (!url || !tenderId) {
      setError("Für dieses Dokument ist kein sicherer Tender-Bezug vorhanden.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ url, tenderId: String(tenderId) });
      const resp = await fetch(`/api/tenders/public/download?${params.toString()}`);
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
        {openUrl ? (
          <Box
            component="a"
            href={openUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            sx={{ textDecoration: "none", color: "text.primary", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {displayName}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {displayName}
          </Typography>
        )}
        {(roles.length > 0 || status) && (
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.25 }}>
            {[...roles.map((role) => ROLE_LABELS_DE[role] ?? role), status ? STATUS_LABELS[status] ?? status : ""].filter(Boolean).join(" · ")}
          </Typography>
        )}
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
      ) : isStoredDocument ? (
        <Button
          component="a"
          href={documentUrl ?? undefined}
          target="_blank"
          rel="nofollow noopener noreferrer"
          download
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<ArrowUpRight size={14} />}
          disabled={isUnavailable}
          sx={{ flexShrink: 0, textTransform: "none" }}
        >
          {isUnavailable ? "Nicht verfügbar" : "Herunterladen"}
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={loading ? <CircularProgress size={14} /> : <Share2 size={14} />}
          onClick={handleDownload}
          disabled={loading || isUnavailable || !tenderId || !url}
          sx={{ flexShrink: 0, textTransform: "none" }}
        >
          {loading ? "Lädt..." : tenderId && url ? "Teilen" : "Nur Quelle"}
        </Button>
      )}
    </Box>
  );
}
