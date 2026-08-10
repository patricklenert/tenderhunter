"use client";

import { Box, Typography, Button } from "@mui/material";
import { FileText, ArrowUpRight } from "lucide-react";
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
  variant?: "default" | "detail";
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

export function PdfDocumentLink({ url, documentId, tenderId, index, label, filename, roles = [], status, variant = "default" }: PdfDocumentLinkProps) {
  const isStoredDocument = typeof documentId === "number" && Number.isSafeInteger(documentId) && documentId > 0;
  const displayName = filename || label || (url ? cleanPdfFilename(url) : `Dokument ${index + 1}`);
  const documentUrl = isStoredDocument ? `/api/tenders/public/download?documentId=${documentId}` : null;
  const legacyDocumentUrl = !isStoredDocument && url && tenderId
    ? `/api/tenders/public/download?${new URLSearchParams({ url, tenderId: String(tenderId) }).toString()}`
    : null;
  const isUnavailable = status === "failed" || status === "blocked";
  const openUrl = isUnavailable ? null : documentUrl ?? legacyDocumentUrl;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1.5,
        border: variant === "detail" ? 0 : 1,
        borderColor: "divider",
        borderRadius: variant === "detail" ? 0 : 1,
        bgcolor: variant === "detail" ? "transparent" : undefined,
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
      </Box>
      {isStoredDocument ? (
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
      ) : legacyDocumentUrl ? (
        <Button
          component="a"
          href={legacyDocumentUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<ArrowUpRight size={14} />}
          disabled={isUnavailable}
          sx={{ flexShrink: 0, textTransform: "none" }}
        >
          Herunterladen
        </Button>
      ) : null}
    </Box>
  );
}
