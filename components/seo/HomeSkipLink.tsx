"use client";

import { Box } from "@mui/material";
import type { MouseEvent } from "react";

const ANALYSIS_HEADING_ID = "website-analysis-title";

export function HomeSkipLink() {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const destination = document.getElementById(ANALYSIS_HEADING_ID);
    if (!destination) return;

    event.preventDefault();
    const hash = `#${ANALYSIS_HEADING_ID}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    destination.focus();
  };

  return (
    <Box
      component="a"
      href={`#${ANALYSIS_HEADING_ID}`}
      onClick={handleClick}
      sx={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 1501,
        transform: "translateY(calc(-100% - 0.5rem))",
        px: 1.5,
        py: 1,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        color: "text.primary",
        fontWeight: 600,
        textDecoration: "none",
        "&:focus-visible": {
          transform: "translateY(0)",
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      Zum Analyseformular
    </Box>
  );
}
