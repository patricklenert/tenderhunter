import type { Metadata } from "next";
import { Box, Button, Container, Stack } from "@mui/material";
import { UsCompanyProfileForm } from "@/components/UsCompanyProfileForm";
import { NOINDEX_FOLLOW } from "@/lib/seo-indexability";

export const metadata: Metadata = {
  title: "Unternehmensprofil für US-Ausschreibungen",
  robots: NOINDEX_FOLLOW,
  alternates: { canonical: "/us/profile" },
};

export default function UsProfilePage() {
  return (
    <Box sx={{ backgroundColor: "background.default", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="md">
        <Stack spacing={2.5}>
          <Button href="/#us" sx={{ alignSelf: "flex-start" }}>Alle US-Ausschreibungen</Button>
          <UsCompanyProfileForm />
        </Stack>
      </Container>
    </Box>
  );
}
