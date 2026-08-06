import { Box } from "@mui/material";
import { Building2 } from "lucide-react";

interface CompanyLogoProps {
  src?: string | null;
  name: string;
  size?: number;
}

export function CompanyLogo({ src, name, size = 56 }: CompanyLogoProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Box
      component="span"
      role={src ? undefined : "img"}
      aria-label={src ? undefined : `${name} Logo`}
      sx={{
        width: size,
        height: size,
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        bgcolor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={`${name} Logo`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#334155",
            color: "white",
            fontSize: size * 0.34,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
          aria-hidden="true"
        >
          {initials || <Building2 size={size * 0.45} strokeWidth={1.5} />}
        </Box>
      )}
    </Box>
  );
}
