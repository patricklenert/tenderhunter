import Link from "next/link";
import { Box, Link as MuiLink, Stack, Typography } from "@mui/material";
import { BrandLockup } from "@/components/BrandLockup";
import { BRAND_METADATA } from "@/lib/brand-tokens";
import { getSiteUrl } from "@/lib/site-config";

export function PageFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        pt: 3,
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "center", sm: "flex-start" }}
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()}
          </Typography>
          <MuiLink
            component={Link}
            href={getSiteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tenderhunter Startseite"
            sx={{ display: "inline-flex", textDecoration: "none" }}
          >
            <BrandLockup size={32} labelSize={18} gap={8} />
          </MuiLink>
        </Stack>
        <MuiLink
          component={Link}
          href={getSiteUrl()}
          target="_blank"
          rel="noopener noreferrer"
          color="text.secondary"
          variant="caption"
          underline="hover"
          sx={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}
        >
          {BRAND_METADATA.tagline}
        </MuiLink>
      </Stack>
    </Box>
  );
}
