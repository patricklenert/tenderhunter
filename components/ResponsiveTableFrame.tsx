import type { ReactNode } from "react";
import { Box, Paper, TableContainer, Typography } from "@mui/material";

interface ResponsiveTableFrameProps {
  label: string;
  children: ReactNode;
  minWidth?: number;
}

export function ResponsiveTableFrame({ label, children, minWidth = 920 }: ResponsiveTableFrameProps) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component="p"
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: "block", md: "none" }, mb: 1 }}
      >
        Wischen Sie nach links, um weitere Spalten zu sehen.
      </Typography>
      <TableContainer
        component={Paper}
        variant="outlined"
        role="region"
        aria-label={label}
        tabIndex={0}
        sx={{
          borderRadius: 2,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          "& > table": { minWidth },
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "primary.light",
            outlineOffset: 2,
          },
        }}
      >
        {children}
      </TableContainer>
    </Box>
  );
}
