import { Box, Container, Skeleton, Stack } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", py: { xs: 4, md: 6 } }}>
      {/* SEO: Hidden text for crawlers when ISR cache is cold — not visible to users */}
      <Box
        component="h1"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        Tenderhunter – Öffentliche Ausschreibungen in Deutschland
      </Box>
      <Box
        component="p"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        Aktuelle öffentliche Ausschreibungen, Vergabeverfahren und Aufträge der öffentlichen Hand. Täglich aktualisiert.
      </Box>
      <Container maxWidth="md">
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
