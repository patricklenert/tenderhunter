"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Box, Card, CardContent, Link, Typography } from "@mui/material";

interface TenderItem {
  id: number;
  source: string;
  url: string;
  title: string | null;
  external_id: string | null;
  created_at: string;
}

export function TendersSection() {
  const [tenders, setTenders] = useState<TenderItem[]>([]);

  useEffect(() => {
    fetch("/api/tenders?limit=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((payload) => {
        if (!Array.isArray(payload.items)) { setTenders([]); return; }
        const items: TenderItem[] = [];
        for (const item of payload.items) {
          if (typeof item.id !== "number") continue;
          items.push({
            id: item.id,
            source: typeof item.source === "string" ? item.source : "",
            url: typeof item.url === "string" ? item.url : "",
            title: typeof item.title === "string" ? item.title : null,
            external_id: typeof item.external_id === "string" ? item.external_id : null,
            created_at: typeof item.created_at === "string" ? item.created_at : "",
          });
        }
        setTenders(items);
      })
      .catch(() => setTenders([]));
  }, []);

  if (tenders.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
            <FileText size={32} color="currentColor" style={{ opacity: 0.5 }} />
          </Box>
          <Typography variant="body2" fontWeight={500}>
            Noch keine Ausschreibungen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Wechsle zur Uebersicht und starte eine Suche.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {tenders.map((tender) => (
        <Link
          key={tender.id}
          href={tender.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="none"
          color="inherit"
          sx={{ display: "block" }}
        >
          <Card
            variant="outlined"
            sx={{
              transition: "border-color 0.2s",
              "&:hover": { borderColor: "primary.light" },
            }}
          >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {tender.title || `Ausschreibung #${tender.id}`}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      mt: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {tender.source}
                    </Typography>
                    {tender.external_id && (
                      <Typography variant="caption" color="text.secondary">
                        · {tender.external_id}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ flexShrink: 0, mt: 0.25 }}>
                  <FileText size={16} color="currentColor" style={{ opacity: 0.5 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Link>
      ))}
    </Box>
  );
}
