import { Box, Container, Skeleton, Stack } from "@mui/material";
import { BrandLockup } from "@/components/BrandLockup";

export default function Loading() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: { xs: 4, md: 5 } }}>
          <BrandLockup size={40} labelSize={18} gap={12} />
        </Box>
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
