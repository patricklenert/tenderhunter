import { Box, Container, Skeleton, Stack, Typography } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        {/* SEO: Visible text for crawlers when ISR cache is cold — prevents thin-content skeleton pages */}
        <Typography
          variant="h4"
          component="h1"
          fontWeight={800}
          sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, color: "text.primary" }}
        >
          Tenderhunter – Öffentliche Ausschreibungen in Deutschland
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Aktuelle öffentliche Ausschreibungen, Vergabeverfahren und Aufträge der öffentlichen Hand. Täglich aktualisiert.
        </Typography>
        <Skeleton variant="text" sx={{ fontSize: "2.5rem", mb: 2, maxWidth: "70%" }} />
        <Skeleton variant="text" sx={{ fontSize: "1rem", mb: 4, maxWidth: "90%" }} />
        <Stack spacing={2}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
