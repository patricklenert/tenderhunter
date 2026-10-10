import { Box, Stack, Typography } from "@mui/material";
import { getSiteUrl } from "@/lib/site-config";

export function PageFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        pt: 3,
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "center", sm: "flex-start" }}
        spacing={1}
      >
        <Typography sx={{ color: "#64748b", fontSize: "0.75rem" }}>
          © {new Date().getFullYear()}{" "}
          <Box
            component="a"
            href={getSiteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "#475569",
              textDecoration: "none",
              fontWeight: 600,
              "&:hover": { color: "#1e293b" },
            }}
          >
            Tenderhunter
          </Box>
        </Typography>
        <Stack direction="row" spacing={2}>
          <Box
            component="a"
            href={getSiteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "#64748b",
              fontSize: "0.75rem",
              textDecoration: "none",
              "&:hover": { color: "#1e293b" },
            }}
          >
            KI-gestützte Ausschreibungssuche
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
