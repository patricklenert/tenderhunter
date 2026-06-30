"use client";

import { useEffect } from "react";
import { Box, Button, Container, Typography } from "@mui/material";
import Link from "next/link";

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
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.50" }}>
          <Container maxWidth="sm" sx={{ textAlign: "center" }}>
            <Typography variant="h1" fontWeight={800} sx={{ fontSize: "2rem", mb: 1.5 }}>
              Etwas ist schiefgelaufen
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button variant="contained" onClick={reset}>
                Erneut versuchen
              </Button>
              <Button variant="outlined" component={Link} href="/">
                Zur Startseite
              </Button>
            </Box>
          </Container>
        </Box>
      </body>
    </html>
  );
}
