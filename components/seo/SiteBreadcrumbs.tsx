import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumbs, Typography } from "@mui/material";
import { Home } from "lucide-react";

export type SiteBreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

export function SiteBreadcrumbs({ items }: { items: SiteBreadcrumbItem[] }) {
  return (
    <Breadcrumbs
      aria-label="Brotkrumennavigation"
      separator={
        <Typography component="span" color="text.secondary" fontSize="inherit" aria-hidden="true">
          /
        </Typography>
      }
      sx={{ mb: 3, fontSize: "0.85rem" }}
    >
      {items.map(({ label, href }, index) => {
        const key = `${href ?? "current"}-${index}`;
        const content = href === "/" ? (
          <>
            <Home size={14} aria-hidden="true" />
            {label}
          </>
        ) : label;

        return href ? (
          <Link
            key={key}
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              minHeight: 44,
              color: "var(--color-text-secondary)",
              textDecoration: "none",
            }}
          >
            {content}
          </Link>
        ) : (
          <Typography
            key={key}
            component="span"
            color="text.primary"
            fontSize="inherit"
            sx={{ display: "block", maxWidth: "min(40ch, calc(100vw - 12rem))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
