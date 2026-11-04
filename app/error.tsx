"use client";

import { useEffect } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="de">
      <head>
        <meta name="robots" content="noindex, follow" />
        <title>Fehler aufgetreten | Tenderhunter</title>
      </head>
      <body>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
          <Container maxWidth="sm" sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
              <BrandLockup size={40} labelSize={18} gap={12} />
            </Box>
            <Typography variant="h1" fontWeight={800} sx={{ fontSize: "2rem", mb: 1.5 }}>
              Etwas ist schiefgelaufen
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button variant="contained" onClick={reset} sx={{ width: { xs: "100%", sm: "auto" } }}>
                Erneut versuchen
              </Button>
              <Button variant="outlined" component={Link} href="/" sx={{ width: { xs: "100%", sm: "auto" } }}>
                Zur Startseite
              </Button>
            </Stack>
          </Container>
        </Box>
      </body>
    </html>
  );
}
