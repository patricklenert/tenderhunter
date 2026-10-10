import { Box, Container, Skeleton, Stack } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", py: { xs: 4, md: 6 } }}>
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
