import { Box, Button, Container, Stack } from "@mui/material";
import { UsCompanyProfileForm } from "@/components/UsCompanyProfileForm";

export default function UsProfilePage() {
  return (
    <Box sx={{ background: "linear-gradient(180deg, #eff5fb 0, #fff 42rem)", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="md">
        <Stack spacing={2.5}>
          <Button href="/us" sx={{ alignSelf: "flex-start" }}>All U.S. opportunities</Button>
          <UsCompanyProfileForm />
        </Stack>
      </Container>
    </Box>
  );
}
