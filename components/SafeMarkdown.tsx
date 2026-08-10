import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

const allowedElements = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
];

const markdownBaseSx: SxProps<Theme> = {
  minWidth: 0,
  overflowX: "auto",
  overflowWrap: "anywhere",
  "& p": {
    m: 0,
    "& + p": { mt: 1.25 },
  },
  "& h1, & h2, & h3, & h4": {
    mt: 2,
    mb: 1,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  "& h1": { fontSize: "1.25em" },
  "& h2": { fontSize: "1.15em" },
  "& h3, & h4": { fontSize: "1.05em" },
  "& ul, & ol": {
    my: 1,
    pl: 2.5,
  },
  "& li + li": { mt: 0.75 },
  "& blockquote": {
    m: 0,
    my: 1.5,
    pl: 2,
    borderLeft: "3px solid",
    borderColor: "divider",
    color: "text.secondary",
  },
};

interface SafeMarkdownProps {
  content?: string | null;
  fallback?: ReactNode;
  sx?: SxProps<Theme>;
}

export function SafeMarkdown({ content, fallback = null, sx }: SafeMarkdownProps) {
  if (!content?.trim()) return fallback;

  const resolvedSx: SxProps<Theme> = sx
    ? [markdownBaseSx, ...(Array.isArray(sx) ? sx : [sx])]
    : markdownBaseSx;

  return (
    <Box sx={resolvedSx}>
      <ReactMarkdown
        allowedElements={allowedElements}
        skipHtml
        unwrapDisallowed
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
