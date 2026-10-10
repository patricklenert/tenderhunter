"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Bot, Check, Copy, ExternalLink, ShieldCheck, Terminal } from "lucide-react";
import { getSiteUrl } from "@/lib/site-config";

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1.5, py: 0.75, bgcolor: "var(--color-surface-strong)" }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          {label}
        </Typography>
        <IconButton size="small" onClick={() => void copyCode()} aria-label={`${label} kopieren`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </IconButton>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          overflowX: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: { xs: "0.72rem", sm: "0.78rem" },
          lineHeight: 1.6,
          color: "text.primary",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {code}
      </Box>
    </Paper>
  );
}

export function McpSection() {
  const origin = getSiteUrl();

  const endpoint = `${origin}/api/mcp`;
  const searchEndpoint = `${origin}/api/mcp/search`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h5" component="h1" fontWeight={700}>
            Tenderhunter MCP
          </Typography>
          <Chip size="small" label="Read-only" icon={<ShieldCheck size={15} />} color="success" variant="outlined" />
          <Chip size="small" label="50 Tender pro UTC-Tag (Standard)" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
          Verbinde Claude, ChatGPT, Codex oder OpenCode direkt mit der Tenderhunter-Suche. Dein Agent kann qualifizierte und offene deutsche Ausschreibungen finden, aber keine Daten verändern.
        </Typography>
      </Stack>

      <Alert severity="info" icon={<Bot size={20} />}>
        Im Standardzugang werden über alle MCP- und lokalen CLI-Anfragen höchstens 50 Ausschreibungen pro UTC-Kalendertag ausgeliefert. Ein persönlicher Bearer-Schlüssel kann dieses Tageslimit aufheben.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={700}>MCP-Endpoint</Typography>
            <Typography variant="body2" color="text.secondary">
              Verwende diese URL für Clients mit Streamable-HTTP-Unterstützung:
            </Typography>
            <CodeBlock label="Endpoint" code={endpoint} />
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <Typography variant="h6" component="h2" fontWeight={700}>Verbindungen einrichten</Typography>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Claude Code</Typography>
              <CodeBlock label="Terminal" code={`claude mcp add --transport http tenderhunter ${endpoint}`} />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Codex</Typography>
              <CodeBlock label="Terminal" code={`codex mcp add tenderhunter --url ${endpoint}`} />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>OpenCode</Typography>
              <CodeBlock
                label="opencode.json"
                code={`{
  "mcp": {
    "tenderhunter": {
      "type": "remote",
      "url": "${endpoint}",
      "enabled": true
    }
  }
}`}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Claude Desktop</Typography>
              <Typography variant="body2" color="text.secondary">
                In der Claude-Desktop-MCP-Konfiguration als stdio-Bridge eintragen:
              </Typography>
              <CodeBlock
                label="claude_desktop_config.json"
                code={`{
  "mcpServers": {
    "tenderhunter": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${endpoint}"]
    }
  }
}`}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>ChatGPT</Typography>
              <Typography variant="body2" color="text.secondary">
                ChatGPT Web bietet für eigene Remote-MCP-Server keinen zuverlässigen Shell-Befehl. Öffne Developer Mode, erstelle einen Custom Connector und hinterlege dort die Endpoint-URL.
              </Typography>
              <Button
                component="a"
                href="https://chatgpt.com/"
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="small"
                endIcon={<ExternalLink size={16} />}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
              >
                ChatGPT öffnen
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Card variant="outlined" sx={{ bgcolor: "var(--color-surface-strong)" }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Terminal size={19} />
              <Typography variant="subtitle1" fontWeight={700}>Skill und CLI für lokale Agenten</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Im Projekt liegt eine dependency-freie CLI unter <code>cli/tenderhunter.mjs</code>. Sie verwendet dieselbe serverseitige Quota wie der MCP-Server.
            </Typography>
            <CodeBlock
              label="Terminal"
              code={`TENDERHUNTER_API_URL=${searchEndpoint} npm run tenderhunter -- search --query "Gebäudereinigung" --limit 10`}
            />
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary">
        Für einen persönlichen Zugang ohne Tageslimit muss serverseitig <code>MCP_UNLIMITED_API_KEY</code> gesetzt sein. Der MCP-Client sendet dann <code>Authorization: Bearer &lt;dein Schlüssel&gt;</code>; bei der lokalen CLI verwendest du <code>TENDERHUNTER_MCP_API_KEY</code>. Schlüssel niemals in die Endpoint-URL oder den Quellcode schreiben.
      </Typography>
    </Box>
  );
}
